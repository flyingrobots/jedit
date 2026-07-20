use super::super::{apply_ops, make_basis, BasisSetup};
use super::*;
use jedit_echo_host::records::{fact_bytes, fact_type_id, BufferFact, RewriteFact};
use jedit_echo_host::rope::plan_replace;
use warp_core::{AttachmentValue, TickDelta, WarpOp};

#[test]
fn retained_consequence_is_internally_consistent() {
    let warp_id = warp_core::make_warp_id("oracle-consistency");
    let (basis, buffer_id, basis_head_id, _) =
        make_basis(warp_id, "consistent", "abc", BasisSetup::Plain);
    let plan = plan_replace(&basis, buffer_id, basis_head_id, 1, 2, "XY")
        .expect("replacement should plan");
    let mut delta = TickDelta::new();
    plan.emit(&mut delta);
    let mut next = basis.clone();
    let patch = delta.finalize();
    apply_ops(&mut next, &patch);

    validate_consequence(
        &basis,
        &next,
        &plan,
        &patch,
        ReplaceExpectation {
            basis_head_id,
            start_byte: 1,
            end_byte: 2,
            replacement: "XY",
        },
    )
    .expect("retained consequence should be internally consistent");
}

#[test]
fn retained_consequence_selects_facts_from_the_current_edit() {
    let warp_id = warp_core::make_warp_id("oracle-retained-history");
    let (basis, buffer_id, basis_head_id, _) =
        make_basis(warp_id, "retained-history", "abc", BasisSetup::Plain);
    let first_plan = plan_replace(&basis, buffer_id, basis_head_id, 1, 2, "XY")
        .expect("first replacement should plan");
    let mut first_delta = TickDelta::new();
    first_plan.emit(&mut first_delta);
    let mut after_first = basis.clone();
    apply_ops(&mut after_first, &first_delta.finalize());

    let second_plan = plan_replace(&after_first, buffer_id, first_plan.head_id, 0, 1, "Z")
        .expect("second replacement should plan");
    let mut second_delta = TickDelta::new();
    second_plan.emit(&mut second_delta);
    let mut after_second = after_first.clone();
    let second_patch = second_delta.finalize();
    apply_ops(&mut after_second, &second_patch);

    validate_consequence(
        &after_first,
        &after_second,
        &second_plan,
        &second_patch,
        ReplaceExpectation {
            basis_head_id: first_plan.head_id,
            start_byte: 0,
            end_byte: 1,
            replacement: "Z",
        },
    )
    .expect("current consequence should tolerate prior retained history");
}

#[test]
fn retained_consequence_requires_one_current_rewrite_candidate() {
    let warp_id = warp_core::make_warp_id("oracle-current-candidate");
    let (basis, buffer_id, basis_head_id, _) =
        make_basis(warp_id, "current-candidate", "abc", BasisSetup::Plain);
    let plan = plan_replace(&basis, buffer_id, basis_head_id, 1, 2, "XY")
        .expect("replacement should plan");
    let mut delta = TickDelta::new();
    plan.emit(&mut delta);
    let mut next = basis.clone();
    let patch = delta.finalize();
    apply_ops(&mut next, &patch);
    let expectation = ReplaceExpectation {
        basis_head_id,
        start_byte: 1,
        end_byte: 2,
        replacement: "XY",
    };

    let missing = validate_consequence(&basis, &next, &plan, &[], expectation)
        .expect_err("a patch without a Rewrite candidate must fail");
    assert!(missing.contains("received 0"));

    let mut ambiguous = patch.clone();
    ambiguous.push(WarpOp::UpsertNode {
        node: warp_core::NodeKey {
            warp_id,
            local_id: warp_core::NodeId([0xA5; 32]),
        },
        record: warp_core::NodeRecord {
            ty: fact_type_id::<RewriteFact>(),
        },
    });
    let ambiguity = validate_consequence(&basis, &next, &plan, &ambiguous, expectation)
        .expect_err("multiple Rewrite candidates must fail");
    assert!(ambiguity.contains("received 2"));
}

#[test]
fn retained_consequence_rejects_a_buffer_head_mismatch() {
    let warp_id = warp_core::make_warp_id("oracle-inconsistent");
    let (basis, buffer_id, basis_head_id, _) =
        make_basis(warp_id, "inconsistent", "abc", BasisSetup::Plain);
    let plan = plan_replace(&basis, buffer_id, basis_head_id, 1, 2, "XY")
        .expect("replacement should plan");
    let mut delta = TickDelta::new();
    plan.emit(&mut delta);
    let mut next = basis.clone();
    let patch = delta.finalize();
    apply_ops(&mut next, &patch);
    let mut buffer: BufferFact = read_fact(&next, buffer_id).expect("Buffer should decode");
    buffer.canonical_head_id = basis_head_id.into();
    next.set_node_attachment(
        buffer_id,
        Some(AttachmentValue::Atom(warp_core::AtomPayload::new(
            fact_type_id::<BufferFact>(),
            fact_bytes(&buffer).expect("Buffer should encode").into(),
        ))),
    );

    let error = validate_consequence(
        &basis,
        &next,
        &plan,
        &patch,
        ReplaceExpectation {
            basis_head_id,
            start_byte: 1,
            end_byte: 2,
            replacement: "XY",
        },
    )
    .expect_err("inconsistent retained consequence should fail");
    assert!(error.contains("result Buffer canonical head"));
}
