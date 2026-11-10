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
const EFFECT_GROUP: &str = "effects";
const EFFECT_CASE_PREFIX: &str = "effect-";
const EFFECT_VENDOR: &str = "vendor/jedit-inventory-effects/";
const BASIS_VENDOR: &str = "vendor/jedit-text/";
const GROUPS: [&str; 7] = [
    "controls",
    "lists",
    "ranges",
    "modules",
    "primitives",
    "drafts",
    EFFECT_GROUP,
];
type Index = BTreeMap<String, (u64, String)>;

struct Inputs {
    authored: Index,
    provider: Index,
    lawpack: Index,
    sources: Option<Index>,
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

fn inputs(root: &Path, value: &Value, version: u8) -> Result<Inputs> {
    // A v2 report has no group; any named group must be one this consumer witnesses.
    ensure!(
        value
            .get("group")
            .is_none_or(|group| group.as_str().is_some_and(|name| GROUPS.contains(&name))),
        "unsupported inventory group"
    );
    if value["group"] == "drafts" {
        ensure!(
            value["draftDriverSha256"].as_str()
                == Some(sha(&read(&root.join("draft-driver.mjs"))?).as_str()),
            "draft driver selection mismatch"
        );
    }
    if value["group"] == EFFECT_GROUP {
        ensure!(
            value["effectDriverSha256"].as_str()
                == Some(sha(&read(&root.join("effect-driver.mts"))?).as_str()),
            "effect driver selection mismatch"
        );
        ensure!(
            value["effectLawpackSourceSha256"].as_str()
                == Some(sha(&read(&root.join("basis/effects.lawpack.json"))?).as_str()),
            "effect lawpack source selection mismatch"
        );
    }
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
    let sources = if version == 3 {
        ensure!(
            value["closureDriverSha256"].as_str()
                == Some(sha(&read(&root.join("closure-driver.mts"))?).as_str()),
            "closure driver selection mismatch"
        );
        Some(checked_tree(
            &root.join("source-closures"),
            &value["sourceClosures"],
        )?)
    } else {
        None
    };
    Ok(Inputs {
        authored: checked_tree(&root.join("authored-sources"), &value["authoredSources"])?,
        provider: checked_tree(&root.join("basis/.build/echo-provider"), &value["provider"])?,
        lawpack: checked_tree(&root.join("basis/vendor"), &value["lawpackClosure"])?,
        sources,
    })
}

fn source_selection(root: &Path, name: &str, files: &Index, selected: &Inputs) -> Result<()> {
    let expected: Index = if let Some(sources) = &selected.sources {
        sources
            .iter()
            .filter_map(|(path, identity)| {
                path.strip_prefix(&format!("{name}/"))
                    .map(|relative| (relative.into(), identity.clone()))
            })
            .collect()
    } else {
        [(
            "src/Probe.edict".into(),
            selected.authored[&format!("{name}.edict")].clone(),
        )]
        .into()
    };
    let actual: Index = files
        .iter()
        .filter(|(path, _)| path.starts_with("src/"))
        .map(|(path, identity)| (path.clone(), identity.clone()))
        .collect();
    ensure!(actual == expected, "source closure selection mismatch");
    let config: Value =
        serde_json::from_slice(&read(&root.join(name).join("edict.application.json"))?)?;
    let sources = config["sources"]
        .as_array()
        .context("application source closure mismatch")?;
    let paths: BTreeSet<_> = sources.iter().filter_map(Value::as_str).collect();
    ensure!(
        sources.first().and_then(Value::as_str) == Some("src/Probe.edict")
            && paths.len() == sources.len()
            && paths == expected.keys().map(String::as_str).collect(),
        "application source closure mismatch"
    );
    Ok(())
}

/// Effect cases select only the standalone effect lawpack; every other case only the basis.
fn lawpack_selection(root: &Path, name: &str, group: &Value) -> Result<()> {
    let config: Value =
        serde_json::from_slice(&read(&root.join(name).join("edict.application.json"))?)?;
    let lawpacks = config["lawpacks"]
        .as_array()
        .context("application lawpack selection")?;
    let vendor = if group == EFFECT_GROUP && name.starts_with(EFFECT_CASE_PREFIX) {
        EFFECT_VENDOR
    } else {
        BASIS_VENDOR
    };
    ensure!(
        lawpacks.len() == 1
            && ["manifest", "exports", "adapter", "targetConfiguration"]
                .iter()
                .all(|field| lawpacks[0][*field]
                    .as_str()
                    .is_some_and(|path| path.starts_with(vendor))),
        "application lawpack selection mismatch"
    );
    Ok(())
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
        source_selection(root, name, &files, selected)?;
        lawpack_selection(root, name, &evidence["selectedInputs"]["group"])?;
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
    if let Some(sources) = &selected.sources {
        let owners: BTreeSet<_> = sources
            .keys()
            .filter_map(|path| {
                path.split_once('/')
                    .map(|(name, _)| format!("{name}.edict"))
            })
            .collect();
        ensure!(owners == names, "source closure case mismatch");
    }
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

fn json_lines(path: &Path) -> Result<Vec<Value>> {
    let source = String::from_utf8(read(path)?)?;
    let mut values = Vec::new();
    for line in source.lines().filter(|line| !line.trim().is_empty()) {
        ensure!(values.len() < MAX_ENTRIES, "unbounded compiler events");
        values.push(serde_json::from_str(line)?);
    }
    Ok(values)
}

fn compiler_events(root: &Path, case: &Value) -> Result<()> {
    let name = case["name"].as_str().context("case name")?;
    let stdout = json_lines(&root.join(name).join("stdout.jsonl"))?;
    let stderr = json_lines(&root.join(name).join("stderr.jsonl"))?;
    ensure!(
        case["diagnostics"].as_array() == Some(&stderr),
        "compiler diagnostics mismatch"
    );
    let statuses: Vec<_> = stdout
        .iter()
        .chain(&stderr)
        .filter(|item| item["type"] == "status")
        .collect();
    ensure!(statuses.len() == 1, "missing or duplicate compiler status");
    let status = statuses[0];
    let exit = case["exitCode"].as_i64().context("compiler exit status")?;
    ensure!(
        status["schema"] == "edict.cli.event/v1"
            && status["command"] == "build"
            && status["exitCode"].as_i64() == Some(exit)
            && status["status"] == if exit == 0 { "ok" } else { "error" },
        "compiler status mismatch"
    );
    Ok(())
}

pub fn load(root: &Path, expected: &str) -> Result<Value> {
    let report = read(&root.join("report.json"))?;
    ensure!(sha(&report) == expected, "compiler evidence substitution");
    let evidence: Value = serde_json::from_slice(&report)?;
    let version = match evidence["schema"].as_str() {
        Some("jedit.iterative-inventory/v2") => 2,
        Some("jedit.iterative-inventory/v3") => 3,
        _ => anyhow::bail!("wrong inventory ABI"),
    };
    ensure!(
        evidence["measurement"] == "complete",
        "incomplete inventory"
    );
    let selected = inputs(root, &evidence["selectedInputs"], version)?;
    cases(root, &evidence, &selected)?;
    for case in evidence["results"].as_array().context("case results")? {
        compiler_events(root, case)?;
    }
    Ok(evidence)
}
