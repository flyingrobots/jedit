use jedit_echo_host::records::{fact_type_id, BufferFact, HeadFact};

pub fn assert_retained_basis(cases: &[serde_json::Value], case_id: &str, same_buffer: bool) {
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
    let retained_head = projected_fact(
        facts,
        invocation_basis_id,
        &head_type_id,
        "invocation basis Head",
    );
    let head: HeadFact = decode_projected_fact(retained_head);
    let head_buffer_id = hex::encode(head.buffer_id.0);
    assert_eq!(
        head_buffer_id == invocation_buffer_id,
        same_buffer,
        "{case_id} buffer relationship drifted"
    );

    let buffer_type_id = hex::encode(fact_type_id::<BufferFact>().as_bytes());
    let retained_buffer = projected_fact(
        facts,
        invocation_buffer_id,
        &buffer_type_id,
        "target Buffer",
    );
    let buffer: BufferFact = decode_projected_fact(retained_buffer);
    let canonical_head_id = hex::encode(buffer.canonical_head_id.0);
    assert_ne!(
        invocation_basis_id, canonical_head_id,
        "{case_id} must not use the current canonical head"
    );

    if same_buffer {
        let current_head = projected_fact(
            facts,
            &canonical_head_id,
            &head_type_id,
            "current canonical Head",
        );
        let current_head: HeadFact = decode_projected_fact(current_head);
        assert_eq!(
            hex::encode(current_head.buffer_id.0),
            invocation_buffer_id,
            "stale current Head must belong to the target Buffer"
        );
        assert_eq!(
            current_head.basis_head_id.map(|id| hex::encode(id.0)),
            Some(invocation_basis_id.to_owned()),
            "stale current Head must directly descend from the invocation basis"
        );
    } else {
        let foreign_buffer =
            projected_fact(facts, &head_buffer_id, &buffer_type_id, "foreign Buffer");
        let foreign_buffer: BufferFact = decode_projected_fact(foreign_buffer);
        assert_eq!(
            hex::encode(foreign_buffer.canonical_head_id.0),
            invocation_basis_id,
            "foreign Buffer must canonically name the invocation basis Head"
        );
    }
}

pub fn corrupt_stale_ancestry(cases: &mut [serde_json::Value]) {
    let case = cases
        .iter_mut()
        .find(|case| case["id"] == "stale-basis")
        .expect("stale case should exist");
    let target_buffer_id = case["invocation"]["bufferId"]
        .as_str()
        .expect("target Buffer ID should be a string")
        .to_owned();
    let facts = case["basisFacts"]
        .as_array_mut()
        .expect("basis facts should be an array");
    let buffer: BufferFact = decode_projected_fact(
        facts
            .iter()
            .find(|fact| fact["nodeId"] == target_buffer_id)
            .expect("target Buffer should be retained"),
    );
    let current_head_id = hex::encode(buffer.canonical_head_id.0);
    let current_head = facts
        .iter_mut()
        .find(|fact| fact["nodeId"] == current_head_id)
        .expect("current Head should be retained");
    let mut head: HeadFact = decode_projected_fact(current_head);
    head.basis_head_id = None;
    current_head["attachmentBytesHex"] =
        serde_json::Value::String(hex::encode(serde_json::to_vec(&head).unwrap()));
}

pub fn corrupt_foreign_canonical_head(cases: &mut [serde_json::Value]) {
    let case = cases
        .iter_mut()
        .find(|case| case["id"] == "foreign-basis")
        .expect("foreign case should exist");
    let invocation_basis_id = case["invocation"]["basisHeadId"]
        .as_str()
        .expect("foreign Head ID should be a string")
        .to_owned();
    let facts = case["basisFacts"]
        .as_array_mut()
        .expect("basis facts should be an array");
    let foreign_head: HeadFact = decode_projected_fact(
        facts
            .iter()
            .find(|fact| fact["nodeId"] == invocation_basis_id)
            .expect("foreign Head should be retained"),
    );
    let foreign_buffer_id = hex::encode(foreign_head.buffer_id.0);
    let foreign_buffer = facts
        .iter_mut()
        .find(|fact| fact["nodeId"] == foreign_buffer_id)
        .expect("foreign Buffer should be retained");
    let mut buffer: BufferFact = decode_projected_fact(foreign_buffer);
    buffer.canonical_head_id.0 = [0xA5; 32];
    foreign_buffer["attachmentBytesHex"] =
        serde_json::Value::String(hex::encode(serde_json::to_vec(&buffer).unwrap()));
}

fn projected_fact<'a>(
    facts: &'a [serde_json::Value],
    node_id: &str,
    type_id: &str,
    label: &str,
) -> &'a serde_json::Value {
    facts
        .iter()
        .find(|fact| fact["nodeId"] == node_id && fact["typeId"] == type_id)
        .unwrap_or_else(|| panic!("{label} should be retained"))
}

fn decode_projected_fact<T: serde::de::DeserializeOwned>(fact: &serde_json::Value) -> T {
    serde_json::from_slice(
        &hex::decode(
            fact["attachmentBytesHex"]
                .as_str()
                .expect("fact bytes should be hexadecimal"),
        )
        .expect("fact bytes should decode"),
    )
    .expect("projected fact should decode")
}
