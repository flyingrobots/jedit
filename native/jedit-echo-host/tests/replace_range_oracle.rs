#[path = "support/replace_range_basis_witness.rs"]
mod basis_witness;
#[path = "support/replace_range_oracle.rs"]
mod oracle_support;
#[path = "support/resource_fixture.rs"]
mod resource_fixture;

use std::path::PathBuf;

use basis_witness::{
    assert_retained_basis, corrupt_foreign_canonical_head, corrupt_stale_ancestry,
};
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
fn basis_witness_rejects_false_stale_and_foreign_relationships() {
    let corpus: serde_json::Value = serde_json::from_slice(
        &std::fs::read(corpus_path()).expect("committed oracle corpus should exist"),
    )
    .expect("committed oracle corpus should decode");

    let mut stale_cases = corpus["cases"]
        .as_array()
        .expect("oracle cases should be an array")
        .clone();
    corrupt_stale_ancestry(&mut stale_cases);
    assert!(
        std::panic::catch_unwind(|| assert_retained_basis(&stale_cases, "stale-basis", true))
            .is_err(),
        "stale witness accepted a current Head without stale ancestry"
    );

    let mut foreign_cases = corpus["cases"]
        .as_array()
        .expect("oracle cases should be an array")
        .clone();
    corrupt_foreign_canonical_head(&mut foreign_cases);
    assert!(
        std::panic::catch_unwind(|| {
            assert_retained_basis(&foreign_cases, "foreign-basis", false);
        })
        .is_err(),
        "foreign witness accepted a Buffer that did not name the invocation Head"
    );
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
        "native/jedit-echo-host/src/rope/fact_read.rs",
    ] {
        assert!(
            paths.iter().any(|path| path == required),
            "source set must bind {required}"
        );
    }
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
            "start must not exceed end",
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
            "empty-range-inside-codepoint",
            "A😀B",
            BasisSetup::Plain,
            2,
            2,
            "",
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
            "branch-extent-mismatch-at-zero",
            &format!("{}b", "a".repeat(4096)),
            BasisSetup::BranchExtentMismatch,
            0,
            0,
            "x",
            SemanticObstructionCode::FactMalformed,
            "malformed-fact",
            "branch byte length does not match children",
        ),
        obstruction(
            "branch-extent-mismatch-at-exact-end",
            &format!("{}b", "a".repeat(4096)),
            BasisSetup::BranchExtentMismatch,
            4098,
            4098,
            "x",
            SemanticObstructionCode::FactMalformed,
            "malformed-fact",
            "branch byte length does not match children",
        ),
        obstruction(
            "branch-extent-mismatch-at-internal-boundary",
            &format!("{}b", "a".repeat(4096)),
            BasisSetup::BranchExtentMismatch,
            4096,
            4096,
            "x",
            SemanticObstructionCode::FactMalformed,
            "malformed-fact",
            "branch byte length does not match children",
        ),
        obstruction(
            "cyclic-right-endpoint",
            "abc",
            BasisSetup::CyclicRightEndpoint,
            3,
            3,
            "x",
            SemanticObstructionCode::FactMalformed,
            "malformed-fact",
            "rope node cycle",
        ),
        obstruction(
            "leaf-ends-inside-codepoint-at-exact-end",
            "é",
            BasisSetup::LeafEndsInsideCodepointAtExactEnd,
            1,
            1,
            "x",
            SemanticObstructionCode::Utf8BoundaryInvalid,
            "invalid-request",
            "splits a UTF-8 code point",
        ),
        obstruction(
            "leaf-exceeds-blob-at-zero",
            "abc",
            BasisSetup::LeafExceedsBlobAtExactEnd,
            0,
            0,
            "x",
            SemanticObstructionCode::FactMalformed,
            "malformed-fact",
            "exceeds blob bounds",
        ),
        obstruction(
            "leaf-exceeds-blob-at-exact-end",
            "abc",
            BasisSetup::LeafExceedsBlobAtExactEnd,
            4,
            4,
            "x",
            SemanticObstructionCode::FactMalformed,
            "malformed-fact",
            "exceeds blob bounds",
        ),
        obstruction(
            "leaf-exceeds-blob-at-internal-boundary",
            &format!("{}b", "a".repeat(4096)),
            BasisSetup::LeafExceedsBlobAtInternalBoundary,
            4096,
            4096,
            "x",
            SemanticObstructionCode::FactMalformed,
            "malformed-fact",
            "exceeds blob bounds",
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
        obstruction(
            "leaf-range-start-overflow",
            "ab",
            BasisSetup::LeafRangeStartOverflow,
            1,
            2,
            "x",
            SemanticObstructionCode::ArithmeticOverflow,
            "malformed-fact",
            "leaf range start overflow",
        ),
        obstruction(
            "leaf-range-end-overflow",
            "a",
            BasisSetup::LeafRangeEndOverflow,
            0,
            1,
            "x",
            SemanticObstructionCode::ArithmeticOverflow,
            "malformed-fact",
            "leaf range end overflow",
        ),
        obstruction(
            "rope-node-end-overflow",
            &format!("{}b", "a".repeat(4096)),
            BasisSetup::RopeNodeEndOverflow,
            0,
            1,
            "x",
            SemanticObstructionCode::ArithmeticOverflow,
            "malformed-fact",
            "rope node end overflow",
        ),
        obstruction(
            "leaf-extent-u64-max-at-zero",
            "a",
            BasisSetup::LeafExtentU64MaxAtZero,
            0,
            0,
            "x",
            SemanticObstructionCode::FactMalformed,
            "malformed-fact",
            "exceeds blob bounds",
        ),
        obstruction(
            "rope-utf16-length-overflow",
            "a",
            BasisSetup::RopeUtf16LengthOverflow,
            0,
            0,
            "x",
            SemanticObstructionCode::ArithmeticOverflow,
            "malformed-fact",
            "rope UTF-16 length overflow",
        ),
        obstruction(
            "rope-line-break-count-overflow",
            "a",
            BasisSetup::RopeLineBreakCountOverflow,
            0,
            0,
            "\n",
            SemanticObstructionCode::ArithmeticOverflow,
            "malformed-fact",
            "rope line break count overflow",
        ),
        obstruction(
            "branch-height-u32-max-at-zero",
            &format!("{}b", "a".repeat(4096)),
            BasisSetup::BranchHeightU32MaxAtZero,
            0,
            0,
            "x",
            SemanticObstructionCode::FactMalformed,
            "malformed-fact",
            "branch height does not match children",
        ),
        obstruction(
            "head-line-count-overflow",
            "a",
            BasisSetup::HeadLineCountOverflow,
            1,
            1,
            "x",
            SemanticObstructionCode::ArithmeticOverflow,
            "malformed-fact",
            "head line count overflow",
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
