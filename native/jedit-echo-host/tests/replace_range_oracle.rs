#[path = "support/replace_range_oracle.rs"]
mod oracle_support;
#[path = "support/resource_fixture.rs"]
mod resource_fixture;

use std::path::PathBuf;

use oracle_support::{
    canonical_corpus_bytes, generate_corpus, BasisSetup, CaseSpec, ExpectedPosture,
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
            "range-order-invalid",
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
            "range-out-of-bounds",
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
            "utf8-boundary-invalid",
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
            "utf8-boundary-invalid",
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
            "no-op",
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
            "no-op",
            "invalid-request",
            "no-op",
        ),
        CaseSpec {
            id: "noncanonical-basis",
            purpose: "exact canonical-head equality covers stale and foreign basis posture",
            initial_text: "abc".to_owned(),
            setup: BasisSetup::Plain,
            basis_override: Some([0xA5; 32]),
            start_byte: 0,
            end_byte: 1,
            replacement: "x".to_owned(),
            expected: ExpectedPosture::Obstruction {
                semantic_code: "basis-not-canonical",
                error_class: "invalid-request",
                message_fragment: "stale replace basis",
            },
        },
        obstruction(
            "head-sequence-overflow",
            "abc",
            BasisSetup::SequenceOverflow,
            0,
            1,
            "x",
            "arithmetic-overflow",
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
            "arithmetic-overflow",
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
            "fact-missing",
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
            "fact-malformed",
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
            "content-identity-mismatch",
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
            "malformed-rope",
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
        basis_override: None,
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
    semantic_code: &'static str,
    error_class: &'static str,
    message_fragment: &'static str,
) -> CaseSpec {
    CaseSpec {
        id,
        purpose: "typed no-plan ReplaceRange obstruction witness",
        initial_text: initial_text.to_owned(),
        setup,
        basis_override: None,
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
