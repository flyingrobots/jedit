use super::*;
use jedit_echo_host::error::HostError;
use jedit_echo_host::records::{fact_bytes, HeadFact};
use warp_core::{make_type_id, NodeRecord};

#[test]
#[should_panic(expected = "oracle footprint WARP must match the corpus WARP")]
fn footprint_projection_rejects_a_foreign_node_read() {
    let expected = make_warp_id("oracle-local");
    let mut footprint = Footprint::default();
    footprint
        .n_read
        .insert_with_warp(make_warp_id("oracle-foreign"), NodeId([0xA5; 32]));

    project_footprint(&footprint, expected);
}

#[test]
#[should_panic(expected = "oracle footprint WARP must match the corpus WARP")]
fn footprint_projection_rejects_a_foreign_attachment_write() {
    let expected = make_warp_id("oracle-local");
    let mut footprint = Footprint::default();
    footprint
        .a_write
        .insert(warp_core::AttachmentKey::node_alpha(warp_core::NodeKey {
            warp_id: make_warp_id("oracle-foreign"),
            local_id: NodeId([0xA5; 32]),
        }));

    project_footprint(&footprint, expected);
}

#[test]
#[should_panic(expected = "oracle footprint WARP must match the corpus WARP")]
fn patch_projection_rejects_a_foreign_node_write() {
    let expected = make_warp_id("oracle-local");
    let operation = WarpOp::UpsertNode {
        node: warp_core::NodeKey {
            warp_id: make_warp_id("oracle-foreign"),
            local_id: NodeId([0xA5; 32]),
        },
        record: warp_core::NodeRecord {
            ty: warp_core::make_type_id("oracle.foreign"),
        },
    };

    project_op(&operation, expected);
}

#[test]
fn obstruction_semantics_come_from_the_typed_planner_reason() {
    let warp_id = make_warp_id("oracle-typed-obstruction");
    let (store, buffer_id, basis_head_id, _) =
        make_basis(warp_id, "typed-obstruction", "abc", BasisSetup::Plain);
    let failure = plan_replace_with_reason(&store, buffer_id, basis_head_id, 2, 1, "x")
        .expect_err("reversed range must obstruct");

    assert_eq!(failure.reason(), SemanticObstructionCode::RangeOrderInvalid);
}

#[test]
fn planner_rejects_a_basis_head_owned_by_another_buffer() {
    let warp_id = make_warp_id("oracle-basis-head-buffer");
    let (mut store, buffer_id, _, foreign_head_id) =
        make_basis(warp_id, "basis-head-buffer", "abc", BasisSetup::ForeignHead);
    let foreign_head_id = foreign_head_id.expect("foreign Head should exist");
    let mut buffer: BufferFact = decode_fact(
        store
            .node_attachment(&buffer_id)
            .expect("target Buffer should exist"),
    )
    .expect("target Buffer should decode");
    buffer.canonical_head_id = foreign_head_id.into();
    set_fact_attachment(&mut store, buffer_id, &buffer);

    let failure = plan_replace_with_reason(&store, buffer_id, foreign_head_id, 0, 0, "x")
        .expect_err("a Head owned by another Buffer must not produce a MutationPlan");

    assert_eq!(failure.reason(), SemanticObstructionCode::FactMalformed);
    assert!(matches!(failure.host_error(), HostError::MalformedFact(_)));
}

#[test]
fn planner_rejects_a_basis_head_with_mismatched_content_identity() {
    let warp_id = make_warp_id("oracle-basis-head-identity");
    let (mut store, buffer_id, basis_head_id, _) =
        make_basis(warp_id, "basis-head-identity", "abc", BasisSetup::Plain);
    let mut basis_head: HeadFact = decode_fact(
        store
            .node_attachment(&basis_head_id)
            .expect("basis Head should exist"),
    )
    .expect("basis Head should decode");
    basis_head.root_digest[0] ^= 0xFF;
    set_fact_attachment(&mut store, basis_head_id, &basis_head);

    let failure = plan_replace_with_reason(&store, buffer_id, basis_head_id, 0, 0, "x")
        .expect_err("misaddressed basis Head bytes must not produce a MutationPlan");

    assert_eq!(
        failure.reason(),
        SemanticObstructionCode::ContentIdentityMismatch
    );
    assert!(matches!(failure.host_error(), HostError::MalformedFact(_)));
}

#[test]
fn planner_rejects_whitespace_prefixed_basis_head_bytes() {
    let warp_id = make_warp_id("oracle-basis-head-whitespace");
    let (mut store, buffer_id, basis_head_id, _) =
        make_basis(warp_id, "basis-head-whitespace", "abc", BasisSetup::Plain);
    let basis_head: HeadFact = decode_fact(
        store
            .node_attachment(&basis_head_id)
            .expect("basis Head should exist"),
    )
    .expect("basis Head should decode");
    let mut noncanonical_bytes = vec![b' '];
    noncanonical_bytes.extend(fact_bytes(&basis_head).expect("basis Head should encode"));
    set_raw_fact_attachment::<HeadFact>(&mut store, basis_head_id, noncanonical_bytes);

    let failure = plan_replace_with_reason(&store, buffer_id, basis_head_id, 0, 0, "x")
        .expect_err("whitespace-prefixed basis Head bytes must not produce a MutationPlan");

    assert_eq!(
        failure.reason(),
        SemanticObstructionCode::ContentIdentityMismatch
    );
    assert!(matches!(failure.host_error(), HostError::MalformedFact(_)));
}

#[test]
fn planner_rejects_an_unknown_basis_head_member() {
    let warp_id = make_warp_id("oracle-basis-head-unknown-member");
    let (mut store, buffer_id, basis_head_id, _) = make_basis(
        warp_id,
        "basis-head-unknown-member",
        "abc",
        BasisSetup::Plain,
    );
    let basis_head: HeadFact = decode_fact(
        store
            .node_attachment(&basis_head_id)
            .expect("basis Head should exist"),
    )
    .expect("basis Head should decode");
    let mut noncanonical_bytes = fact_bytes(&basis_head).expect("basis Head should encode");
    assert_eq!(noncanonical_bytes.pop(), Some(b'}'));
    noncanonical_bytes.extend(br#","unexpected":true}"#);
    set_raw_fact_attachment::<HeadFact>(&mut store, basis_head_id, noncanonical_bytes);

    let failure = plan_replace_with_reason(&store, buffer_id, basis_head_id, 0, 0, "x")
        .expect_err("an unknown basis Head member must not produce a MutationPlan");

    assert_eq!(
        failure.reason(),
        SemanticObstructionCode::ContentIdentityMismatch
    );
    assert!(matches!(failure.host_error(), HostError::MalformedFact(_)));
}

#[test]
fn planner_authenticates_invalid_basis_head_bytes_before_decoding() {
    let warp_id = make_warp_id("oracle-basis-head-invalid-json");
    let (mut store, buffer_id, basis_head_id, _) =
        make_basis(warp_id, "basis-head-invalid-json", "abc", BasisSetup::Plain);
    set_raw_fact_attachment::<HeadFact>(&mut store, basis_head_id, b"{".to_vec());

    let failure = plan_replace_with_reason(&store, buffer_id, basis_head_id, 0, 0, "x")
        .expect_err("invalid basis Head bytes must not be decoded before authentication");

    assert_eq!(
        failure.reason(),
        SemanticObstructionCode::ContentIdentityMismatch
    );
    assert!(matches!(failure.host_error(), HostError::MalformedFact(_)));
}

#[test]
fn planner_rejects_content_addressed_noncanonical_basis_head_bytes() {
    let warp_id = make_warp_id("oracle-basis-head-addressed-noncanonical");
    let (mut store, buffer_id, basis_head_id, _) = make_basis(
        warp_id,
        "basis-head-addressed-noncanonical",
        "abc",
        BasisSetup::Plain,
    );
    let basis_head: HeadFact = decode_fact(
        store
            .node_attachment(&basis_head_id)
            .expect("basis Head should exist"),
    )
    .expect("basis Head should decode");
    let mut noncanonical_bytes = fact_bytes(&basis_head).expect("basis Head should encode");
    assert_eq!(noncanonical_bytes.pop(), Some(b'}'));
    noncanonical_bytes.extend(br#","unexpected":true}"#);
    let noncanonical_head_id = insert_raw_content_fact::<HeadFact>(&mut store, noncanonical_bytes);
    let mut buffer: BufferFact = decode_fact(
        store
            .node_attachment(&buffer_id)
            .expect("target Buffer should exist"),
    )
    .expect("target Buffer should decode");
    buffer.canonical_head_id = noncanonical_head_id.into();
    set_fact_attachment(&mut store, buffer_id, &buffer);

    let failure = plan_replace_with_reason(&store, buffer_id, noncanonical_head_id, 0, 0, "x")
        .expect_err("content-addressed noncanonical Head bytes must not produce a plan");

    assert_eq!(failure.reason(), SemanticObstructionCode::FactMalformed);
    assert!(matches!(failure.host_error(), HostError::MalformedFact(_)));
}

#[test]
fn planner_rejects_a_basis_head_with_the_wrong_node_type() {
    let warp_id = make_warp_id("oracle-basis-head-node-type");
    let (mut store, buffer_id, basis_head_id, _) =
        make_basis(warp_id, "basis-head-node-type", "abc", BasisSetup::Plain);
    store.insert_node(
        basis_head_id,
        NodeRecord {
            ty: make_type_id("jedit.text.DeliberatelyWrong.v1"),
        },
    );

    assert_planner_fact_malformed(&store, buffer_id, basis_head_id);
}

#[test]
fn planner_rejects_a_basis_head_with_the_wrong_atom_type() {
    let warp_id = make_warp_id("oracle-basis-head-atom-type");
    let (mut store, buffer_id, basis_head_id, _) =
        make_basis(warp_id, "basis-head-atom-type", "abc", BasisSetup::Plain);
    let basis_head: HeadFact = decode_fact(
        store
            .node_attachment(&basis_head_id)
            .expect("basis Head should exist"),
    )
    .expect("basis Head should decode");
    store.set_node_attachment(
        basis_head_id,
        Some(AttachmentValue::Atom(warp_core::AtomPayload::new(
            make_type_id("jedit.text.DeliberatelyWrong.v1"),
            fact_bytes(&basis_head)
                .expect("basis Head should encode")
                .into(),
        ))),
    );

    assert_planner_fact_malformed(&store, buffer_id, basis_head_id);
}

#[test]
fn planner_rejects_a_descended_basis_head_attachment() {
    let warp_id = make_warp_id("oracle-basis-head-descended");
    let (mut store, buffer_id, basis_head_id, _) =
        make_basis(warp_id, "basis-head-descended", "abc", BasisSetup::Plain);
    store.set_node_attachment(
        basis_head_id,
        Some(AttachmentValue::Descend(make_warp_id(
            "oracle-basis-head-child",
        ))),
    );

    assert_planner_fact_malformed(&store, buffer_id, basis_head_id);
}

fn assert_planner_fact_malformed(store: &GraphStore, buffer_id: NodeId, basis_head_id: NodeId) {
    let failure = plan_replace_with_reason(store, buffer_id, basis_head_id, 0, 0, "x")
        .expect_err("a structurally malformed basis Head must not produce a MutationPlan");

    assert_eq!(failure.reason(), SemanticObstructionCode::FactMalformed);
    assert!(matches!(failure.host_error(), HostError::MalformedFact(_)));
}

#[test]
fn oracle_support_contains_no_diagnostic_semantic_classifier() {
    let sources = [
        include_str!("replace_range_oracle.rs"),
        include_str!("replace_range_legacy.rs"),
        include_str!("replace_range_contract.rs"),
    ];
    for forbidden in [
        "fn semantic_obstruction(",
        "starts_with(\"replace range \")",
        "starts_with(\"stale replace basis \")",
        "contains(\"content hash does not match\")",
        "start_byte > end_byte",
    ] {
        assert!(
            sources.iter().all(|source| !source.contains(forbidden)),
            "oracle support reintroduced diagnostic semantic classifier {forbidden:?}"
        );
    }
}

#[test]
fn obstruction_projection_rejects_a_false_expected_semantic_code() {
    let spec = CaseSpec {
        id: "false-semantic-code",
        purpose: "negative semantic-obstruction witness",
        initial_text: "abc".to_owned(),
        setup: BasisSetup::Plain,
        start_byte: 2,
        end_byte: 1,
        replacement: "x".to_owned(),
        expected: ExpectedPosture::Obstruction {
            semantic_code: SemanticObstructionCode::RangeOutOfBounds,
            error_class: "invalid-request",
            message_fragment: "exceeds",
        },
    };

    assert!(
        std::panic::catch_unwind(|| evaluate_case(make_warp_id("oracle-semantic"), spec)).is_err(),
        "oracle accepted a semantic code that did not describe the observed failure"
    );
}

#[test]
fn success_projection_rejects_a_consequence_that_violates_the_declared_edit() {
    let warp_id = make_warp_id("oracle-expected-text");
    let (store, buffer_id, basis_head_id, _) =
        make_basis(warp_id, "expected-text", "abc", BasisSetup::Plain);
    let plan = plan_replace(&store, buffer_id, basis_head_id, 1, 2, "XY")
        .expect("replacement should plan");
    let mismatched_spec = CaseSpec {
        id: "false-materialized-text",
        purpose: "negative materialized-consequence witness",
        initial_text: "uvw".to_owned(),
        setup: BasisSetup::Plain,
        start_byte: 1,
        end_byte: 2,
        replacement: "XY".to_owned(),
        expected: ExpectedPosture::Success,
    };

    assert!(
        std::panic::catch_unwind(|| success_projection(&store, &plan, &mismatched_spec)).is_err(),
        "oracle accepted a consequence that violated the declared text edit"
    );
}
