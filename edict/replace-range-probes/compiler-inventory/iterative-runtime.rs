// SPDX-License-Identifier: Apache-2.0 OR LicenseRef-MIND-UCAL-1.0
// © James Ross Ω FLYING•ROBOTS <https://github.com/flyingrobots>
//! Test-only consumer of exact public compiler package/report pairs.
#![allow(clippy::print_stdout)]

#[path = "jedit_iterative_inventory/evidence.rs"]
mod evidence;
#[path = "jedit_iterative_inventory/lists.rs"]
mod list_matrix;
#[path = "jedit_iterative_inventory/stages.rs"]
mod stages;

use anyhow::{anyhow, ensure, Context, Result};
use echo_edict_canonical::{
    decode_canonical_cbor_v1 as decode, digest_canonical_value_bytes_v1 as digest,
    encode_canonical_cbor_v1 as encode, CanonicalValueV1 as Value,
};
use evidence::{read, MAX_FILE_BYTES};
use std::path::Path;
use warp_core::edict_pure::{evaluate, EvaluationError, EvaluationLimits};

const APPENDED_VALUE: i128 = 7;

fn field<'a>(value: &'a Value, name: &str) -> Result<&'a Value> {
    let Value::Map(fields) = value else {
        return Err(anyhow!("expected map"));
    };
    fields
        .iter()
        .find_map(|(key, value)| (key == &Value::Text(name.into())).then_some(value))
        .context("missing canonical field")
}

fn text(value: &Value) -> Result<&str> {
    let Value::Text(value) = value else {
        return Err(anyhow!("expected text"));
    };
    Ok(value)
}

fn bytes(value: &Value) -> Result<&[u8]> {
    let Value::Bytes(value) = value else {
        return Err(anyhow!("expected bytes"));
    };
    Ok(value)
}

fn resource(value: &Value, id: &str) -> Result<[u8; 32]> {
    ensure!(text(field(value, "id")?)? == id, "wrong resource identity");
    let Value::Array(pair) = field(value, "digest")? else {
        return Err(anyhow!("expected digest"));
    };
    ensure!(
        pair.len() == 2 && text(&pair[0])? == "sha256",
        "wrong digest algorithm"
    );
    bytes(&pair[1])?.try_into().context("wrong digest width")
}

fn record(name: &str, value: Value) -> Value {
    Value::Map(vec![(Value::Text(name.into()), value)])
}

fn limits() -> EvaluationLimits {
    EvaluationLimits {
        max_package_bytes: MAX_FILE_BYTES,
        max_input_bytes: 1024,
        max_steps: 16_777_216,
        max_allocated_bytes: 67_108_864,
        max_output_bytes: 32_768,
    }
}

fn required_files(case: &serde_json::Value) -> Result<()> {
    let files = case["files"].as_array().context("case file inventory")?;
    for required in [
        "src/Probe.edict",
        "edict.application.json",
        ".build/application/executable-operation-package.cbor",
        ".build/application/verification-report.cbor",
    ] {
        ensure!(
            files
                .iter()
                .filter(|file| file["path"].as_str() == Some(required))
                .count()
                == 1,
            "missing or duplicate selected artifact: {required}"
        );
    }
    Ok(())
}

fn checked_report(package: &[u8], report: &[u8]) -> Result<[u8; 32]> {
    let decoded = decode(package)?;
    let report = decode(report)?;
    ensure!(
        text(field(&report, "apiVersion")?)? == "echo.operation-package-verifier-report/v1"
            && text(field(&report, "outcome")?)? == "accepted"
            && bytes(field(&report, "diagnosticBytes")?)?.is_empty(),
        "verifier did not accept"
    );
    let pin = resource(
        field(&report, "package")?,
        "executable-operation-package.echo",
    )?;
    ensure!(
        pin == digest("echo.operation-package/v1", &decoded)?,
        "package/report mismatch"
    );
    let target = field(&report, "targetIr")?;
    ensure!(
        resource(target, text(field(target, "id")?)?)?.as_slice()
            == bytes(field(
                field(&decoded, "semantic_closure")?,
                "target_ir_identity"
            )?)?,
        "Target IR mismatch"
    );
    let program = decode(bytes(field(&decoded, "program")?)?)?;
    let projection = decode(bytes(field(&program, "result_projection_artifact")?)?)?;
    ensure!(
        resource(
            field(&report, "applicationResultProjection")?,
            text(field(&decoded, "operation_coordinate")?)?
        )? == digest("edict.result-projection.artifact/v1", &projection)?,
        "result projection mismatch"
    );
    Ok(pin)
}

fn selected_pair(
    root: &Path,
    evidence: &serde_json::Value,
    name: &str,
) -> Result<(Vec<u8>, [u8; 32])> {
    let cases = evidence["results"].as_array().context("case results")?;
    let selected: Vec<_> = cases
        .iter()
        .filter(|case| case["name"].as_str() == Some(name))
        .collect();
    ensure!(selected.len() == 1, "missing or duplicate case");
    let case = selected[0];
    ensure!(
        case["exitCode"] == 0 && case["diagnostics"].as_array().is_some_and(Vec::is_empty),
        "public compiler did not accept without diagnostics"
    );
    let directory = root.join(name);
    required_files(case)?;
    let package = read(&directory.join(".build/application/executable-operation-package.cbor"))?;
    let report = read(&directory.join(".build/application/verification-report.cbor"))?;
    let pin = checked_report(&package, &report)?;
    Ok((package, pin))
}

fn short_budgets(
    package: &[u8],
    pin: [u8; 32],
    input: &[u8],
    exact: EvaluationLimits,
) -> Result<()> {
    for (ceiling, refusal) in [
        (
            EvaluationLimits {
                max_steps: exact.max_steps - 1,
                ..exact
            },
            EvaluationError::StepBudgetExceeded,
        ),
        (
            EvaluationLimits {
                max_allocated_bytes: exact.max_allocated_bytes - 1,
                ..exact
            },
            EvaluationError::AllocationBudgetExceeded,
        ),
        (
            EvaluationLimits {
                max_output_bytes: exact.max_output_bytes - 1,
                ..exact
            },
            EvaluationError::OutputBudgetExceeded,
        ),
    ] {
        ensure!(
            evaluate(package, pin, input, ceiling) == Err(refusal),
            "one-under budget did not refuse"
        );
    }
    Ok(())
}

fn check(package: &[u8], pin: [u8; 32], input: Value, expected: Value) -> Result<()> {
    let input = encode(&input)?;
    let result = evaluate(package, pin, &input, limits())
        .map_err(|error| anyhow!("runtime refused: {error:?}"))?;
    ensure!(
        decode(&result.output)? == expected,
        "wrong iterative result"
    );
    let exact = EvaluationLimits {
        max_steps: result.steps,
        max_allocated_bytes: result.allocated_bytes,
        max_output_bytes: result.output.len() as u64,
        ..limits()
    };
    ensure!(
        evaluate(package, pin, &input, exact) == Ok(result.clone()),
        "exact-budget replay changed"
    );
    ensure!(
        result.steps > 0 && result.allocated_bytes > 0 && !result.output.is_empty(),
        "empty resource witness"
    );
    short_budgets(package, pin, &input, exact)?;
    let mut wrong = pin;
    wrong[0] ^= 1;
    ensure!(
        evaluate(package, wrong, &input, limits()) == Err(EvaluationError::PackageIdentityMismatch),
        "package identity substitution admitted"
    );
    println!(
        "RUNTIME_CASE_OK steps={} allocated={} output={}",
        result.steps,
        result.allocated_bytes,
        result.output.len()
    );
    Ok(())
}

fn scalar(root: &Path, evidence: &serde_json::Value) -> Result<()> {
    let (package, pin) = selected_pair(root, evidence, "scalar-fold")?;
    for initial in [false, true] {
        check(
            &package,
            pin,
            record("value", Value::Bool(initial)),
            record("value", Value::Bool(!initial)),
        )?;
    }
    let invalid = encode(&record("value", Value::Integer(0)))?;
    ensure!(
        evaluate(&package, pin, &invalid, limits()) == Err(EvaluationError::InvalidInput),
        "invalid Bool admitted"
    );
    println!("PUBLIC_ITERATIVE_RUNTIME_OK scalar-fold: 2 inputs, exact replay, 3 one-under limits, identity and type refusal");
    Ok(())
}

fn accumulated_list(root: &Path, evidence: &serde_json::Value, name: &str) -> Result<()> {
    let item = if name == "bounded-list-fold" {
        Value::Integer(APPENDED_VALUE)
    } else {
        record("index", Value::Integer(APPENDED_VALUE))
    };
    let (package, pin) = selected_pair(root, evidence, name)?;
    check(
        &package,
        pin,
        record("marker", Value::Integer(0)),
        record("items", Value::Array(vec![item; 3])),
    )?;
    let invalid = encode(&record("marker", Value::Integer(256)))?;
    ensure!(
        evaluate(&package, pin, &invalid, limits()) == Err(EvaluationError::InvalidInput),
        "invalid U8 admitted"
    );
    println!("PUBLIC_ITERATIVE_RUNTIME_OK {name}: exact three-item result, exact replay, 3 one-under limits, identity and type refusal");
    Ok(())
}

fn constrained_add(root: &Path, evidence: &serde_json::Value) -> Result<()> {
    let (package, pin) = selected_pair(root, evidence, "constrained-add")?;
    for (input, expected) in [(0, 1), (1, 2), (2, 3)] {
        check(
            &package,
            pin,
            record("index", Value::Integer(input)),
            record("index", Value::Integer(expected)),
        )
        .context("constrained-add")?;
    }
    for value in [3, i128::from(u64::MAX)] {
        let input = encode(&record("index", Value::Integer(value)))?;
        ensure!(
            evaluate(&package, pin, &input, limits())
                == Err(EvaluationError::InputConstraintFailed("where.0".into())),
            "constrained-add did not reject input outside its predicate"
        );
    }
    println!("PUBLIC_RANGE_RUNTIME_OK constrained-add: 3 inputs, 2 constraint refusals");
    Ok(())
}

fn runtime_names(evidence: &serde_json::Value) -> Result<Vec<&'static str>> {
    let mut names = vec!["scalar-fold", "bounded-list-fold", "record-worklist-fold"];
    match evidence["selectedInputs"].get("group") {
        None => {}
        Some(serde_json::Value::String(group)) if group == "controls" => {}
        Some(serde_json::Value::String(group)) if group == "lists" => names.extend([
            "guarded-list-at",
            "list-concat",
            "record-state-fold",
            "variant-state-fold",
            "record-list-select",
            "guarded-list-transfer",
        ]),
        Some(serde_json::Value::String(group)) if group == "ranges" => {
            names.push("constrained-add");
        }
        _ => return Err(anyhow!("unsupported inventory group")),
    }
    Ok(names)
}

fn run_named(root: &Path, evidence: &serde_json::Value, name: &str) -> Result<()> {
    match name {
        "scalar-fold" => scalar(root, evidence),
        "bounded-list-fold" | "record-worklist-fold" => accumulated_list(root, evidence, name),
        "constrained-add" => constrained_add(root, evidence),
        _ => list_matrix::run_case(root, evidence, name),
    }
}

fn main() -> Result<()> {
    ensure!(
        Path::new("/.dockerenv").is_file(),
        "run in the guarded Docker worker"
    );
    let arguments: Vec<_> = std::env::args().skip(1).collect();
    ensure!(
        arguments.len() == 2,
        "expected inventory directory and exact report SHA-256"
    );
    let root = Path::new(&arguments[0]);
    let evidence = evidence::load(root, &arguments[1])?;
    let names = runtime_names(&evidence)?;
    let mut report = stages::inventory(root, &evidence, &arguments[1])?;
    let mut failures = Vec::new();
    for name in names {
        let result = run_named(root, &evidence, name);
        report.record_runtime(name, &result)?;
        if let Err(error) = result {
            failures.push(format!("{name}: {error:#}"));
        }
    }
    println!("STAGE_INVENTORY {}", serde_json::to_string(&report)?);
    ensure!(failures.is_empty(), "{}", failures.join("\n"));
    Ok(())
}
