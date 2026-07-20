use serde::Serialize;
use sha2::{Digest, Sha256};

pub const SOURCE_SET_ALGORITHM: &str = "sha256";
pub const SOURCE_SET_DOMAIN: &[u8] = b"jedit.replace-range.oracle-source.v1\0";
pub const SOURCE_SET_FRAMING: &str =
    "domain || repeated(u32be-path-length || path-utf8 || u64be-byte-length || bytes)";
const SOURCE_SET_FILES: &[(&str, &[u8])] = &[
    (
        "native/jedit-echo-host/Cargo.toml",
        include_bytes!("../../Cargo.toml"),
    ),
    (
        "native/jedit-echo-host/Cargo.lock",
        include_bytes!("../../Cargo.lock"),
    ),
    (
        "native/jedit-echo-host/src/error.rs",
        include_bytes!("../../src/error.rs"),
    ),
    (
        "native/jedit-echo-host/src/identity.rs",
        include_bytes!("../../src/identity.rs"),
    ),
    (
        "native/jedit-echo-host/src/records.rs",
        include_bytes!("../../src/records.rs"),
    ),
    (
        "native/jedit-echo-host/src/rope.rs",
        include_bytes!("../../src/rope.rs"),
    ),
    (
        "native/jedit-echo-host/src/rope/tree.rs",
        include_bytes!("../../src/rope/tree.rs"),
    ),
    (
        "native/jedit-echo-host/src/rope/window.rs",
        include_bytes!("../../src/rope/window.rs"),
    ),
    (
        "native/jedit-echo-host/tests/replace_range_oracle.rs",
        include_bytes!("../replace_range_oracle.rs"),
    ),
    (
        "native/jedit-echo-host/tests/support/replace_range_basis.rs",
        include_bytes!("replace_range_basis.rs"),
    ),
    (
        "native/jedit-echo-host/tests/support/replace_range_contract.rs",
        include_bytes!("replace_range_contract.rs"),
    ),
    (
        "native/jedit-echo-host/tests/support/replace_range_consequence.rs",
        include_bytes!("replace_range_consequence.rs"),
    ),
    (
        "native/jedit-echo-host/tests/support/replace_range_consequence_tests.rs",
        include_bytes!("replace_range_consequence_tests.rs"),
    ),
    (
        "native/jedit-echo-host/tests/support/replace_range_oracle.rs",
        include_bytes!("replace_range_oracle.rs"),
    ),
    (
        "native/jedit-echo-host/tests/support/replace_range_oracle_tests.rs",
        include_bytes!("replace_range_oracle_tests.rs"),
    ),
    (
        "native/jedit-echo-host/tests/support/replace_range_source_set.rs",
        include_bytes!("replace_range_source_set.rs"),
    ),
];

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceSet {
    pub algorithm: &'static str,
    pub domain_hex: String,
    pub framing: &'static str,
    pub paths: Vec<&'static str>,
    pub digest_hex: String,
}

pub fn source_set() -> SourceSet {
    SourceSet {
        algorithm: SOURCE_SET_ALGORITHM,
        domain_hex: hex::encode(SOURCE_SET_DOMAIN),
        framing: SOURCE_SET_FRAMING,
        paths: expected_source_paths(),
        digest_hex: expected_source_digest_hex(),
    }
}

pub fn expected_source_paths() -> Vec<&'static str> {
    SOURCE_SET_FILES.iter().map(|(path, _)| *path).collect()
}

pub fn expected_source_digest_hex() -> String {
    let mut digest = Sha256::new();
    digest.update(SOURCE_SET_DOMAIN);
    for (path, bytes) in SOURCE_SET_FILES {
        digest.update((path.len() as u32).to_be_bytes());
        digest.update(path.as_bytes());
        digest.update((bytes.len() as u64).to_be_bytes());
        digest.update(bytes);
    }
    hex::encode(digest.finalize())
}
