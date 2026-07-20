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
