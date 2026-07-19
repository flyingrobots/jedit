use std::ffi::OsStr;
use std::fs;
use std::path::Path;

use sha2::{Digest, Sha256};

pub fn checked_sha256(value: &str) -> &str {
    let digest = value
        .strip_suffix('\n')
        .expect("digest resource should end with exactly one newline");
    assert_eq!(digest.len(), 64, "digest should contain 64 characters");
    assert!(
        digest
            .bytes()
            .all(|byte| byte.is_ascii_digit() || (b'a'..=b'f').contains(&byte)),
        "digest should contain lowercase hexadecimal only"
    );
    digest
}

pub fn sha256_hex(bytes: &[u8]) -> String {
    hex::encode(Sha256::digest(bytes))
}

pub fn update_resource_pair(
    env_name: &str,
    resource_path: &Path,
    digest_path: &Path,
    bytes: &[u8],
) -> bool {
    match std::env::var_os(env_name) {
        None => false,
        Some(value) if value == OsStr::new("1") => {
            write_atomically(resource_path, bytes);
            let digest = format!("{}\n", sha256_hex(bytes));
            write_atomically(digest_path, digest.as_bytes());
            true
        }
        Some(value) => {
            panic!("{env_name} must be exactly 1 to update fixtures, received {value:?}")
        }
    }
}

fn write_atomically(path: &Path, bytes: &[u8]) {
    let file_name = path
        .file_name()
        .and_then(OsStr::to_str)
        .expect("resource path should have a UTF-8 file name");
    let temporary = path.with_file_name(format!(".{file_name}.{}.tmp", std::process::id()));
    fs::write(&temporary, bytes).expect("temporary resource should write");
    fs::rename(&temporary, path).expect("temporary resource should replace destination");
}
