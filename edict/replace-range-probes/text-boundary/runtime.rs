// SPDX-License-Identifier: Apache-2.0 OR LicenseRef-MIND-UCAL-1.0
// © James Ross Ω FLYING•ROBOTS <https://github.com/flyingrobots>
//! Test-only trusted consumer of unchanged public compiler outputs.
#![allow(clippy::print_stdout)]
use anyhow::{anyhow, ensure, Context, Result};
use echo_edict_canonical::{
    decode_canonical_cbor_v1 as decode, digest_canonical_value_bytes_v1 as digest,
    encode_canonical_cbor_v1 as encode, CanonicalValueV1 as Value,
};
use sha2::{Digest, Sha256};
use std::path::Path;
use warp_core::edict_pure::{evaluate, EvaluationError, EvaluationLimits};

fn bounded_read(path: &Path) -> Result<Vec<u8>> {
    let metadata = path.symlink_metadata()?;
    ensure!(
        metadata.is_file() && metadata.len() <= 2_097_152,
        "unbounded input"
    );
    let value = std::fs::read(path)?;
    ensure!(value.len() <= 2_097_152, "input grew above bound");
    Ok(value)
}
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
fn record(fields: impl IntoIterator<Item = (&'static str, Value)>) -> Value {
    Value::Map(
        fields
            .into_iter()
            .map(|(name, value)| (Value::Text(name.into()), value))
            .collect(),
    )
}
fn input(bytes: Value, index: Value) -> Result<Vec<u8>> {
    Ok(encode(&record([("bytes", bytes), ("index", index)]))?)
}
fn limits() -> EvaluationLimits {
    EvaluationLimits {
        max_package_bytes: 1_048_576,
        max_input_bytes: 2_097_152,
        max_steps: 16_777_216,
        max_allocated_bytes: 268_435_456,
        max_output_bytes: 1024,
    }
}
fn sha(bytes: &[u8]) -> String {
    hex::encode(Sha256::digest(bytes))
}

fn selected_pair(root: &Path, expected: &str) -> Result<(Vec<u8>, [u8; 32])> {
    let evidence_bytes = bounded_read(&root.join("evidence.json"))?;
    ensure!(
        sha(&evidence_bytes) == expected,
        "compiler evidence substitution"
    );
    let evidence: serde_json::Value = serde_json::from_slice(&evidence_bytes)?;
    ensure!(
        evidence["schema"] == "jedit.text-boundary-witness/v1",
        "wrong witness ABI"
    );
    let builds = evidence["builds"].as_array().context("build results")?;
    ensure!(builds.len() == 2, "missing repeated public build");
    for build in builds {
        ensure!(
            build["exitCode"] == 0 && build["diagnostics"].as_array().is_some_and(Vec::is_empty),
            "compiler did not succeed without diagnostics"
        );
    }
    let selection = &evidence["selectedInputs"];
    for (file, key) in [
        ("src/Boundary.edict", "helperSourceSha256"),
        ("src/Probe.edict", "rootSourceSha256"),
        ("edict.application.json", "configSha256"),
    ] {
        ensure!(
            selection[key].as_str() == Some(sha(&bounded_read(&root.join(file))?).as_str()),
            "selected source/configuration changed"
        );
    }
    for (directory, key) in [("vendor", "vendor"), (".build/echo-provider", "provider")] {
        for (relative, expected) in selection[key].as_object().context("input tree")? {
            ensure!(
                !Path::new(relative).is_absolute()
                    && Path::new(relative)
                        .components()
                        .all(|part| matches!(part, std::path::Component::Normal(_))),
                "invalid selected path"
            );
            ensure!(
                expected.as_str()
                    == Some(sha(&bounded_read(&root.join(directory).join(relative))?).as_str()),
                "selected provider/vendor bytes changed"
            );
        }
    }
    let package = bounded_read(&root.join("executable-operation-package.cbor"))?;
    let report_bytes = bounded_read(&root.join("verification-report.cbor"))?;
    for (name, data) in [
        ("executable-operation-package.cbor", &package),
        ("verification-report.cbor", &report_bytes),
    ] {
        for build in builds {
            ensure!(
                build["artifacts"][name].as_str() == Some(sha(data).as_str()),
                "emitted artifacts changed"
            );
        }
    }
    let report = decode(&report_bytes)?;
    ensure!(
        text(field(&report, "apiVersion")?)? == "echo.operation-package-verifier-report/v1"
            && text(field(&report, "outcome")?)? == "accepted"
            && bytes(field(&report, "diagnosticBytes")?)?.is_empty(),
        "verifier did not accept"
    );
    let decoded = decode(&package)?;
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
    Ok((package, pin))
}

fn check(package: &[u8], pin: [u8; 32], bytes: &[u8], index: u64, expected: bool) -> Result<()> {
    let input = input(Value::Bytes(bytes.to_vec()), Value::Integer(index.into()))?;
    let result = evaluate(package, pin, &input, limits())
        .map_err(|error| anyhow!("runtime refused: {error:?}"))?;
    ensure!(
        decode(&result.output)? == record([("value", Value::Bool(expected))]),
        "wrong boundary at {index} in {} bytes",
        bytes.len()
    );
    ensure!(
        Ok(result) == evaluate(package, pin, &input, limits()),
        "repeat changed output/accounting"
    );
    Ok(())
}

fn positive_cases(package: &[u8], pin: [u8; 32]) -> Result<usize> {
    let mut count = 0;
    for value in ["", "ab", "λ", "💩", "e\u{301}", "aλ🦀z", "a\0b", "\r\n"] {
        for index in 0..=value.len() + 1 {
            check(
                package,
                pin,
                value.as_bytes(),
                index.try_into()?,
                value.is_char_boundary(index),
            )?;
            count += 1;
        }
        check(package, pin, value.as_bytes(), u64::MAX, false)?;
        count += 1;
    }
    // Raw octets test the predicate's boundary rule, not full UTF-8 validity.
    for (byte, expected) in [
        (0, true),
        (127, true),
        (128, false),
        (129, false),
        (190, false),
        (191, false),
        (192, true),
        (255, true),
    ] {
        check(package, pin, &[b'x', byte, b'z'], 1, expected)?;
        count += 1;
    }
    let ceiling = vec![b'a'; 1_048_576];
    for (index, expected) in [
        (0, true),
        (1_048_575, true),
        (1_048_576, true),
        (1_048_577, false),
        (u64::MAX, false),
    ] {
        check(package, pin, &ceiling, index, expected)?;
        count += 1;
    }
    Ok(count)
}

fn negative_cases(package: &[u8], pin: [u8; 32]) -> Result<()> {
    for (bytes, index) in [
        (Value::Bytes(vec![255]), Value::Integer(-1)),
        (Value::Bytes(vec![255]), Value::Bool(true)),
        (Value::Integer(0), Value::Integer(0)),
        (Value::Bytes(vec![b'a'; 1_048_577]), Value::Integer(0)),
    ] {
        ensure!(
            evaluate(package, pin, &input(bytes, index)?, limits())
                == Err(EvaluationError::InvalidInput),
            "invalid boundary input admitted"
        );
    }
    let input = input(Value::Bytes(b"x".to_vec()), Value::Integer(0))?;
    for (limits, expected) in [
        (
            EvaluationLimits {
                max_steps: 1,
                ..limits()
            },
            EvaluationError::StepBudgetExceeded,
        ),
        (
            EvaluationLimits {
                max_allocated_bytes: 1,
                ..limits()
            },
            EvaluationError::AllocationBudgetExceeded,
        ),
        (
            EvaluationLimits {
                max_output_bytes: 1,
                ..limits()
            },
            EvaluationError::OutputBudgetExceeded,
        ),
        (
            EvaluationLimits {
                max_input_bytes: 1,
                ..limits()
            },
            EvaluationError::InputTooLarge,
        ),
        (
            EvaluationLimits {
                max_package_bytes: 1,
                ..limits()
            },
            EvaluationError::PackageTooLarge,
        ),
    ] {
        ensure!(
            evaluate(package, pin, &input, limits) == Err(expected),
            "boundary resource limit admitted"
        );
    }
    let mut wrong = pin;
    wrong[0] ^= 1;
    ensure!(
        evaluate(package, wrong, &input, limits()) == Err(EvaluationError::PackageIdentityMismatch),
        "boundary package substitution admitted"
    );
    Ok(())
}

fn main() -> Result<()> {
    let args: Vec<String> = std::env::args().collect();
    ensure!(
        args.len() == 3,
        "usage: jim_text_boundary DIR EVIDENCE_SHA256"
    );
    let (package, pin) = selected_pair(Path::new(&args[1]), &args[2])?;
    let count = positive_cases(&package, pin)?;
    ensure!(count >= 40, "no meaningful case coverage");
    negative_cases(&package, pin)?;
    println!("JIM_TEXT_BOUNDARY_RUNTIME_OK {count} cases; 4 input, 5 resource, 1 identity refusal; deterministic repeats");
    Ok(())
}
