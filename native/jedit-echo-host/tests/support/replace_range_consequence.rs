use jedit_echo_host::error::HostError;
use jedit_echo_host::identity::hash_bytes;
use jedit_echo_host::records::{
    decode_fact, fact_id, fact_type_id, BufferFact, DiffFact, HeadFact, RewriteFact,
    EMPTY_ROOT_DIGEST_DOMAIN,
};
use jedit_echo_host::rope::{read_window, MutationPlan};
use warp_core::{GraphStore, NodeId, TypeId};

#[derive(Debug)]
pub(super) struct ValidatedConsequence {
    pub(super) buffer: BufferFact,
    pub(super) head: HeadFact,
    pub(super) rewrite_id: NodeId,
    pub(super) diff_id: NodeId,
    pub(super) materialized_text: String,
}

pub(super) fn validate_consequence(
    basis: &GraphStore,
    next: &GraphStore,
    plan: &MutationPlan,
    basis_head_id: NodeId,
    start_byte: u64,
    end_byte: u64,
    replacement: &str,
) -> Result<ValidatedConsequence, String> {
    let basis_buffer: BufferFact = read_fact(basis, plan.buffer_id)?;
    require_equal(
        "basis Buffer canonical head",
        NodeId::from(basis_buffer.canonical_head_id),
        basis_head_id,
    )?;
    let basis_head: HeadFact = read_fact(basis, basis_head_id)?;
    let buffer: BufferFact = read_fact(next, plan.buffer_id)?;
    require_equal(
        "result Buffer canonical head",
        NodeId::from(buffer.canonical_head_id),
        plan.head_id,
    )?;
    require_equal(
        "result Buffer key",
        &buffer.buffer_key,
        &basis_buffer.buffer_key,
    )?;
    require_equal(
        "result Buffer projection path",
        &buffer.projection_path,
        &basis_buffer.projection_path,
    )?;
    let expected_version = basis_buffer
        .version
        .checked_add(1)
        .ok_or_else(|| "basis Buffer version overflowed during validation".to_owned())?;
    require_equal("result Buffer version", buffer.version, expected_version)?;
    require_equal("plan Buffer version", plan.version, buffer.version)?;

    let head: HeadFact = read_fact(next, plan.head_id)?;
    require_equal(
        "result Head identity",
        fact_id(&head).map_err(host_error)?,
        plan.head_id,
    )?;
    require_equal(
        "result Head buffer",
        NodeId::from(head.buffer_id),
        plan.buffer_id,
    )?;
    require_equal(
        "result Head basis",
        head.basis_head_id.map(NodeId::from),
        Some(basis_head_id),
    )?;
    require_equal(
        "result Head byte length",
        head.byte_length,
        plan.byte_length,
    )?;
    require_equal("result Head line count", head.line_count, plan.line_count)?;
    let expected_sequence = basis_head
        .sequence
        .checked_add(1)
        .ok_or_else(|| "basis Head sequence overflowed during validation".to_owned())?;
    require_equal("result Head sequence", head.sequence, expected_sequence)?;
    let expected_root_digest = head
        .root_node_id
        .map_or_else(|| hash_bytes(EMPTY_ROOT_DIGEST_DOMAIN, &[]), |id| id.0);
    require_equal(
        "result Head root digest",
        head.root_digest,
        expected_root_digest,
    )?;

    let inserted_byte_length = u64::try_from(replacement.len())
        .map_err(|_| "replacement length exceeds u64".to_owned())?;
    let deleted_byte_length = end_byte
        .checked_sub(start_byte)
        .ok_or_else(|| "validated range is reversed".to_owned())?;
    let rewrite_id = node_with_type(next, fact_type_id::<RewriteFact>())?;
    let rewrite: RewriteFact = read_fact(next, rewrite_id)?;
    require_equal(
        "Rewrite identity",
        fact_id(&rewrite).map_err(host_error)?,
        rewrite_id,
    )?;
    require_equal(
        "Rewrite buffer",
        NodeId::from(rewrite.buffer_id),
        plan.buffer_id,
    )?;
    require_equal(
        "Rewrite basis",
        NodeId::from(rewrite.basis_head_id),
        basis_head_id,
    )?;
    require_equal(
        "Rewrite next head",
        NodeId::from(rewrite.next_head_id),
        plan.head_id,
    )?;
    require_equal("Rewrite start", rewrite.start_byte, start_byte)?;
    require_equal("Rewrite end", rewrite.end_byte, end_byte)?;
    require_equal(
        "Rewrite inserted length",
        rewrite.inserted_byte_length,
        inserted_byte_length,
    )?;

    let diff_id = node_with_type(next, fact_type_id::<DiffFact>())?;
    let diff: DiffFact = read_fact(next, diff_id)?;
    require_equal(
        "Diff identity",
        fact_id(&diff).map_err(host_error)?,
        diff_id,
    )?;
    require_equal("Diff rewrite", NodeId::from(diff.rewrite_id), rewrite_id)?;
    require_equal(
        "Diff basis",
        NodeId::from(diff.basis_head_id),
        basis_head_id,
    )?;
    require_equal(
        "Diff next head",
        NodeId::from(diff.next_head_id),
        plan.head_id,
    )?;
    require_equal("Diff start", diff.start_byte, start_byte)?;
    require_equal("Diff end", diff.end_byte, end_byte)?;
    require_equal(
        "Diff inserted length",
        diff.inserted_byte_length,
        inserted_byte_length,
    )?;
    require_equal(
        "Diff deleted length",
        diff.deleted_byte_length,
        deleted_byte_length,
    )?;

    let window = read_window(
        next,
        plan.buffer_id,
        plan.head_id,
        0,
        head.byte_length,
        head.byte_length,
    )
    .map_err(host_error)?;
    let materialized_text = window.text;
    require_equal(
        "result Head UTF-16 length",
        head.utf16_length,
        materialized_text.encode_utf16().count() as u64,
    )?;
    require_equal(
        "result Head materialized line count",
        head.line_count,
        materialized_text
            .bytes()
            .filter(|byte| *byte == b'\n')
            .count() as u64
            + 1,
    )?;

    Ok(ValidatedConsequence {
        buffer,
        head,
        rewrite_id,
        diff_id,
        materialized_text,
    })
}

fn node_with_type(store: &GraphStore, type_id: TypeId) -> Result<NodeId, String> {
    let matches: Vec<_> = store
        .iter_nodes()
        .filter_map(|(node_id, record)| (record.ty == type_id).then_some(node_id))
        .collect();
    let [node_id] = matches.as_slice() else {
        return Err(format!(
            "expected exactly one fact of type {}, received {}",
            hex::encode(type_id.as_bytes()),
            matches.len()
        ));
    };
    Ok(**node_id)
}

fn read_fact<F: jedit_echo_host::records::TypedFact>(
    store: &GraphStore,
    node_id: NodeId,
) -> Result<F, String> {
    let attachment = store
        .node_attachment(&node_id)
        .ok_or_else(|| format!("missing retained fact {}", hex::encode(node_id.as_bytes())))?;
    decode_fact(attachment).map_err(host_error)
}

fn require_equal<T: std::fmt::Debug + PartialEq>(
    label: &str,
    actual: T,
    expected: T,
) -> Result<(), String> {
    if actual != expected {
        return Err(format!(
            "{label} differs: expected {expected:?}, received {actual:?}"
        ));
    }
    Ok(())
}

fn host_error(error: HostError) -> String {
    error.to_string()
}

#[cfg(test)]
mod tests {
    use super::super::{apply_ops, make_basis, BasisSetup};
    use super::*;
    use jedit_echo_host::records::{fact_bytes, BufferFact};
    use jedit_echo_host::rope::plan_replace;
    use warp_core::{AttachmentValue, TickDelta};

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
        apply_ops(&mut next, &delta.finalize());

        validate_consequence(&basis, &next, &plan, basis_head_id, 1, 2, "XY")
            .expect("retained consequence should be internally consistent");
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
        apply_ops(&mut next, &delta.finalize());
        let mut buffer: BufferFact = read_fact(&next, buffer_id).expect("Buffer should decode");
        buffer.canonical_head_id = basis_head_id.into();
        next.set_node_attachment(
            buffer_id,
            Some(AttachmentValue::Atom(warp_core::AtomPayload::new(
                fact_type_id::<BufferFact>(),
                fact_bytes(&buffer).expect("Buffer should encode").into(),
            ))),
        );

        let error = validate_consequence(&basis, &next, &plan, basis_head_id, 1, 2, "XY")
            .expect_err("inconsistent retained consequence should fail");
        assert!(error.contains("result Buffer canonical head"));
    }
}
