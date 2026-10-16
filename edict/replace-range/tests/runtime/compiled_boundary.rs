// SPDX-License-Identifier: Apache-2.0 OR LicenseRef-MIND-UCAL-1.0
// © James Ross Ω FLYING•ROBOTS <https://github.com/flyingrobots>
//! Test-only trusted host. No native Jedit planner or product host is linked.

use std::{env, fs};

use echo_edict_canonical::{encode_canonical_cbor_v1 as encode, CanonicalValueV1 as Value};
use warp_core::edict_pure::{evaluate, EvaluationError, EvaluationLimits};

const ID_BYTES: usize = 32;
const MAX_PACKAGE_BYTES: usize = 32_768;
const MAX_INPUT_BYTES: usize = 2_097_152;
const MAX_STEPS: u64 = 10_000;
const MAX_ALLOCATED_BYTES: u64 = 16_777_216;
const MAX_OUTPUT_BYTES: u64 = 2_097_152;

fn record(fields: impl IntoIterator<Item = (&'static str, Value)>) -> Value {
    Value::Map(
        fields
            .into_iter()
            .map(|(name, value)| (Value::Text(name.into()), value))
            .collect(),
    )
}

fn input(start: u64, end: u64, buffer_id_size: usize) -> Vec<u8> {
    encode(&record([
        ("bufferId", Value::Bytes(vec![1; buffer_id_size])),
        ("basisHeadId", Value::Bytes(vec![2; ID_BYTES])),
        ("startByte", Value::Integer(start.into())),
        ("endByte", Value::Integer(end.into())),
        ("replacement", Value::Bytes("λ\r\n".as_bytes().to_vec())),
    ]))
    .expect("canonical input")
}

fn limits() -> EvaluationLimits {
    EvaluationLimits {
        max_package_bytes: MAX_PACKAGE_BYTES,
        max_input_bytes: MAX_INPUT_BYTES,
        max_steps: MAX_STEPS,
        max_allocated_bytes: MAX_ALLOCATED_BYTES,
        max_output_bytes: MAX_OUTPUT_BYTES,
    }
}

#[test]
fn freshly_compiled_boundary_executes() {
    // The driver validates the separate verifier report and build locks before
    // supplying this pin. This fixture alone does not establish authorization.
    let package = fs::read(env::var("JEDIT_VERIFIED_PACKAGE").expect("package path"))
        .expect("fresh compiler package");
    let pin_text = env::var("JEDIT_VERIFIED_PACKAGE_PIN").expect("verified package pin");
    assert_eq!(pin_text.len(), ID_BYTES * 2);
    let mut pin = [0; ID_BYTES];
    for (index, byte) in pin.iter_mut().enumerate() {
        *byte = u8::from_str_radix(&pin_text[index * 2..index * 2 + 2], 16)
            .expect("hexadecimal package pin");
    }

    // Literal expectations catch a skipped helper, constant result, wrong
    // branch, or changed field projection without reproducing the evaluator.
    for (start, end, range_is_empty) in [(7, 7, 1), (7, 11, 0)] {
        let supplied = input(start, end, ID_BYTES);
        let result = evaluate(&package, pin, &supplied, limits()).expect("pure result");
        let expected = record([
            ("bufferId", Value::Bytes(vec![1; ID_BYTES])),
            ("basisHeadId", Value::Bytes(vec![2; ID_BYTES])),
            ("startByte", Value::Integer(start.into())),
            ("endByte", Value::Integer(end.into())),
            ("replacement", Value::Bytes("λ\r\n".as_bytes().to_vec())),
            ("rangeIsEmpty", Value::Integer(range_is_empty)),
            ("createdLeafCeiling", Value::Integer(4096)),
        ]);
        assert_eq!(result.output, encode(&expected).expect("expected result"));
        assert_eq!(
            result,
            evaluate(&package, pin, &supplied, limits()).unwrap()
        );
        assert!(result.steps > 0);
        assert!(result.allocated_bytes > 0);
    }
    assert_eq!(
        evaluate(&package, pin, &input(11, 7, ID_BYTES), limits()),
        Err(EvaluationError::InputConstraintFailed("where.0".into()))
    );
    assert_eq!(
        evaluate(&package, pin, &input(7, 11, ID_BYTES - 1), limits()),
        Err(EvaluationError::InvalidInput)
    );
    pin[0] ^= 1;
    assert_eq!(
        evaluate(&package, pin, &input(7, 11, ID_BYTES), limits()),
        Err(EvaluationError::PackageIdentityMismatch)
    );
    // The driver requires this marker, so zero discovered tests cannot pass.
    println!("JEDIT_EDICT_PURE_RUNTIME_OK");
}
