// SPDX-License-Identifier: Apache-2.0 OR LicenseRef-MIND-UCAL-1.0
// © James Ross Ω FLYING•ROBOTS <https://github.com/flyingrobots>
//! Literal primitive oracles for public packages; no native rope implementation.

use super::{check, encode, evaluate, limits, record, selected_pair, EvaluationError, Value};
use anyhow::{bail, ensure, Result};
use std::path::Path;

const MAX_WORD: i128 = u64::MAX as i128;

fn fields<const N: usize>(values: [(&str, Value); N]) -> Value {
    Value::Map(
        values
            .into_iter()
            .map(|(name, value)| (Value::Text(name.into()), value))
            .collect(),
    )
}

fn rejected(package: &[u8], pin: [u8; 32], input: Value, expected: EvaluationError) -> Result<()> {
    let input = encode(&input)?;
    ensure!(
        evaluate(package, pin, &input, limits()) == Err(expected),
        "primitive input did not refuse"
    );
    Ok(())
}

fn range(start: i128, end: i128) -> Value {
    fields([
        ("end", Value::Integer(end)),
        ("start", Value::Integer(start)),
    ])
}

fn subtraction(root: &Path, evidence: &serde_json::Value) -> Result<()> {
    let (package, pin) = selected_pair(root, evidence, "subtraction-constrained")?;
    for (start, end, expected) in [
        (0, 0, 0),
        (0, 1, 1),
        (2, 7, 5),
        (MAX_WORD, MAX_WORD, 0),
        (0, MAX_WORD, MAX_WORD),
    ] {
        check(
            &package,
            pin,
            range(start, end),
            record("value", Value::Integer(expected)),
        )?;
    }
    for (start, end) in [(1, 0), (MAX_WORD, 0)] {
        rejected(
            &package,
            pin,
            range(start, end),
            EvaluationError::InputConstraintFailed("where.0".into()),
        )?;
    }
    for input in [
        range(-1, 0),
        fields([("end", Value::Bool(false)), ("start", Value::Integer(0))]),
    ] {
        rejected(&package, pin, input, EvaluationError::InvalidInput)?;
    }
    println!("PUBLIC_PRIMITIVE_RUNTIME_OK subtraction-constrained: 5 inputs, 2 constraint and 2 type refusals");
    Ok(())
}

struct SliceSample {
    bytes: &'static [u8],
    start: i128,
    end: i128,
    expected: &'static [u8],
}

fn span(bytes: &[u8], start: i128, end: i128) -> Value {
    fields([
        ("bytes", Value::Bytes(bytes.into())),
        ("end", Value::Integer(end)),
        ("start", Value::Integer(start)),
    ])
}

const SLICES: [SliceSample; 7] = [
    SliceSample {
        bytes: b"",
        start: 0,
        end: 0,
        expected: b"",
    },
    SliceSample {
        bytes: b"abcd",
        start: 0,
        end: 4,
        expected: b"abcd",
    },
    SliceSample {
        bytes: b"abcd",
        start: 1,
        end: 3,
        expected: b"bc",
    },
    SliceSample {
        bytes: b"abcd",
        start: 4,
        end: 4,
        expected: b"",
    },
    SliceSample {
        bytes: b"\x00\xff\x80\n",
        start: 1,
        end: 3,
        expected: b"\xff\x80",
    },
    SliceSample {
        bytes: b"12345678",
        start: 0,
        end: 8,
        expected: b"12345678",
    },
    SliceSample {
        bytes: b"\xf0\x9f\x92\xa9",
        start: 1,
        end: 3,
        expected: b"\x9f\x92",
    },
];

fn slicing(root: &Path, evidence: &serde_json::Value) -> Result<()> {
    let (package, pin) = selected_pair(root, evidence, "byte-slice-intent")?;
    for case in SLICES {
        check(
            &package,
            pin,
            span(case.bytes, case.start, case.end),
            record("bytes", Value::Bytes(case.expected.into())),
        )?;
    }
    for (bytes, start, end) in [
        (b"abcd".as_slice(), 3, 2),
        (b"abcd", 0, 5),
        (b"abcd", 5, 5),
        (b"abcd", MAX_WORD, MAX_WORD),
        (b"", 0, 1),
    ] {
        rejected(
            &package,
            pin,
            span(bytes, start, end),
            EvaluationError::InputConstraintFailed("where.0".into()),
        )?;
    }
    for input in [span(b"123456789", 0, 0), span(b"", -1, 0)] {
        rejected(&package, pin, input, EvaluationError::InvalidInput)?;
    }
    println!(
        "PUBLIC_PRIMITIVE_RUNTIME_OK byte-slice-intent: 7 inputs, 5 constraint and 2 type refusals"
    );
    Ok(())
}

struct MetricSample {
    bytes: &'static [u8],
    index: i128,
    byte: i128,
    lines: i128,
    valid: bool,
}

fn metrics_input(bytes: &[u8], index: i128) -> Value {
    fields([
        ("bytes", Value::Bytes(bytes.into())),
        ("index", Value::Integer(index)),
    ])
}

const METRICS: [MetricSample; 12] = [
    MetricSample {
        bytes: b"",
        index: 0,
        byte: 0,
        lines: 0,
        valid: true,
    },
    MetricSample {
        bytes: b"A\nB\n",
        index: 0,
        byte: 65,
        lines: 2,
        valid: true,
    },
    MetricSample {
        bytes: b"A\nB\n",
        index: 1,
        byte: 10,
        lines: 2,
        valid: true,
    },
    MetricSample {
        bytes: b"A\nB\n",
        index: 4,
        byte: 0,
        lines: 2,
        valid: true,
    },
    MetricSample {
        bytes: b"\n\n\n\n\n\n\n\n",
        index: 7,
        byte: 10,
        lines: 8,
        valid: true,
    },
    MetricSample {
        bytes: b"\xf0\x9f\x92\xa9",
        index: 3,
        byte: 169,
        lines: 0,
        valid: true,
    },
    MetricSample {
        bytes: b"\xc0\xaf",
        index: 0,
        byte: 192,
        lines: 0,
        valid: false,
    },
    MetricSample {
        bytes: b"\xed\xa0\x80",
        index: 2,
        byte: 128,
        lines: 0,
        valid: false,
    },
    MetricSample {
        bytes: b"\xf4\x90\x80\x80",
        index: 0,
        byte: 244,
        lines: 0,
        valid: false,
    },
    MetricSample {
        bytes: b"\xe2\x82",
        index: 1,
        byte: 130,
        lines: 0,
        valid: false,
    },
    MetricSample {
        bytes: b"\x80\n",
        index: 0,
        byte: 128,
        lines: 1,
        valid: false,
    },
    MetricSample {
        bytes: b"A",
        index: MAX_WORD,
        byte: 0,
        lines: 0,
        valid: true,
    },
];

fn metrics(root: &Path, evidence: &serde_json::Value) -> Result<()> {
    let (package, pin) = selected_pair(root, evidence, "byte-metrics")?;
    for case in METRICS {
        check(
            &package,
            pin,
            metrics_input(case.bytes, case.index),
            fields([
                ("byte", Value::Integer(case.byte)),
                ("lines", Value::Integer(case.lines)),
                ("valid", Value::Bool(case.valid)),
            ]),
        )?;
    }
    for input in [metrics_input(b"123456789", 0), metrics_input(b"", -1)] {
        rejected(&package, pin, input, EvaluationError::InvalidInput)?;
    }
    println!("PUBLIC_PRIMITIVE_RUNTIME_OK byte-metrics: 12 inputs and 2 type refusals");
    Ok(())
}

pub(super) fn run_case(root: &Path, evidence: &serde_json::Value, name: &str) -> Result<()> {
    match name {
        "subtraction-constrained" => subtraction(root, evidence),
        "byte-slice-intent" => slicing(root, evidence),
        "byte-metrics" => metrics(root, evidence),
        _ => bail!("unknown primitive witness"),
    }
}
