// SPDX-License-Identifier: Apache-2.0 OR LicenseRef-MIND-UCAL-1.0
// © James Ross Ω FLYING•ROBOTS <https://github.com/flyingrobots>
//! Admission for a complete, hash-selected public inventory.

use anyhow::{ensure, Context, Result};
use serde_json::Value;
use sha2::{Digest, Sha256};
use std::collections::{BTreeMap, BTreeSet};
use std::io::Read;
use std::path::{Component, Path};

pub const MAX_FILE_BYTES: usize = 2_097_152;
const MAX_FILES: usize = 512;
const MAX_ENTRIES: usize = 1024;
const MAX_CASES: usize = 64;
const MAX_DEPTH: usize = 8;
const MAX_TREE_BYTES: u64 = 20_971_520;
type Index = BTreeMap<String, (u64, String)>;

struct Inputs {
    authored: Index,
    provider: Index,
    lawpack: Index,
}

pub fn read(path: &Path) -> Result<Vec<u8>> {
    let metadata = path.symlink_metadata()?;
    ensure!(
        metadata.is_file() && metadata.len() <= MAX_FILE_BYTES as u64,
        "unbounded input"
    );
    let mut bytes = Vec::new();
    std::fs::File::open(path)?
        .take(MAX_FILE_BYTES as u64 + 1)
        .read_to_end(&mut bytes)?;
    ensure!(bytes.len() <= MAX_FILE_BYTES, "input grew above bound");
    Ok(bytes)
}

pub fn sha(bytes: &[u8]) -> String {
    hex::encode(Sha256::digest(bytes))
}

fn hex_identity(value: &Value, width: usize, label: &str) -> Result<()> {
    let text = value.as_str().with_context(|| format!("missing {label}"))?;
    ensure!(
        text.len() == width
            && text
                .bytes()
                .all(|byte| { byte.is_ascii_hexdigit() && !byte.is_ascii_uppercase() }),
        "invalid {label}"
    );
    Ok(())
}

fn index(value: &Value) -> Result<Index> {
    let files = value.as_array().context("file inventory")?;
    ensure!(
        !files.is_empty() && files.len() <= MAX_FILES,
        "invalid inventory size"
    );
    let mut result = Index::new();
    let mut total = 0;
    for file in files {
        let relative = file["path"].as_str().context("file path")?;
        ensure!(
            !relative.is_empty()
                && Path::new(relative)
                    .components()
                    .all(|part| matches!(part, Component::Normal(_))),
            "invalid selected path"
        );
        let length = file["bytes"].as_u64().context("file length")?;
        ensure!(length <= MAX_FILE_BYTES as u64, "unbounded selected file");
        total += length;
        ensure!(total <= MAX_TREE_BYTES, "unbounded selected tree");
        hex_identity(&file["sha256"], 64, "file identity")?;
        let digest = file["sha256"].as_str().context("file identity")?;
        ensure!(
            result
                .insert(relative.into(), (length, digest.into()))
                .is_none(),
            "duplicate selected path"
        );
    }
    Ok(result)
}

fn paths(
    root: &Path,
    relative: &Path,
    result: &mut BTreeSet<String>,
    visited: &mut usize,
) -> Result<()> {
    ensure!(
        relative.components().count() <= MAX_DEPTH,
        "unbounded evidence depth"
    );
    for item in std::fs::read_dir(root.join(relative))? {
        let item = item?;
        *visited += 1;
        ensure!(*visited <= MAX_ENTRIES, "unbounded evidence entries");
        let path = relative.join(item.file_name());
        let kind = item.file_type()?;
        if kind.is_dir() {
            paths(root, &path, result, visited)?;
        } else {
            ensure!(kind.is_file(), "nonregular evidence entry");
            result.insert(path.to_str().context("non-UTF8 evidence path")?.into());
            ensure!(result.len() <= MAX_FILES, "unbounded evidence tree");
        }
    }
    Ok(())
}

fn checked_tree(root: &Path, value: &Value) -> Result<Index> {
    ensure!(
        root.symlink_metadata()?.is_dir(),
        "nonregular evidence root"
    );
    let selected = index(value)?;
    let mut actual = BTreeSet::new();
    paths(root, Path::new(""), &mut actual, &mut 0)?;
    ensure!(
        actual == selected.keys().cloned().collect(),
        "inventory does not cover artifact tree"
    );
    for (relative, (length, digest)) in &selected {
        let bytes = read(&root.join(relative))?;
        ensure!(
            *length == bytes.len() as u64 && *digest == sha(&bytes),
            "selected bytes changed: {relative}"
        );
    }
    Ok(selected)
}

fn closure(case: &Index, prefix: &str, selected: &Index, label: &str) -> Result<()> {
    let found: Index = case
        .iter()
        .filter_map(|(path, identity)| {
            path.strip_prefix(prefix)
                .map(|relative| (relative.into(), identity.clone()))
        })
        .collect();
    ensure!(found == *selected, "{label} selection mismatch");
    Ok(())
}

fn inputs(root: &Path, value: &Value) -> Result<Inputs> {
    for (field, width, label) in [
        ("compilerCommit", 40, "compiler commit"),
        ("echoCheckoutCommit", 40, "Echo commit"),
        ("compilerBinarySha256", 64, "compiler identity"),
        ("driverSha256", 64, "driver identity"),
        ("lawpackSourceSha256", 64, "lawpack source identity"),
    ] {
        hex_identity(&value[field], width, label)?;
    }
    ensure!(
        value["driverSha256"].as_str() == Some(sha(&read(&root.join("driver.mts"))?).as_str()),
        "driver selection mismatch"
    );
    ensure!(
        value["lawpackSourceSha256"].as_str()
            == Some(sha(&read(&root.join("basis/edict.lawpack.json"))?).as_str()),
        "lawpack source selection mismatch"
    );
    checked_tree(&root.join("fixture-sources"), &value["probeSources"])?;
    Ok(Inputs {
        authored: checked_tree(&root.join("authored-sources"), &value["authoredSources"])?,
        provider: checked_tree(&root.join("basis/.build/echo-provider"), &value["provider"])?,
        lawpack: checked_tree(&root.join("basis/vendor"), &value["lawpackClosure"])?,
    })
}

fn cases(root: &Path, evidence: &Value, selected: &Inputs) -> Result<()> {
    let cases = evidence["results"].as_array().context("case results")?;
    ensure!(
        !cases.is_empty() && cases.len() <= MAX_CASES,
        "invalid case count"
    );
    let mut names = BTreeSet::new();
    for case in cases {
        let name = case["name"].as_str().context("case name")?;
        ensure!(
            !name.is_empty()
                && name
                    .bytes()
                    .all(|byte| byte.is_ascii_lowercase() || byte.is_ascii_digit() || byte == b'-'),
            "invalid case name"
        );
        ensure!(names.insert(format!("{name}.edict")), "duplicate case");
        let files = checked_tree(&root.join(name), &case["files"])?;
        ensure!(
            files.get("src/Probe.edict") == selected.authored.get(&format!("{name}.edict"))
                && files.contains_key("src/Probe.edict"),
            "source selection mismatch"
        );
        for required in ["edict.application.json", "stdout.jsonl", "stderr.jsonl"] {
            ensure!(
                files.contains_key(required),
                "missing selected artifact: {required}"
            );
        }
        closure(
            &files,
            ".build/echo-provider/",
            &selected.provider,
            "provider",
        )?;
        closure(&files, "vendor/", &selected.lawpack, "lawpack")?;
    }
    ensure!(
        names == selected.authored.keys().cloned().collect(),
        "authored source closure mismatch"
    );
    let baseline = cases
        .iter()
        .find(|case| case["name"] == "baseline")
        .context("missing positive control")?;
    ensure!(
        baseline["exitCode"] == 0
            && baseline["diagnostics"]
                .as_array()
                .is_some_and(Vec::is_empty),
        "invalid positive control"
    );
    Ok(())
}

pub fn load(root: &Path, expected: &str) -> Result<Value> {
    let report = read(&root.join("report.json"))?;
    ensure!(sha(&report) == expected, "compiler evidence substitution");
    let evidence: Value = serde_json::from_slice(&report)?;
    ensure!(
        evidence["schema"] == "jedit.iterative-inventory/v2",
        "wrong inventory ABI"
    );
    ensure!(
        evidence["measurement"] == "complete",
        "incomplete inventory"
    );
    let selected = inputs(root, &evidence["selectedInputs"])?;
    cases(root, &evidence, &selected)?;
    Ok(evidence)
}
