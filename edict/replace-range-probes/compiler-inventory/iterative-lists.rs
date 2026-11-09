// SPDX-License-Identifier: Apache-2.0 OR LicenseRef-MIND-UCAL-1.0
// © James Ross Ω FLYING•ROBOTS <https://github.com/flyingrobots>
//! Literal boundary expectations for public list, record and variant packages.

use super::{check, encode, evaluate, limits, record, selected_pair, EvaluationError, Value};
use anyhow::{ensure, Context, Result};
use std::path::Path;

fn fields(values: Vec<(&str, Value)>) -> Value {
    Value::Map(
        values
            .into_iter()
            .map(|(key, value)| (Value::Text(key.into()), value))
            .collect(),
    )
}

fn list(values: &[i128]) -> Value {
    Value::Array(values.iter().copied().map(Value::Integer).collect())
}

fn invalid(package: &[u8], pin: [u8; 32], input: Value) -> Result<()> {
    ensure!(
        evaluate(package, pin, &encode(&input)?, limits()) == Err(EvaluationError::InvalidInput),
        "invalid list-matrix input admitted"
    );
    Ok(())
}

fn selection(items: &[i128], index: i128, nested: bool) -> Value {
    let state = fields(vec![
        ("items", list(items)),
        ("index", Value::Integer(index)),
    ]);
    if nested {
        record("state", state)
    } else {
        state
    }
}

fn lookup(root: &Path, evidence: &serde_json::Value, name: &str, nested: bool) -> Result<()> {
    let (package, pin) = selected_pair(root, evidence, name)?;
    let cases: &[(&[i128], i128, i128)] = &[
        (&[], 0, 0),
        (&[9, 2, 7], 0, 9),
        (&[9, 2, 7], 1, 2),
        (&[9, 2, 7], 2, 7),
        (&[9, 2, 7], 3, 0),
        (&[9, 2, 7], i128::from(u64::MAX), 0),
    ];
    for (items, index, expected) in cases {
        check(
            &package,
            pin,
            selection(items, *index, nested),
            record("value", Value::Integer(*expected)),
        )
        .with_context(|| format!("{name} index={index} items={items:?}"))?;
    }
    invalid(&package, pin, selection(&[1, 2, 3, 4], 0, nested))?;
    invalid(&package, pin, selection(&[256], 0, nested))?;
    invalid(&package, pin, selection(&[], -1, nested))?;
    println!("PUBLIC_LIST_RUNTIME_OK {name}: 6 inputs, 3 invalid inputs");
    Ok(())
}

fn concat(root: &Path, evidence: &serde_json::Value) -> Result<()> {
    let (package, pin) = selected_pair(root, evidence, "list-concat")?;
    let cases: &[(&[i128], &[i128], &[i128])] = &[
        (&[], &[], &[]),
        (&[1, 2], &[], &[1, 2]),
        (&[], &[3, 4, 5], &[3, 4, 5]),
        (&[1, 2], &[3, 4, 5], &[1, 2, 3, 4, 5]),
    ];
    for (left, right, expected) in cases {
        check(
            &package,
            pin,
            fields(vec![("left", list(left)), ("right", list(right))]),
            record("items", list(expected)),
        )
        .context("list-concat")?;
    }
    for (left, right) in [(&[1, 2, 3][..], &[][..]), (&[][..], &[1, 2, 3, 4][..])] {
        invalid(
            &package,
            pin,
            fields(vec![("left", list(left)), ("right", list(right))]),
        )?;
    }
    println!("PUBLIC_LIST_RUNTIME_OK list-concat: 4 inputs, 2 invalid inputs");
    Ok(())
}

fn state(done: bool, value: i128) -> Value {
    fields(vec![
        ("done", Value::Bool(done)),
        ("value", Value::Integer(value)),
    ])
}

fn record_state(root: &Path, evidence: &serde_json::Value) -> Result<()> {
    let (package, pin) = selected_pair(root, evidence, "record-state-fold")?;
    for (initial, value, expected) in [(false, 7, true), (true, 255, false)] {
        check(
            &package,
            pin,
            record("initial", state(initial, value)),
            record("final", state(expected, value)),
        )
        .context("record-state-fold")?;
    }
    invalid(&package, pin, record("initial", state(false, 256)))?;
    println!("PUBLIC_LIST_RUNTIME_OK record-state-fold: 2 inputs, 1 invalid input");
    Ok(())
}

fn variant_state(root: &Path, evidence: &serde_json::Value) -> Result<()> {
    let (package, pin) = selected_pair(root, evidence, "variant-state-fold")?;
    for (input, expected) in [(0, 0), (7, 7), (255, 255)] {
        check(
            &package,
            pin,
            record("value", Value::Integer(input)),
            record("value", Value::Integer(expected)),
        )
        .context("variant-state-fold")?;
    }
    invalid(&package, pin, record("value", Value::Integer(256)))?;
    println!("PUBLIC_LIST_RUNTIME_OK variant-state-fold: 3 inputs, 1 invalid input");
    Ok(())
}

fn transfer_input(source: &[i128], index: i128, result: &[i128]) -> Value {
    record(
        "state",
        fields(vec![
            ("source", list(source)),
            ("index", Value::Integer(index)),
            ("result", list(result)),
        ]),
    )
}

struct TransferSample {
    source: &'static [i128],
    index: i128,
    result: &'static [i128],
    expected: &'static [i128],
}

fn transfer_samples() -> [TransferSample; 5] {
    [
        TransferSample {
            source: &[],
            index: 0,
            result: &[],
            expected: &[],
        },
        TransferSample {
            source: &[9, 2, 7],
            index: 1,
            result: &[4, 5],
            expected: &[4, 5, 2],
        },
        TransferSample {
            source: &[9],
            index: 0,
            result: &[1, 2, 3],
            expected: &[1, 2, 3],
        },
        TransferSample {
            source: &[9],
            index: 1,
            result: &[4],
            expected: &[4],
        },
        TransferSample {
            source: &[9],
            index: i128::from(u64::MAX),
            result: &[4],
            expected: &[4],
        },
    ]
}

fn transfer(root: &Path, evidence: &serde_json::Value) -> Result<()> {
    let (package, pin) = selected_pair(root, evidence, "guarded-list-transfer")?;
    for sample in transfer_samples() {
        check(
            &package,
            pin,
            transfer_input(sample.source, sample.index, sample.result),
            record("items", list(sample.expected)),
        )
        .context("guarded-list-transfer")?;
    }
    invalid(&package, pin, transfer_input(&[1, 2, 3, 4], 0, &[]))?;
    invalid(&package, pin, transfer_input(&[], 0, &[1, 2, 3, 4]))?;
    println!("PUBLIC_LIST_RUNTIME_OK guarded-list-transfer: 5 inputs, 2 invalid inputs");
    Ok(())
}

pub fn run(root: &Path, evidence: &serde_json::Value) -> Result<()> {
    lookup(root, evidence, "guarded-list-at", false)?;
    concat(root, evidence)?;
    record_state(root, evidence)?;
    variant_state(root, evidence)?;
    lookup(root, evidence, "record-list-select", true)?;
    transfer(root, evidence)?;
    Ok(())
}
