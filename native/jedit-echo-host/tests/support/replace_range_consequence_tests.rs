use super::super::{
    apply_ops, insert_raw_content_fact, make_basis, set_fact_attachment, set_raw_fact_attachment,
    BasisSetup,
};
use super::*;
use jedit_echo_host::records::{fact_bytes, fact_type_id, BufferFact, HeadFact, RewriteFact};
use jedit_echo_host::rope::plan_replace;
use warp_core::{make_type_id, AttachmentValue, NodeRecord, TickDelta, WarpOp};

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
fn retained_consequence_rejects_node_and_atom_type_disagreement() {
    let warp_id = warp_core::make_warp_id("oracle-node-type");
    let (basis, buffer_id, basis_head_id, _) =
        make_basis(warp_id, "node-type", "abc", BasisSetup::Plain);
    let plan = plan_replace(&basis, buffer_id, basis_head_id, 1, 2, "XY")
        .expect("replacement should plan");
    let mut delta = TickDelta::new();
    plan.emit(&mut delta);
    let patch = delta.finalize();
    let expectation = ReplaceExpectation {
        basis_head_id,
        start_byte: 1,
        end_byte: 2,
        replacement: "XY",
    };
    let mut next = basis.clone();
    apply_ops(&mut next, &patch);

    for (node_id, label) in [(buffer_id, "Buffer"), (plan.head_id, "Head")] {
        let mut corrupted = next.clone();
        corrupted.insert_node(
            node_id,
            NodeRecord {
                ty: make_type_id("jedit.text.DeliberatelyWrong.v1"),
            },
        );

        let error = validate_consequence(&basis, &corrupted, &plan, &patch, expectation)
            .expect_err("node and atom type disagreement must fail");
        assert!(error.contains(label), "{label} error was {error:?}");
    }
}

#[test]
fn retained_consequence_rejects_a_misaddressed_buffer_key() {
    let warp_id = warp_core::make_warp_id("oracle-buffer-key");
    let (basis, buffer_id, basis_head_id, _) =
        make_basis(warp_id, "buffer-key", "abc", BasisSetup::Plain);
    let plan = plan_replace(&basis, buffer_id, basis_head_id, 1, 2, "XY")
        .expect("replacement should plan");
    let mut delta = TickDelta::new();
    plan.emit(&mut delta);
    let patch = delta.finalize();
    let mut next = basis.clone();
    apply_ops(&mut next, &patch);

    let mut misaddressed_basis = basis.clone();
    corrupt_buffer_key(&mut misaddressed_basis, buffer_id);
    corrupt_buffer_key(&mut next, buffer_id);

    let error = validate_consequence(
        &misaddressed_basis,
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
    .expect_err("a Buffer retained under the wrong keyed identity must fail");
    assert!(
        error.contains("Buffer keyed identity"),
        "error was {error:?}"
    );
}

#[test]
fn retained_consequence_rejects_a_basis_head_owned_by_another_buffer() {
    let warp_id = warp_core::make_warp_id("oracle-basis-head-buffer");
    let (mut basis, buffer_id, _, foreign_head_id) =
        make_basis(warp_id, "basis-head-buffer", "abc", BasisSetup::ForeignHead);
    let foreign_head_id = foreign_head_id.expect("foreign Head should exist");
    let mut buffer: BufferFact = read_fact(&basis, buffer_id).expect("Buffer should decode");
    buffer.canonical_head_id = foreign_head_id.into();
    set_fact_attachment(&mut basis, buffer_id, &buffer);

    let error = validate_basis(&basis, buffer_id, foreign_head_id)
        .expect_err("a basis Head owned by another Buffer must fail validation");

    assert!(error.contains("basis Head buffer"), "error was {error:?}");
}

#[test]
fn retained_consequence_rejects_a_misaddressed_basis_head() {
    let warp_id = warp_core::make_warp_id("oracle-basis-head-identity");
    let (mut basis, buffer_id, basis_head_id, _) =
        make_basis(warp_id, "basis-head-identity", "abc", BasisSetup::Plain);
    let mut head: HeadFact = read_fact(&basis, basis_head_id).expect("Head should decode");
    head.root_digest[0] ^= 0xFF;
    set_fact_attachment(&mut basis, basis_head_id, &head);

    let error = validate_basis(&basis, buffer_id, basis_head_id)
        .expect_err("a misaddressed basis Head must fail validation");

    assert!(error.contains("basis Head identity"), "error was {error:?}");
}

#[test]
fn retained_consequence_authenticates_a_basis_head_before_its_fields() {
    let warp_id = warp_core::make_warp_id("oracle-basis-head-validation-order");
    let (mut basis, buffer_id, basis_head_id, _) = make_basis(
        warp_id,
        "basis-head-validation-order",
        "abc",
        BasisSetup::Plain,
    );
    let mut head: HeadFact = read_fact(&basis, basis_head_id).expect("Head should decode");
    head.root_digest[0] ^= 0xFF;
    head.buffer_id = NodeId([0xA5; 32]).into();
    set_fact_attachment(&mut basis, basis_head_id, &head);

    let error = validate_basis(&basis, buffer_id, basis_head_id)
        .expect_err("a misaddressed basis Head must fail before field interpretation");

    assert!(error.contains("basis Head identity"), "error was {error:?}");
}

#[test]
fn retained_consequence_rejects_whitespace_prefixed_basis_head_bytes() {
    let warp_id = warp_core::make_warp_id("oracle-basis-head-whitespace");
    let (mut basis, buffer_id, basis_head_id, _) =
        make_basis(warp_id, "basis-head-whitespace", "abc", BasisSetup::Plain);
    let basis_head: HeadFact = read_fact(&basis, basis_head_id).expect("Head should decode");
    let mut noncanonical_bytes = vec![b' '];
    noncanonical_bytes.extend(fact_bytes(&basis_head).expect("Head should encode"));
    set_raw_fact_attachment::<HeadFact>(&mut basis, basis_head_id, noncanonical_bytes);

    let error = validate_basis(&basis, buffer_id, basis_head_id)
        .expect_err("whitespace-prefixed basis Head bytes must fail validation");

    assert!(error.contains("basis Head identity"), "error was {error:?}");
}

#[test]
fn retained_consequence_rejects_an_unknown_basis_head_member() {
    let warp_id = warp_core::make_warp_id("oracle-basis-head-unknown-member");
    let (mut basis, buffer_id, basis_head_id, _) = make_basis(
        warp_id,
        "basis-head-unknown-member",
        "abc",
        BasisSetup::Plain,
    );
    let basis_head: HeadFact = read_fact(&basis, basis_head_id).expect("Head should decode");
    let mut noncanonical_bytes = fact_bytes(&basis_head).expect("Head should encode");
    assert_eq!(noncanonical_bytes.pop(), Some(b'}'));
    noncanonical_bytes.extend(br#","unexpected":true}"#);
    set_raw_fact_attachment::<HeadFact>(&mut basis, basis_head_id, noncanonical_bytes);

    let error = validate_basis(&basis, buffer_id, basis_head_id)
        .expect_err("an unknown basis Head member must fail validation");

    assert!(error.contains("basis Head identity"), "error was {error:?}");
}

#[test]
fn retained_consequence_authenticates_invalid_basis_head_bytes_before_decoding() {
    let warp_id = warp_core::make_warp_id("oracle-basis-head-invalid-json");
    let (mut basis, buffer_id, basis_head_id, _) =
        make_basis(warp_id, "basis-head-invalid-json", "abc", BasisSetup::Plain);
    set_raw_fact_attachment::<HeadFact>(&mut basis, basis_head_id, b"{".to_vec());

    let error = validate_basis(&basis, buffer_id, basis_head_id)
        .expect_err("invalid basis Head bytes must not be decoded before authentication");

    assert!(error.contains("basis Head identity"), "error was {error:?}");
}

#[test]
fn retained_consequence_rejects_content_addressed_noncanonical_basis_head_bytes() {
    let warp_id = warp_core::make_warp_id("oracle-basis-head-addressed-noncanonical");
    let (mut basis, buffer_id, basis_head_id, _) = make_basis(
        warp_id,
        "basis-head-addressed-noncanonical",
        "abc",
        BasisSetup::Plain,
    );
    let basis_head: HeadFact = read_fact(&basis, basis_head_id).expect("Head should decode");
    let mut noncanonical_bytes = fact_bytes(&basis_head).expect("Head should encode");
    assert_eq!(noncanonical_bytes.pop(), Some(b'}'));
    noncanonical_bytes.extend(br#","unexpected":true}"#);
    let noncanonical_head_id = insert_raw_content_fact::<HeadFact>(&mut basis, noncanonical_bytes);
    let mut buffer: BufferFact = read_fact(&basis, buffer_id).expect("Buffer should decode");
    buffer.canonical_head_id = noncanonical_head_id.into();
    set_fact_attachment(&mut basis, buffer_id, &buffer);

    let error = validate_basis(&basis, buffer_id, noncanonical_head_id)
        .expect_err("content-addressed noncanonical basis Head bytes must fail validation");

    assert!(
        error.contains("basis Head canonical bytes"),
        "error was {error:?}"
    );
}

#[test]
fn retained_consequence_rejects_a_basis_head_with_the_wrong_node_type() {
    let warp_id = warp_core::make_warp_id("oracle-basis-head-node-type");
    let (mut basis, buffer_id, basis_head_id, _) =
        make_basis(warp_id, "basis-head-node-type", "abc", BasisSetup::Plain);
    basis.insert_node(
        basis_head_id,
        NodeRecord {
            ty: make_type_id("jedit.text.DeliberatelyWrong.v1"),
        },
    );

    assert_basis_validation_fails(&basis, buffer_id, basis_head_id, "basis Head node type");
}

#[test]
fn retained_consequence_rejects_a_basis_head_with_the_wrong_atom_type() {
    let warp_id = warp_core::make_warp_id("oracle-basis-head-atom-type");
    let (mut basis, buffer_id, basis_head_id, _) =
        make_basis(warp_id, "basis-head-atom-type", "abc", BasisSetup::Plain);
    let basis_head: HeadFact = read_fact(&basis, basis_head_id).expect("Head should decode");
    basis.set_node_attachment(
        basis_head_id,
        Some(AttachmentValue::Atom(warp_core::AtomPayload::new(
            make_type_id("jedit.text.DeliberatelyWrong.v1"),
            fact_bytes(&basis_head).expect("Head should encode").into(),
        ))),
    );

    assert_basis_validation_fails(
        &basis,
        buffer_id,
        basis_head_id,
        "basis Head attachment type",
    );
}

#[test]
fn retained_consequence_rejects_a_descended_basis_head_attachment() {
    let warp_id = warp_core::make_warp_id("oracle-basis-head-descended");
    let (mut basis, buffer_id, basis_head_id, _) =
        make_basis(warp_id, "basis-head-descended", "abc", BasisSetup::Plain);
    basis.set_node_attachment(
        basis_head_id,
        Some(AttachmentValue::Descend(warp_core::make_warp_id(
            "oracle-basis-head-child",
        ))),
    );

    assert_basis_validation_fails(
        &basis,
        buffer_id,
        basis_head_id,
        "basis Head uses a descended attachment",
    );
}

fn assert_basis_validation_fails(
    basis: &GraphStore,
    buffer_id: NodeId,
    basis_head_id: NodeId,
    message: &str,
) {
    let error = validate_basis(basis, buffer_id, basis_head_id)
        .expect_err("a structurally malformed basis Head must fail validation");

    assert!(error.contains(message), "error was {error:?}");
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

fn corrupt_buffer_key(store: &mut GraphStore, buffer_id: NodeId) {
    let mut buffer: BufferFact = read_fact(store, buffer_id).expect("Buffer should decode");
    buffer.buffer_key = "deliberately-misaddressed".to_owned();
    store.set_node_attachment(
        buffer_id,
        Some(AttachmentValue::Atom(warp_core::AtomPayload::new(
            fact_type_id::<BufferFact>(),
            fact_bytes(&buffer).expect("Buffer should encode").into(),
        ))),
    );
}
