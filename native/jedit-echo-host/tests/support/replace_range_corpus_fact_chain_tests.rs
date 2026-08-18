use jedit_echo_host::records::{
    fact_bytes, fact_id, BufferFact, ContentAddressedFact, DiffFact, HeadFact, NodeIdBytes,
    RewriteFact,
};
use serde::de::DeserializeOwned;
use serde_json::Value;

use super::{committable, mutation_error};

fn assert_chain_invalid(label: &str, expected_error: &str, mutate: impl FnOnce(&mut Value)) {
    let error = mutation_error(label, mutate);
    assert!(error.contains(expected_error), "{label} returned {error:?}");
}

fn mutate_result_buffer(corpus: &mut Value, mutate: impl FnOnce(&mut BufferFact)) -> BufferFact {
    let case = committable(corpus);
    let buffer_id = case["terminal"]["result"]["bufferId"]
        .as_str()
        .expect("result Buffer identifier should be a string")
        .to_owned();
    let operation = case["terminal"]["patch"]
        .as_array_mut()
        .expect("patch should be an array")
        .iter_mut()
        .find(|operation| operation["kind"] == "set-node-alpha" && operation["nodeId"] == buffer_id)
        .expect("result Buffer attachment should exist");
    let bytes = hex::decode(
        operation["attachmentBytesHex"]
            .as_str()
            .expect("attachment bytes should be hexadecimal"),
    )
    .expect("attachment hexadecimal should decode");
    let mut buffer: BufferFact =
        serde_json::from_slice(&bytes).expect("Buffer attachment should decode");
    mutate(&mut buffer);
    operation["attachmentBytesHex"] = Value::String(hex::encode(
        fact_bytes(&buffer).expect("mutated Buffer should encode"),
    ));
    buffer
}

fn mutate_basis_buffer(corpus: &mut Value, mutate: impl FnOnce(&mut BufferFact)) {
    let case = committable(corpus);
    let buffer_id = case["invocation"]["bufferId"]
        .as_str()
        .expect("invocation Buffer identifier should be a string")
        .to_owned();
    let fact = case["basisFacts"]
        .as_array_mut()
        .expect("basis facts should be an array")
        .iter_mut()
        .find(|fact| fact["nodeId"] == buffer_id)
        .expect("basis Buffer fact should exist");
    let bytes = hex::decode(
        fact["attachmentBytesHex"]
            .as_str()
            .expect("basis attachment bytes should be hexadecimal"),
    )
    .expect("basis attachment hexadecimal should decode");
    let mut buffer: BufferFact =
        serde_json::from_slice(&bytes).expect("basis Buffer should decode");
    mutate(&mut buffer);
    fact["attachmentBytesHex"] = Value::String(hex::encode(
        fact_bytes(&buffer).expect("mutated basis Buffer should encode"),
    ));
}

fn mutate_result_fact<F>(corpus: &mut Value, result_field: &str, mutate: impl FnOnce(&mut F)) -> F
where
    F: ContentAddressedFact + DeserializeOwned,
{
    let case = committable(corpus);
    let original_id = case["terminal"]["result"][result_field]
        .as_str()
        .expect("result fact identifier should be a string")
        .to_owned();
    let operation = case["terminal"]["patch"]
        .as_array_mut()
        .expect("patch should be an array")
        .iter_mut()
        .find(|operation| {
            operation["kind"] == "set-node-alpha" && operation["nodeId"] == original_id
        })
        .expect("result fact attachment should exist");
    let bytes = hex::decode(
        operation["attachmentBytesHex"]
            .as_str()
            .expect("attachment bytes should be hexadecimal"),
    )
    .expect("attachment hexadecimal should decode");
    let mut fact: F = serde_json::from_slice(&bytes).expect("result fact should decode");
    mutate(&mut fact);
    operation["attachmentBytesHex"] = Value::String(hex::encode(
        fact_bytes(&fact).expect("mutated result fact should encode"),
    ));
    let replacement_id = hex::encode(
        fact_id(&fact)
            .expect("mutated result fact should have an identity")
            .as_bytes(),
    );
    replace_string(case, &original_id, &replacement_id);
    canonicalize_patch_order(case);
    fact
}

fn replace_string(value: &mut Value, original: &str, replacement: &str) {
    match value {
        Value::Array(values) => {
            for value in values {
                replace_string(value, original, replacement);
            }
        }
        Value::Object(values) => {
            for value in values.values_mut() {
                replace_string(value, original, replacement);
            }
        }
        Value::String(value) if value == original => *value = replacement.to_owned(),
        _ => {}
    }
}

fn canonicalize_patch_order(case: &mut Value) {
    case["terminal"]["patch"]
        .as_array_mut()
        .expect("patch should be an array")
        .sort_by(|left, right| {
            let left_phase = (left["kind"] != "upsert-node") as u8;
            let right_phase = (right["kind"] != "upsert-node") as u8;
            (left_phase, left["nodeId"].as_str()).cmp(&(right_phase, right["nodeId"].as_str()))
        });
}

fn committable_with_extended_basis(corpus: &mut Value) -> &mut Value {
    corpus["cases"]
        .as_array_mut()
        .expect("cases should be an array")
        .iter_mut()
        .find(|case| {
            case["terminal"]["posture"] == "committable"
                && case["basisFacts"]
                    .as_array()
                    .is_some_and(|facts| facts.len() > 2)
        })
        .expect("a committable case with rope basis facts should exist")
}

#[test]
fn strict_corpus_cross_checks_result_fact_roles() {
    assert_chain_invalid(
        "swapped Rewrite and Diff roles",
        "result Rewrite fact",
        |corpus| {
            let result = &mut committable(corpus)["terminal"]["result"];
            let rewrite_id = result["rewriteId"].clone();
            result["rewriteId"] = result["diffId"].clone();
            result["diffId"] = rewrite_id;
        },
    );
}

#[test]
fn strict_corpus_cross_checks_buffer_version() {
    assert_chain_invalid("result Buffer version", "result Buffer version", |corpus| {
        let version = committable(corpus)["terminal"]["result"]["version"]
            .as_u64()
            .expect("result version should be u64");
        committable(corpus)["terminal"]["result"]["version"] = Value::from(version + 1);
    });
}

#[test]
fn strict_corpus_cross_checks_head_sequence() {
    assert_chain_invalid("result Head sequence", "result Head sequence", |corpus| {
        let sequence = committable(corpus)["terminal"]["result"]["sequence"]
            .as_u64()
            .expect("result sequence should be u64");
        committable(corpus)["terminal"]["result"]["sequence"] = Value::from(sequence + 1);
    });
}

#[test]
fn strict_corpus_cross_checks_head_root() {
    assert_chain_invalid("result Head root", "result Head root", |corpus| {
        let result = &mut committable(corpus)["terminal"]["result"];
        let substitute = result["rewriteId"].clone();
        result["rootNodeId"] = substitute.clone();
        result["rootDigest"] = substitute;
    });
}

#[test]
fn strict_corpus_cross_checks_buffer_head_link() {
    assert_chain_invalid(
        "result Buffer canonical Head",
        "result Buffer canonical Head",
        |corpus| {
            let rewrite_id = committable(corpus)["terminal"]["result"]["rewriteId"]
                .as_str()
                .expect("Rewrite identifier should be a string");
            let bytes = hex::decode(rewrite_id).expect("Rewrite identifier should decode");
            let wrong_head =
                <[u8; 32]>::try_from(bytes).expect("Rewrite identifier should contain 32 bytes");
            mutate_result_buffer(corpus, |buffer| {
                buffer.canonical_head_id = NodeIdBytes(wrong_head);
            });
        },
    );
}

#[test]
fn strict_corpus_cross_checks_buffer_version_advancement() {
    assert_chain_invalid(
        "result Buffer version advancement",
        "result Buffer version advancement",
        |corpus| {
            let buffer = mutate_result_buffer(corpus, |buffer| {
                buffer.version += 1;
            });
            committable(corpus)["terminal"]["result"]["version"] = Value::from(buffer.version);
        },
    );
}

#[test]
fn strict_corpus_cross_checks_head_sequence_advancement() {
    assert_chain_invalid(
        "result Head sequence advancement",
        "result Head sequence advancement",
        |corpus| {
            let head = mutate_result_fact::<HeadFact>(corpus, "headId", |head| {
                head.sequence += 1;
            });
            let head_id = fact_id(&head).expect("mutated Head should have an identity");
            mutate_result_buffer(corpus, |buffer| {
                buffer.canonical_head_id = NodeIdBytes(*head_id.as_bytes());
            });
            committable(corpus)["terminal"]["result"]["sequence"] = Value::from(head.sequence);
        },
    );
}

#[test]
fn strict_corpus_cross_checks_head_root_digest() {
    assert_chain_invalid(
        "result Head root digest",
        "nonempty root digest differs",
        |corpus| {
            committable(corpus)["terminal"]["result"]["rootDigest"] =
                Value::String("00".repeat(32));
        },
    );
}

#[test]
fn strict_corpus_authenticates_every_committable_basis_fact() {
    assert_chain_invalid("malformed unselected basis fact", "basis fact", |corpus| {
        let case = committable_with_extended_basis(corpus);
        let buffer_id = case["invocation"]["bufferId"].clone();
        let head_id = case["invocation"]["basisHeadId"].clone();
        let fact = case["basisFacts"]
            .as_array_mut()
            .expect("basis facts should be an array")
            .iter_mut()
            .find(|fact| fact["nodeId"] != buffer_id && fact["nodeId"] != head_id)
            .expect("an unselected basis fact should exist");
        fact["attachmentBytesHex"] = Value::String("00".to_owned());
    });
}

#[test]
fn strict_corpus_cross_checks_basis_buffer_head_link() {
    assert_chain_invalid(
        "basis Buffer canonical Head",
        "basis Buffer canonical Head",
        |corpus| {
            let buffer_id = committable(corpus)["invocation"]["bufferId"]
                .as_str()
                .expect("Buffer identifier should be a string");
            let bytes = hex::decode(buffer_id).expect("Buffer identifier should decode");
            let wrong_head =
                <[u8; 32]>::try_from(bytes).expect("Buffer identifier should contain 32 bytes");
            mutate_basis_buffer(corpus, |buffer| {
                buffer.canonical_head_id = NodeIdBytes(wrong_head);
            });
        },
    );
}

#[test]
fn strict_corpus_labels_unsupported_committable_basis_types() {
    assert_chain_invalid(
        "unsupported committable basis fact type",
        "basis fact",
        |corpus| {
            let case = committable_with_extended_basis(corpus);
            let buffer_id = case["invocation"]["bufferId"].clone();
            let head_id = case["invocation"]["basisHeadId"].clone();
            let fact = case["basisFacts"]
                .as_array_mut()
                .expect("basis facts should be an array")
                .iter_mut()
                .find(|fact| fact["nodeId"] != buffer_id && fact["nodeId"] != head_id)
                .expect("an unselected basis fact should exist");
            fact["typeId"] = Value::String("00".repeat(32));
        },
    );
}

#[test]
fn strict_corpus_cross_checks_rewrite_fields() {
    assert_chain_invalid(
        "Rewrite inserted byte length",
        "Rewrite inserted byte length",
        |corpus| {
            mutate_result_fact::<RewriteFact>(corpus, "rewriteId", |rewrite| {
                rewrite.inserted_byte_length += 1;
            });
        },
    );
}

#[test]
fn strict_corpus_cross_checks_diff_fields() {
    assert_chain_invalid(
        "Diff deleted byte length",
        "Diff deleted byte length",
        |corpus| {
            mutate_result_fact::<DiffFact>(corpus, "diffId", |diff| {
                diff.deleted_byte_length += 1;
            });
        },
    );
}
