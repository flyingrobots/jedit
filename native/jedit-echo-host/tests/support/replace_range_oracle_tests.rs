use super::*;

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
