//! Reopening a buffer is decided by its anchored import, never by trust.
//!
//! Opening a file records, in the same admitted Tick that creates the buffer,
//! which file bytes (by digest) the buffer's first head was built from. On
//! reopen the host compares the file's current basis with that anchor. It
//! reuses the buffer only when they match, and otherwise refuses with a typed
//! obstruction without touching the buffer, so neither the disk nor the rope
//! silently wins. Every case is checked across a host restart, which recovers
//! the anchor from the Echo WAL.

use jedit_echo_host::host::JeditEchoHost;
use jedit_echo_host::protocol::{BufferResponse, HostBasis, HostRequest, HostResponse};

const ORIGINAL: &str = "hello";
const ORIGINAL_DIGEST: &str = "1111111111111111111111111111111111111111111111111111111111111111";
const CHANGED_DIGEST: &str = "2222222222222222222222222222222222222222222222222222222222222222";

fn file_basis(sha256: &str, byte_length: u64) -> HostBasis {
    HostBasis::File {
        sha256: sha256.to_owned(),
        byte_length,
    }
}

fn original_basis() -> HostBasis {
    file_basis(ORIGINAL_DIGEST, ORIGINAL.len() as u64)
}

fn changed_basis() -> HostBasis {
    file_basis(CHANGED_DIGEST, 21)
}

fn open(
    host: &mut JeditEchoHost,
    request_id: u64,
    initial_text: &str,
    basis: HostBasis,
) -> HostResponse {
    host.handle(HostRequest::Open {
        request_id,
        buffer_key: "anchored.txt".to_owned(),
        initial_text: initial_text.to_owned(),
        projection_path: Some("/tmp/anchored.txt".to_owned()),
        host_basis: basis,
    })
}

fn opened(response: HostResponse) -> (BufferResponse, String, HostBasis) {
    let HostResponse::Opened {
        buffer,
        import_anchor,
        ..
    } = response
    else {
        panic!("expected an opened buffer, got {response:?}");
    };
    (buffer, import_anchor.head_id, import_anchor.host_basis)
}

fn obstruction_code(response: HostResponse) -> String {
    let HostResponse::Obstructed { code, .. } = response else {
        panic!("expected an obstruction, got {response:?}");
    };
    code
}

fn text(host: &mut JeditEchoHost, request_id: u64, buffer: &BufferResponse) -> String {
    let HostResponse::Observed { window, .. } = host.handle(HostRequest::Observe {
        request_id,
        buffer_id: buffer.buffer_id.clone(),
        basis_head_id: buffer.head_id.clone(),
        start_byte: 0,
        end_byte: buffer.byte_length,
        max_bytes: 256,
    }) else {
        panic!("the buffer should be observable");
    };
    window.text
}

/// Opens the original file and, when `edit` is set, appends an unsaved edit.
/// Returns the buffer as left before the restart.
fn import_then_restart(root: &std::path::Path, edit: bool) -> (BufferResponse, String) {
    let mut host = JeditEchoHost::open(root).expect("Echo host should initialize");
    let (buffer, anchor_head, anchor_basis) =
        opened(open(&mut host, 1, ORIGINAL, original_basis()));
    assert_eq!(
        anchor_head, buffer.head_id,
        "the anchor names the imported head"
    );
    assert_eq!(
        anchor_basis,
        original_basis(),
        "the anchor names the imported bytes"
    );
    if !edit {
        return (buffer, anchor_head);
    }
    let HostResponse::Applied { buffer: edited, .. } = host.handle(HostRequest::Replace {
        request_id: 2,
        buffer_id: buffer.buffer_id.clone(),
        start_byte: 5,
        end_byte: 5,
        insert_text: " world".to_owned(),
    }) else {
        panic!("the unsaved edit should apply");
    };
    (edited, anchor_head)
}

#[test]
fn an_unchanged_file_reopens_the_anchored_buffer_after_restart() {
    let root = tempfile::tempdir().expect("temporary WAL root should exist");
    let (before, anchor_head) = import_then_restart(root.path(), false);

    let mut host = JeditEchoHost::open(root.path()).expect("Echo WAL should recover");
    let (buffer, reopened_anchor, basis) = opened(open(&mut host, 3, ORIGINAL, original_basis()));
    assert_eq!(buffer.head_id, before.head_id);
    assert_eq!(reopened_anchor, anchor_head);
    assert_eq!(basis, original_basis());
    assert_eq!(text(&mut host, 4, &buffer), ORIGINAL);
}

#[test]
fn an_externally_modified_file_is_obstructed_after_restart_and_the_buffer_is_kept() {
    let root = tempfile::tempdir().expect("temporary WAL root should exist");
    let (before, _) = import_then_restart(root.path(), false);

    let mut host = JeditEchoHost::open(root.path()).expect("Echo WAL should recover");
    let code = obstruction_code(open(
        &mut host,
        3,
        "hello, edited elsewhere",
        changed_basis(),
    ));
    assert_eq!(code, "file-changed-since-import");

    // Nothing was replaced: the anchored buffer still holds the imported text.
    let (buffer, _, _) = opened(open(&mut host, 4, ORIGINAL, original_basis()));
    assert_eq!(buffer.head_id, before.head_id);
    assert_eq!(text(&mut host, 5, &buffer), ORIGINAL);
}

#[test]
fn unsaved_edits_survive_reopen_and_remain_distinct_from_the_anchored_head() {
    let root = tempfile::tempdir().expect("temporary WAL root should exist");
    let (edited, anchor_head) = import_then_restart(root.path(), true);

    let mut host = JeditEchoHost::open(root.path()).expect("Echo WAL should recover");
    let (buffer, reopened_anchor, _) = opened(open(&mut host, 3, ORIGINAL, original_basis()));
    assert_eq!(buffer.head_id, edited.head_id, "the edited head is kept");
    assert_eq!(
        reopened_anchor, anchor_head,
        "the anchor still names the imported head"
    );
    assert_ne!(
        buffer.head_id, reopened_anchor,
        "an edited head is not the anchored one"
    );
    assert_eq!(text(&mut host, 4, &buffer), "hello world");
}

#[test]
fn a_file_and_buffer_that_both_changed_are_obstructed_and_the_edits_are_kept() {
    let root = tempfile::tempdir().expect("temporary WAL root should exist");
    let (edited, _) = import_then_restart(root.path(), true);

    let mut host = JeditEchoHost::open(root.path()).expect("Echo WAL should recover");
    let code = obstruction_code(open(
        &mut host,
        3,
        "hello, edited elsewhere",
        changed_basis(),
    ));
    assert_eq!(code, "file-and-buffer-changed-since-import");

    let (buffer, _, _) = opened(open(&mut host, 4, ORIGINAL, original_basis()));
    assert_eq!(buffer.head_id, edited.head_id);
    assert_eq!(text(&mut host, 5, &buffer), "hello world");
}

#[test]
fn a_missing_file_is_anchored_as_missing_and_a_file_appearing_later_is_obstructed() {
    let root = tempfile::tempdir().expect("temporary WAL root should exist");
    {
        let mut host = JeditEchoHost::open(root.path()).expect("Echo host should initialize");
        let (_, _, basis) = opened(open(&mut host, 1, "", HostBasis::Missing));
        assert_eq!(basis, HostBasis::Missing);
    }
    let mut host = JeditEchoHost::open(root.path()).expect("Echo WAL should recover");
    let (_, _, basis) = opened(open(&mut host, 2, "", HostBasis::Missing));
    assert_eq!(basis, HostBasis::Missing);
    let code = obstruction_code(open(&mut host, 3, ORIGINAL, original_basis()));
    assert_eq!(code, "file-changed-since-import");
}

#[test]
fn a_file_that_disappeared_is_obstructed() {
    let root = tempfile::tempdir().expect("temporary WAL root should exist");
    import_then_restart(root.path(), false);
    let mut host = JeditEchoHost::open(root.path()).expect("Echo WAL should recover");
    let code = obstruction_code(open(&mut host, 3, "", HostBasis::Missing));
    assert_eq!(code, "file-changed-since-import");
}

#[test]
fn a_malformed_digest_is_refused_before_admission() {
    let root = tempfile::tempdir().expect("temporary WAL root should exist");
    let mut host = JeditEchoHost::open(root.path()).expect("Echo host should initialize");
    let code = obstruction_code(open(&mut host, 1, ORIGINAL, file_basis("not-hex", 5)));
    assert_eq!(code, "invalid-request");
}
