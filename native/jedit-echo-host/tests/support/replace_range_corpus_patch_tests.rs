use serde_json::Value;

use super::{committable, mutation_error};

fn committable_case(corpus: &Value, index: usize) -> &Value {
    corpus["cases"]
        .as_array()
        .expect("cases should be an array")
        .iter()
        .filter(|case| case["terminal"]["posture"] == "committable")
        .nth(index)
        .expect("requested committable case should exist")
}

fn committable_case_mut(corpus: &mut Value, index: usize) -> &mut Value {
    corpus["cases"]
        .as_array_mut()
        .expect("cases should be an array")
        .iter_mut()
        .filter(|case| case["terminal"]["posture"] == "committable")
        .nth(index)
        .expect("requested committable case should exist")
}

fn patch_attachment_for_result<'a>(case: &'a Value, result_field: &str) -> &'a Value {
    let node_id = case["terminal"]["result"][result_field]
        .as_str()
        .expect("result identifier should be a string");
    case["terminal"]["patch"]
        .as_array()
        .expect("patch should be an array")
        .iter()
        .find(|operation| operation["kind"] == "set-node-alpha" && operation["nodeId"] == node_id)
        .expect("result attachment should exist in the patch")
}

fn patch_attachment_for_result_mut<'a>(case: &'a mut Value, result_field: &str) -> &'a mut Value {
    let node_id = case["terminal"]["result"][result_field]
        .as_str()
        .expect("result identifier should be a string")
        .to_owned();
    case["terminal"]["patch"]
        .as_array_mut()
        .expect("patch should be an array")
        .iter_mut()
        .find(|operation| operation["kind"] == "set-node-alpha" && operation["nodeId"] == node_id)
        .expect("result attachment should exist in the patch")
}

#[test]
fn strict_corpus_authenticates_patch_attachment_semantics() {
    super::assert_invalid("content-addressed Head attachment", |corpus| {
        let target_head = committable_case(corpus, 0)["terminal"]["result"]["headId"].clone();
        let donor = patch_attachment_for_result(committable_case(corpus, 1), "headId");
        assert_ne!(donor["nodeId"], target_head);
        let donor_bytes = donor["attachmentBytesHex"].clone();
        patch_attachment_for_result_mut(committable_case_mut(corpus, 0), "headId")
            ["attachmentBytesHex"] = donor_bytes;
    });

    super::assert_invalid("keyed Buffer attachment", |corpus| {
        let target_buffer = committable_case(corpus, 0)["terminal"]["result"]["bufferId"].clone();
        let donor = patch_attachment_for_result(committable_case(corpus, 1), "bufferId");
        assert_ne!(donor["nodeId"], target_buffer);
        let donor_bytes = donor["attachmentBytesHex"].clone();
        patch_attachment_for_result_mut(committable_case_mut(corpus, 0), "bufferId")
            ["attachmentBytesHex"] = donor_bytes;
    });

    super::assert_invalid("noncanonical Buffer attachment", |corpus| {
        let operation =
            patch_attachment_for_result_mut(committable_case_mut(corpus, 0), "bufferId");
        let bytes = operation["attachmentBytesHex"]
            .as_str()
            .expect("attachment bytes should be hexadecimal");
        operation["attachmentBytesHex"] = Value::String(format!("20{bytes}"));
    });

    super::assert_invalid("undecodable patch attachment", |corpus| {
        patch_attachment_for_result_mut(committable_case_mut(corpus, 0), "headId")
            ["attachmentBytesHex"] = Value::String("00".to_owned());
    });

    super::assert_invalid("unsupported patch fact type", |corpus| {
        let case = committable_case_mut(corpus, 0);
        let node_id = case["terminal"]["result"]["headId"].clone();
        let unknown_type = Value::String("00".repeat(32));
        let mut changed = 0;
        for operation in case["terminal"]["patch"]
            .as_array_mut()
            .expect("patch should be an array")
        {
            if operation["nodeId"] == node_id {
                operation["typeId"] = unknown_type.clone();
                changed += 1;
            }
        }
        assert_eq!(changed, 2, "one node and atom operation should change");
    });
}

#[test]
fn strict_corpus_authenticates_patch_operation_order() {
    super::assert_invalid("attachment before node upsert", |corpus| {
        let patch = committable(corpus)["terminal"]["patch"]
            .as_array_mut()
            .expect("patch should be an array");
        let attachment = patch
            .iter()
            .position(|operation| operation["kind"] == "set-node-alpha")
            .expect("patch should contain an attachment phase");
        assert!(attachment > 0, "node upserts should precede attachments");
        assert_eq!(patch[attachment - 1]["kind"], "upsert-node");
        patch.swap(attachment - 1, attachment);
    });

    super::assert_invalid("descending node-upsert phase", |corpus| {
        let patch = committable(corpus)["terminal"]["patch"]
            .as_array_mut()
            .expect("patch should be an array");
        assert_eq!(patch[0]["kind"], "upsert-node");
        assert_eq!(patch[1]["kind"], "upsert-node");
        let first = patch[0]["nodeId"]
            .as_str()
            .expect("node identifier should be a string");
        let second = patch[1]["nodeId"]
            .as_str()
            .expect("node identifier should be a string");
        assert!(first < second, "native node upserts should be ascending");
        patch.swap(0, 1);
    });

    super::assert_invalid("descending attachment phase", |corpus| {
        let patch = committable(corpus)["terminal"]["patch"]
            .as_array_mut()
            .expect("patch should be an array");
        let attachment = patch
            .iter()
            .position(|operation| operation["kind"] == "set-node-alpha")
            .expect("patch should contain an attachment phase");
        assert_eq!(patch[attachment + 1]["kind"], "set-node-alpha");
        let first = patch[attachment]["nodeId"]
            .as_str()
            .expect("node identifier should be a string");
        let second = patch[attachment + 1]["nodeId"]
            .as_str()
            .expect("node identifier should be a string");
        assert!(first < second, "native attachments should be ascending");
        patch.swap(attachment, attachment + 1);
    });
}

fn assert_duplicate_rejected(kind: &str) {
    let error = mutation_error(&format!("duplicate {kind}"), |corpus| {
        let patch = committable(corpus)["terminal"]["patch"]
            .as_array_mut()
            .expect("patch should be an array");
        let index = patch
            .iter()
            .position(|operation| operation["kind"] == kind)
            .expect("requested operation kind should exist");
        patch.insert(index, patch[index].clone());
    });
    assert!(
        error.contains("duplicate patch operation"),
        "duplicate {kind} returned {error:?}"
    );
}

#[test]
fn strict_corpus_rejects_duplicate_node_upsert() {
    assert_duplicate_rejected("upsert-node");
}

#[test]
fn strict_corpus_rejects_duplicate_node_attachment() {
    assert_duplicate_rejected("set-node-alpha");
}
