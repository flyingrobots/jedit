// SPDX-License-Identifier: Apache-2.0 OR LicenseRef-MIND-UCAL-1.0
// © James Ross Ω FLYING•ROBOTS <https://github.com/flyingrobots>
//! Logical-text reference. This host supplies bytes and checks literal results;
//! it does not perform replacement or link the native rope planner.
use echo_edict_canonical::{
    decode_canonical_cbor_v1 as decode, encode_canonical_cbor_v1 as encode,
    CanonicalValueV1 as Value,
};
use std::{env, fs};
use warp_core::edict_pure::{evaluate, EvaluationError, EvaluationLimits};
const ID_BYTES: usize = 32;

fn package() -> (Vec<u8>, [u8; ID_BYTES]) {
    let bytes =
        fs::read(env::var("JEDIT_VERIFIED_PACKAGE").expect("package path")).expect("fresh package");
    let text = env::var("JEDIT_VERIFIED_PACKAGE_PIN").expect("independently verified pin");
    assert_eq!(text.len(), ID_BYTES * 2);
    let mut pin = [0; ID_BYTES];
    for (index, byte) in pin.iter_mut().enumerate() {
        *byte = u8::from_str_radix(&text[index * 2..index * 2 + 2], 16).expect("pin hex");
    }
    (bytes, pin)
}
fn limits() -> EvaluationLimits {
    EvaluationLimits {
        max_package_bytes: 32_768,
        max_input_bytes: 4_194_304,
        max_steps: 8_388_608,
        max_allocated_bytes: 16_777_216,
        max_output_bytes: 4_194_304,
    }
}
fn input(original: &[u8], start: u64, end: u64, replacement: &[u8]) -> Vec<u8> {
    encode(&Value::Map(vec![
        (
            Value::Text("bufferId".into()),
            Value::Bytes(vec![1; ID_BYTES]),
        ),
        (
            Value::Text("basisHeadId".into()),
            Value::Bytes(vec![2; ID_BYTES]),
        ),
        (Value::Text("text".into()), Value::Bytes(original.to_vec())),
        (
            Value::Text("startByte".into()),
            Value::Integer(start.into()),
        ),
        (Value::Text("endByte".into()), Value::Integer(end.into())),
        (
            Value::Text("replacement".into()),
            Value::Bytes(replacement.to_vec()),
        ),
    ]))
    .expect("canonical input")
}
fn updated_text(output: &[u8]) -> Vec<u8> {
    let Value::Map(fields) = decode(output).expect("canonical result") else {
        panic!("record result")
    };
    let value = fields
        .into_iter()
        .find(|(key, _)| *key == Value::Text("updatedText".into()))
        .expect("authored replacement result")
        .1;
    let Value::Bytes(bytes) = value else {
        panic!("bounded byte result")
    };
    bytes
}
#[test]
fn compiled_flat_text_replacement_matches_literal_utf8_cases() {
    let (package, pin) = package();
    for (name, before, start, end, replacement, expected) in [
        ("empty", "", 0, 0, "λ\r\n", "λ\r\n"),
        ("prefix", "world", 0, 0, "hello ", "hello world"),
        ("suffix", "hello", 5, 5, " 🌍", "hello 🌍"),
        ("replace", "hello world", 6, 11, "λ", "hello λ"),
        ("delete", "AλB", 1, 3, "", "AB"),
        ("crlf", "one\r\ntwo\r\n", 5, 8, "three", "one\r\nthree\r\n"),
        ("whole", "αβ", 0, 4, "🙂", "🙂"),
        ("multibyte", "a🙂z", 1, 5, "é", "aéz"),
        ("nul", "A\0B", 1, 2, "λ", "AλB"),
    ] {
        let supplied = input(before.as_bytes(), start, end, replacement.as_bytes());
        let result = evaluate(&package, pin, &supplied, limits())
            .unwrap_or_else(|error| panic!("{name}: {error:?}"));
        assert_eq!(updated_text(&result.output), expected.as_bytes(), "{name}");
        assert_eq!(
            result,
            evaluate(&package, pin, &supplied, limits()).expect("repeat"),
            "{name}"
        );
        assert!(result.steps > 0 && result.allocated_bytes > 0);
    }
    println!("JEDIT_EDICT_FLAT_TEXT_RUNTIME_OK");
}

#[test]
fn compiled_flat_text_replacement_refuses_invalid_utf8_boundaries_and_noops() {
    let (package, pin) = package();
    for (name, before, start, end, replacement) in [
        ("invalid-original", &b"A\xffB"[..], 0, 0, &b"X"[..]),
        ("invalid-replacement", &b"ABC"[..], 1, 2, &b"\xff"[..]),
        ("overlong", &[0xc0, 0x80][..], 0, 0, &b"X"[..]),
        ("surrogate", &[0xed, 0xa0, 0x80][..], 0, 0, &b"X"[..]),
        (
            "past-unicode",
            &[0xf4, 0x90, 0x80, 0x80][..],
            0,
            0,
            &b"X"[..],
        ),
        ("truncated", &[0xe2, 0x82][..], 0, 0, &b"X"[..]),
        ("start-inside-lambda", "aλz".as_bytes(), 2, 3, &b"X"[..]),
        ("end-inside-lambda", "aλz".as_bytes(), 1, 2, &b"X"[..]),
        ("inside-emoji", "a🙂z".as_bytes(), 2, 4, &b"X"[..]),
        ("unchanged-lambda", "AλB".as_bytes(), 1, 3, "λ".as_bytes()),
        ("empty-noop", &b""[..], 0, 0, &b""[..]),
        ("reversed", &b"ABC"[..], 2, 1, &b"X"[..]),
        ("past-end", &b"ABC"[..], 1, 4, &b"X"[..]),
    ] {
        assert_eq!(
            evaluate(
                &package,
                pin,
                &input(before, start, end, replacement),
                limits()
            ),
            Err(warp_core::edict_pure::EvaluationError::InputConstraintFailed("where.0".into())),
            "{name}"
        );
    }
}

#[test]
fn public_utf8_replacement_refuses_each_host_resource_aperture() {
    let (package, pin) = package();
    let input = input(b"abc", 1, 2, b"X");
    for (limits, error) in [
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
                max_input_bytes: input.len() - 1,
                ..limits()
            },
            EvaluationError::InputTooLarge,
        ),
        (
            EvaluationLimits {
                max_package_bytes: package.len() - 1,
                ..limits()
            },
            EvaluationError::PackageTooLarge,
        ),
    ] {
        assert_eq!(evaluate(&package, pin, &input, limits), Err(error));
    }
}
