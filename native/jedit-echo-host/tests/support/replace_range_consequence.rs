use std::collections::BTreeSet;

use jedit_echo_host::error::HostError;
use jedit_echo_host::identity::{content_node_id, hash_bytes};
use jedit_echo_host::records::{
    decode_fact, fact_bytes, fact_id, fact_type_id, BufferFact, ContentAddressedFact, DiffFact,
    HeadFact, RewriteFact, EMPTY_ROOT_DIGEST_DOMAIN,
};
use jedit_echo_host::rope::{buffer_node_id, read_window, MutationPlan};
use warp_core::{AttachmentValue, GraphStore, NodeId, TypeId, WarpId, WarpOp};

#[derive(Debug)]
pub(super) struct ValidatedConsequence {
    pub(super) buffer: BufferFact,
    pub(super) head: HeadFact,
    pub(super) rewrite_id: NodeId,
    pub(super) diff_id: NodeId,
    pub(super) materialized_text: String,
}

#[derive(Clone, Copy)]
pub(super) struct ReplaceExpectation<'a> {
    pub(super) basis_head_id: NodeId,
    pub(super) start_byte: u64,
    pub(super) end_byte: u64,
    pub(super) replacement: &'a str,
}

pub(super) fn validate_consequence(
    basis: &GraphStore,
    next: &GraphStore,
    plan: &MutationPlan,
    patch: &[WarpOp],
    expectation: ReplaceExpectation<'_>,
) -> Result<ValidatedConsequence, String> {
    let ReplaceExpectation {
        basis_head_id,
        start_byte,
        end_byte,
        replacement,
    } = expectation;
    let (basis_buffer, basis_head) = validate_basis(basis, plan.buffer_id, basis_head_id)?;
    let buffer: BufferFact = read_fact(next, plan.buffer_id)?;
    require_equal(
        "result Buffer keyed identity",
        buffer_node_id(&buffer.buffer_key),
        plan.buffer_id,
    )?;
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
    let rewrite_id = patch_node_with_type(patch, basis.warp_id(), fact_type_id::<RewriteFact>())?;
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

    let diff_id = patch_node_with_type(patch, basis.warp_id(), fact_type_id::<DiffFact>())?;
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

fn validate_basis(
    basis: &GraphStore,
    buffer_id: NodeId,
    basis_head_id: NodeId,
) -> Result<(BufferFact, HeadFact), String> {
    let basis_buffer: BufferFact = read_fact(basis, buffer_id)?;
    require_equal(
        "basis Buffer keyed identity",
        buffer_node_id(&basis_buffer.buffer_key),
        buffer_id,
    )?;
    require_equal(
        "basis Buffer canonical head",
        NodeId::from(basis_buffer.canonical_head_id),
        basis_head_id,
    )?;
    let basis_head: HeadFact = read_content_fact(basis, basis_head_id, "basis Head")?;
    require_equal(
        "basis Head buffer",
        NodeId::from(basis_head.buffer_id),
        buffer_id,
    )?;
    Ok((basis_buffer, basis_head))
}

fn patch_node_with_type(
    patch: &[WarpOp],
    warp_id: WarpId,
    type_id: TypeId,
) -> Result<NodeId, String> {
    let mut matches = BTreeSet::new();
    for operation in patch {
        let WarpOp::UpsertNode { node, record } = operation else {
            continue;
        };
        if record.ty != type_id {
            continue;
        }
        if node.warp_id != warp_id {
            return Err(format!(
                "patch fact type {} belongs to foreign WARP {}",
                hex::encode(type_id.as_bytes()),
                hex::encode(node.warp_id.as_bytes())
            ));
        }
        matches.insert(node.local_id);
    }
    if matches.len() != 1 {
        return Err(format!(
            "expected exactly one patch fact of type {}, received {}",
            hex::encode(type_id.as_bytes()),
            matches.len()
        ));
    }
    Ok(*matches
        .first()
        .expect("one patch fact must exist after the length check"))
}

fn read_content_fact<F: ContentAddressedFact>(
    store: &GraphStore,
    node_id: NodeId,
    label: &str,
) -> Result<F, String> {
    let record = store
        .node(&node_id)
        .ok_or_else(|| format!("missing retained node {}", hex::encode(node_id.as_bytes())))?;
    require_equal(
        &format!("{label} node type"),
        record.ty,
        fact_type_id::<F>(),
    )?;
    let attachment = store
        .node_attachment(&node_id)
        .ok_or_else(|| format!("missing retained fact {}", hex::encode(node_id.as_bytes())))?;
    let AttachmentValue::Atom(payload) = attachment else {
        return Err(format!("{label} uses a descended attachment"));
    };
    require_equal(
        &format!("{label} attachment type"),
        payload.type_id,
        fact_type_id::<F>(),
    )?;
    require_equal(
        &format!("{label} identity"),
        content_node_id(F::ID_DOMAIN, payload.bytes.as_ref()),
        node_id,
    )?;
    let fact = decode_fact(attachment).map_err(host_error)?;
    require_equal(
        &format!("{label} canonical bytes"),
        fact_bytes(&fact).map_err(host_error)?.as_slice(),
        payload.bytes.as_ref(),
    )?;
    Ok(fact)
}

fn read_fact<F: jedit_echo_host::records::TypedFact>(
    store: &GraphStore,
    node_id: NodeId,
) -> Result<F, String> {
    let record = store
        .node(&node_id)
        .ok_or_else(|| format!("missing retained node {}", hex::encode(node_id.as_bytes())))?;
    let expected_type = fact_type_id::<F>();
    if record.ty != expected_type {
        return Err(format!(
            "{} node {} declares type {}, expected {}",
            F::TYPE_LABEL,
            hex::encode(node_id.as_bytes()),
            hex::encode(record.ty.as_bytes()),
            hex::encode(expected_type.as_bytes())
        ));
    }
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
#[path = "replace_range_consequence_tests.rs"]
mod tests;
