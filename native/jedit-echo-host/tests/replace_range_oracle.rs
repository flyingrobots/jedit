#[path = "support/replace_range_oracle.rs"]
mod oracle_support;
#[path = "support/resource_fixture.rs"]
mod resource_fixture;

use std::path::PathBuf;

use jedit_echo_host::records::{fact_type_id, BufferFact, HeadFact};
use oracle_support::{
    canonical_corpus_bytes, generate_corpus, BasisSetup, CaseSpec, ExpectedPosture,
    SemanticObstructionCode,
};
use resource_fixture::{checked_sha256, sha256_hex, update_resource_pair};

const UPDATE_ENV: &str = "JEDIT_UPDATE_REPLACE_RANGE_ORACLE";
const EXPECTED_CORPUS_SHA256: &str = include_str!(
    "../../../contracts/jedit/lawpacks/replace-range-v1/replace-range-v1.oracle.sha256"
);

#[test]
fn replace_range_oracle_matches_the_committed_corpus() {
    let first = canonical_corpus_bytes(&generate_corpus(cases()));
    let second = canonical_corpus_bytes(&generate_corpus(cases()));
    assert_eq!(first, second, "fresh oracle generation must be byte-stable");

    let path = corpus_path();
    if update_resource_pair(UPDATE_ENV, &path, &corpus_digest_path(), &first) {
        return;
    }
    let committed = std::fs::read(&path).expect("committed oracle corpus should exist");
    assert_eq!(
        first, committed,
        "run with {UPDATE_ENV}=1 to update intentionally"
    );
    assert_eq!(
        sha256_hex(&committed),
        checked_sha256(EXPECTED_CORPUS_SHA256),
        "oracle resource digest must be updated deliberately"
    );
}

#[test]
fn basis_obstructions_name_real_retained_heads() {
    let corpus: serde_json::Value = serde_json::from_slice(
        &std::fs::read(corpus_path()).expect("committed oracle corpus should exist"),
    )
    .expect("committed oracle corpus should decode");
    let cases = corpus["cases"]
        .as_array()
        .expect("oracle cases should be an array");

    assert_retained_basis(cases, "stale-basis", true);
    assert_retained_basis(cases, "foreign-basis", false);
}

#[test]
fn source_set_binds_native_dependency_selection() {
    let corpus: serde_json::Value = serde_json::from_slice(
        &std::fs::read(corpus_path()).expect("committed oracle corpus should exist"),
    )
    .expect("committed oracle corpus should decode");
    let paths = corpus["sourceSet"]["paths"]
        .as_array()
        .expect("source-set paths should be an array");
    for required in [
        "native/jedit-echo-host/Cargo.toml",
        "native/jedit-echo-host/Cargo.lock",
    ] {
        assert!(
            paths.iter().any(|path| path == required),
            "source set must bind {required}"
        );
    }
}

fn assert_retained_basis(cases: &[serde_json::Value], case_id: &str, same_buffer: bool) {
    let case = cases
        .iter()
        .find(|case| case["id"] == case_id)
        .unwrap_or_else(|| panic!("{case_id} should exist"));
    let invocation_buffer_id = case["invocation"]["bufferId"]
        .as_str()
        .expect("invocation buffer should be a string");
    let invocation_basis_id = case["invocation"]["basisHeadId"]
        .as_str()
        .expect("invocation basis should be a string");
    let facts = case["basisFacts"]
        .as_array()
        .expect("basis facts should be an array");
    let head_type_id = hex::encode(fact_type_id::<HeadFact>().as_bytes());
    let retained_head = facts
        .iter()
        .find(|fact| fact["nodeId"] == invocation_basis_id && fact["typeId"] == head_type_id)
        .unwrap_or_else(|| panic!("{case_id} basis should be a retained Head fact"));
    let head: HeadFact = serde_json::from_slice(
        &hex::decode(
            retained_head["attachmentBytesHex"]
                .as_str()
                .expect("head bytes should be hexadecimal"),
        )
        .expect("head bytes should decode"),
    )
    .expect("retained head should decode");
    let head_buffer_id = hex::encode(head.buffer_id.0);
    assert_eq!(
        head_buffer_id == invocation_buffer_id,
        same_buffer,
        "{case_id} buffer relationship drifted"
    );

    let buffer_type_id = hex::encode(fact_type_id::<BufferFact>().as_bytes());
    let retained_buffer = facts
        .iter()
        .find(|fact| fact["nodeId"] == invocation_buffer_id && fact["typeId"] == buffer_type_id)
        .unwrap_or_else(|| panic!("{case_id} target Buffer fact should be retained"));
    let buffer: BufferFact = serde_json::from_slice(
        &hex::decode(
            retained_buffer["attachmentBytesHex"]
                .as_str()
                .expect("buffer bytes should be hexadecimal"),
        )
        .expect("buffer bytes should decode"),
    )
    .expect("retained buffer should decode");
    assert_ne!(
        invocation_basis_id,
        hex::encode(buffer.canonical_head_id.0),
        "{case_id} must not use the current canonical head"
    );
}

fn corpus_path() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("../../contracts/jedit/lawpacks/replace-range-v1/replace-range-v1.oracle.json")
}

fn corpus_digest_path() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("../../contracts/jedit/lawpacks/replace-range-v1/replace-range-v1.oracle.sha256")
}

fn cases() -> Vec<CaseSpec> {
    vec![
        success("empty-unicode-insert", "", BasisSetup::Empty, 0, 0, "猫\n"),
        success("middle-ascii-insert", "abcd", BasisSetup::Plain, 2, 2, "XY"),
        success("whole-buffer-delete", "abc", BasisSetup::Plain, 0, 3, ""),
        success(
            "unicode-replacement",
            "A😀é\nB",
            BasisSetup::Plain,
            1,
            5,
            "λ\n",
        ),
        success(
            "cross-leaf-rebalance",
            &format!(
                "{}{}{}",
                "a".repeat(4096),
                "b".repeat(4096),
                "c".repeat(4096)
            ),
            BasisSetup::Plain,
            4094,
            8194,
            "β\nZ",
        ),
        success(
            "replacement-larger-than-leaf",
            "edges",
            BasisSetup::Plain,
            0,
            5,
            &format!("{}\n", "猫".repeat(1400)),
        ),
        obstruction(
            "reversed-range",
            "abc",
            BasisSetup::Plain,
            2,
            1,
            "x",
            SemanticObstructionCode::RangeOrderInvalid,
            "invalid-request",
            "exceeds",
        ),
        obstruction(
            "out-of-bounds-range",
            "abc",
            BasisSetup::Plain,
            0,
            4,
            "x",
            SemanticObstructionCode::RangeOutOfBounds,
            "invalid-request",
            "exceeds",
        ),
        obstruction(
            "start-inside-codepoint",
            "A😀B",
            BasisSetup::Plain,
            2,
            5,
            "x",
            SemanticObstructionCode::Utf8BoundaryInvalid,
            "invalid-request",
            "splits a UTF-8 code point",
        ),
        obstruction(
            "end-inside-codepoint",
            "A😀B",
            BasisSetup::Plain,
            1,
            4,
            "x",
            SemanticObstructionCode::Utf8BoundaryInvalid,
            "invalid-request",
            "splits a UTF-8 code point",
        ),
        obstruction(
            "empty-no-op",
            "abc",
            BasisSetup::Plain,
            1,
            1,
            "",
            SemanticObstructionCode::NoOp,
            "invalid-request",
            "no-op",
        ),
        obstruction(
            "identical-no-op",
            "abc",
            BasisSetup::Plain,
            0,
            3,
            "abc",
            SemanticObstructionCode::NoOp,
            "invalid-request",
            "no-op",
        ),
        obstruction(
            "stale-basis",
            "abc",
            BasisSetup::StaleHead,
            0,
            1,
            "x",
            SemanticObstructionCode::BasisNotCanonical,
            "invalid-request",
            "stale replace basis",
        ),
        obstruction(
            "foreign-basis",
            "abc",
            BasisSetup::ForeignHead,
            0,
            1,
            "x",
            SemanticObstructionCode::BasisNotCanonical,
            "invalid-request",
            "stale replace basis",
        ),
        obstruction(
            "head-sequence-overflow",
            "abc",
            BasisSetup::SequenceOverflow,
            0,
            1,
            "x",
            SemanticObstructionCode::ArithmeticOverflow,
            "malformed-fact",
            "head sequence overflow",
        ),
        obstruction(
            "buffer-version-overflow",
            "abc",
            BasisSetup::VersionOverflow,
            0,
            1,
            "x",
            SemanticObstructionCode::ArithmeticOverflow,
            "malformed-fact",
            "buffer version overflow",
        ),
        obstruction(
            "missing-buffer",
            "",
            BasisSetup::MissingBuffer,
            0,
            0,
            "x",
            SemanticObstructionCode::FactMissing,
            "missing-fact",
            "BufferWorldline",
        ),
        obstruction(
            "malformed-buffer",
            "abc",
            BasisSetup::MalformedBuffer,
            0,
            1,
            "x",
            SemanticObstructionCode::FactMalformed,
            "malformed-fact",
            "decode",
        ),
        obstruction(
            "bad-blob-content-hash",
            "abc",
            BasisSetup::BadBlobContentHash,
            0,
            1,
            "x",
            SemanticObstructionCode::ContentIdentityMismatch,
            "malformed-fact",
            "content hash does not match",
        ),
        obstruction(
            "coordinate-above-graphql-int",
            "",
            BasisSetup::AboveGraphqlIntRange,
            i32::MAX as u64 + 1,
            i32::MAX as u64 + 1,
            "x",
            SemanticObstructionCode::MalformedRope,
            "invalid-request",
            "split exceeds empty rope",
        ),
    ]
}

fn success(
    id: &'static str,
    initial_text: &str,
    setup: BasisSetup,
    start_byte: u64,
    end_byte: u64,
    replacement: &str,
) -> CaseSpec {
    CaseSpec {
        id,
        purpose: "finite persistent-rope ReplaceRange conformance witness",
        initial_text: initial_text.to_owned(),
        setup,
        start_byte,
        end_byte,
        replacement: replacement.to_owned(),
        expected: ExpectedPosture::Success,
    }
}

#[allow(clippy::too_many_arguments)]
fn obstruction(
    id: &'static str,
    initial_text: &str,
    setup: BasisSetup,
    start_byte: u64,
    end_byte: u64,
    replacement: &str,
    semantic_code: SemanticObstructionCode,
    error_class: &'static str,
    message_fragment: &'static str,
) -> CaseSpec {
    CaseSpec {
        id,
        purpose: "typed no-plan ReplaceRange obstruction witness",
        initial_text: initial_text.to_owned(),
        setup,
        start_byte,
        end_byte,
        replacement: replacement.to_owned(),
        expected: ExpectedPosture::Obstruction {
            semantic_code,
            error_class,
            message_fragment,
        },
    }
}
