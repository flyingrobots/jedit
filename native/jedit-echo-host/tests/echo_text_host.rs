use jedit_echo_host::host::JeditEchoHost;
use jedit_echo_host::protocol::{HostRequest, HostResponse};

fn open_request(request_id: u64, initial_text: &str) -> HostRequest {
    HostRequest::Open {
        request_id,
        buffer_key: "witness.txt".to_owned(),
        initial_text: initial_text.to_owned(),
        projection_path: Some("/tmp/witness.txt".to_owned()),
    }
}

#[test]
fn generated_operations_tick_in_echo_and_recover_from_the_runtime_wal() {
    let root = tempfile::tempdir().expect("temporary WAL root should exist");
    let (buffer_id, initial_head_id) = {
        let mut host = JeditEchoHost::open(root.path()).expect("Echo host should initialize");
        let HostResponse::Opened { buffer, .. } = host.handle(open_request(1, "hello")) else {
            panic!("createBufferWorldline should open the buffer");
        };
        let buffer_id = buffer.buffer_id.clone();
        let initial_head_id = buffer.head_id.clone();
        let HostResponse::Applied {
            buffer: edited,
            receipt_id,
            admitted_tick_id,
            ..
        } = host.handle(HostRequest::Replace {
            request_id: 2,
            buffer_id: buffer_id.clone(),
            start_byte: 5,
            end_byte: 5,
            insert_text: " world".to_owned(),
        })
        else {
            panic!("replaceRangeAsTick should apply");
        };
        assert_ne!(edited.head_id, initial_head_id);
        assert_eq!(edited.byte_length, 11);
        assert!(!receipt_id.is_empty());
        assert!(!admitted_tick_id.is_empty());
        (buffer_id, initial_head_id)
    };

    let mut recovered = JeditEchoHost::open(root.path()).expect("Echo WAL should recover");
    let HostResponse::Opened {
        buffer, receipt_id, ..
    } = recovered.handle(open_request(3, "ignored after recovery"))
    else {
        panic!("recovered buffer should open");
    };
    assert_eq!(buffer.buffer_id, buffer_id);
    assert_ne!(buffer.head_id, initial_head_id);
    assert_eq!(receipt_id, None);

    let HostResponse::Observed {
        window,
        reading_id,
        resolved_worldline_tick,
        commit_hash,
        ..
    } = recovered.handle(HostRequest::Observe {
        request_id: 4,
        buffer_id: buffer_id.clone(),
        basis_head_id: buffer.head_id.clone(),
        start_byte: 0,
        end_byte: 11,
        max_bytes: 64,
    })
    else {
        panic!("textWindow should observe the recovered head");
    };
    assert_eq!(window.text, "hello world");
    assert!(!reading_id.is_empty());
    assert_eq!(resolved_worldline_tick, 2);
    assert!(!commit_hash.is_empty());

    let HostResponse::Applied {
        buffer: recovered_edit,
        receipt_id,
        ..
    } = recovered.handle(HostRequest::Replace {
        request_id: 5,
        buffer_id,
        start_byte: 11,
        end_byte: 11,
        insert_text: "!".to_owned(),
    })
    else {
        panic!("recovered Echo host should continue admitting generated edits");
    };
    assert_ne!(recovered_edit.head_id, buffer.head_id);
    assert_eq!(recovered_edit.byte_length, 12);
    assert!(!receipt_id.is_empty());
}

#[test]
fn bounded_window_stops_before_a_split_utf8_code_point() {
    let root = tempfile::tempdir().expect("temporary WAL root should exist");
    let mut host = JeditEchoHost::open(root.path()).expect("Echo host should initialize");
    let HostResponse::Opened { buffer, .. } = host.handle(open_request(1, "ab🙂cd")) else {
        panic!("createBufferWorldline should open the buffer");
    };

    let HostResponse::Observed { window, .. } = host.handle(HostRequest::Observe {
        request_id: 2,
        buffer_id: buffer.buffer_id,
        basis_head_id: buffer.head_id,
        start_byte: 0,
        end_byte: 4,
        max_bytes: 4,
    }) else {
        panic!("bounded textWindow should return the complete UTF-8 prefix");
    };

    assert_eq!(window.start_byte, 0);
    assert_eq!(window.end_byte, 2);
    assert_eq!(window.text, "ab");
    assert!(window
        .support
        .iter()
        .all(|support| support.end_byte <= window.end_byte));
}

#[test]
fn narrow_replace_preserves_untouched_leaf_identity() {
    let root = tempfile::tempdir().expect("temporary WAL root should exist");
    let initial = format!(
        "{}{}{}",
        "a".repeat(4096),
        "b".repeat(4096),
        "c".repeat(4096)
    );
    let mut host = JeditEchoHost::open(root.path()).expect("Echo host should initialize");
    let HostResponse::Opened { buffer, .. } = host.handle(open_request(1, &initial)) else {
        panic!("buffer should open");
    };
    let HostResponse::Observed { window: before, .. } = host.handle(HostRequest::Observe {
        request_id: 2,
        buffer_id: buffer.buffer_id.clone(),
        basis_head_id: buffer.head_id,
        start_byte: 0,
        end_byte: initial.len() as u64,
        max_bytes: initial.len() as u64,
    }) else {
        panic!("initial rope should be observable");
    };
    let first_leaf = before
        .support
        .first()
        .expect("first leaf support")
        .leaf_id
        .clone();
    let last_leaf = before
        .support
        .last()
        .expect("last leaf support")
        .leaf_id
        .clone();

    let HostResponse::Applied { buffer: edited, .. } = host.handle(HostRequest::Replace {
        request_id: 3,
        buffer_id: buffer.buffer_id.clone(),
        start_byte: 6144,
        end_byte: 6145,
        insert_text: "x".to_owned(),
    }) else {
        panic!("narrow replacement should apply");
    };
    let HostResponse::Observed { window: after, .. } = host.handle(HostRequest::Observe {
        request_id: 4,
        buffer_id: buffer.buffer_id,
        basis_head_id: edited.head_id,
        start_byte: 0,
        end_byte: initial.len() as u64,
        max_bytes: initial.len() as u64,
    }) else {
        panic!("edited rope should be observable");
    };
    assert_eq!(
        after.support.first().expect("first leaf support").leaf_id,
        first_leaf
    );
    assert_eq!(
        after.support.last().expect("last leaf support").leaf_id,
        last_leaf
    );
}

#[test]
fn empty_replace_is_obstructed_without_advancing_the_causal_head() {
    let root = tempfile::tempdir().expect("temporary WAL root should exist");
    let mut host = JeditEchoHost::open(root.path()).expect("Echo host should initialize");
    let HostResponse::Opened { buffer, .. } = host.handle(open_request(1, "hello")) else {
        panic!("buffer should open");
    };

    let HostResponse::Obstructed { message, .. } = host.handle(HostRequest::Replace {
        request_id: 2,
        buffer_id: buffer.buffer_id.clone(),
        start_byte: 2,
        end_byte: 2,
        insert_text: String::new(),
    }) else {
        panic!("empty replacement should not mint a causal text transition");
    };
    assert!(message.contains("no-op"));

    let HostResponse::Opened {
        buffer: unchanged, ..
    } = host.handle(open_request(3, "ignored after initial open"))
    else {
        panic!("existing buffer should reopen");
    };
    assert_eq!(unchanged.head_id, buffer.head_id);
}

#[test]
fn text_equivalent_replace_is_obstructed_without_advancing_the_causal_head() {
    let root = tempfile::tempdir().expect("temporary WAL root should exist");
    let mut host = JeditEchoHost::open(root.path()).expect("Echo host should initialize");
    let HostResponse::Opened { buffer, .. } = host.handle(open_request(1, "hello")) else {
        panic!("buffer should open");
    };

    let HostResponse::Obstructed { message, .. } = host.handle(HostRequest::Replace {
        request_id: 2,
        buffer_id: buffer.buffer_id.clone(),
        start_byte: 1,
        end_byte: 4,
        insert_text: "ell".to_owned(),
    }) else {
        panic!("text-equivalent replacement should not mint a causal text transition");
    };
    assert!(message.contains("no-op"));

    let HostResponse::Opened {
        buffer: unchanged, ..
    } = host.handle(open_request(3, "ignored after initial open"))
    else {
        panic!("existing buffer should reopen");
    };
    assert_eq!(unchanged.head_id, buffer.head_id);
}
