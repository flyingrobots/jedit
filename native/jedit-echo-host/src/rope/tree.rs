use warp_core::NodeId;

use crate::error::{HostError, HostResult};
use crate::identity::{hash_bytes, node_id_hex};
use crate::records::{
    BlobFact, BranchFact, LeafFact, BLOB_CONTENT_HASH_DOMAIN, EMPTY_ROOT_DIGEST_DOMAIN,
};

use super::fault::{RopeFault, RopeResult};
use super::{GraphFacts, NodeMetrics, PlanContext, RopeNode, MAX_LEAF_BYTES};
pub(super) fn build_text<T: GraphFacts>(
    context: &mut PlanContext<'_, T>,
    bytes: &[u8],
) -> HostResult<Option<NodeId>> {
    let text = std::str::from_utf8(bytes)
        .map_err(|error| HostError::InvalidRequest(format!("text is not UTF-8: {error}")))?;
    if text.is_empty() {
        return Ok(None);
    }
    let mut roots = Vec::new();
    let mut start = 0;
    while start < text.len() {
        let mut end = (start + MAX_LEAF_BYTES).min(text.len());
        while end > start && !text.is_char_boundary(end) {
            end -= 1;
        }
        if end == start {
            return Err(HostError::InvalidRequest(
                "unable to split UTF-8 leaf".to_owned(),
            ));
        }
        roots.push(make_blob_leaf(
            context,
            text.as_bytes()[start..end].to_vec(),
        )?);
        start = end;
    }
    let mut root = None;
    for leaf in roots {
        root = join(context, root, Some(leaf))?;
    }
    Ok(root)
}

fn make_blob_leaf<T: GraphFacts>(
    context: &mut PlanContext<'_, T>,
    bytes: Vec<u8>,
) -> HostResult<NodeId> {
    let text = std::str::from_utf8(&bytes)
        .map_err(|error| HostError::InvalidRequest(format!("leaf is not UTF-8: {error}")))?;
    let utf16_length = text.encode_utf16().count() as u64;
    let line_breaks = bytes.iter().filter(|byte| **byte == b'\n').count() as u64;
    let blob = BlobFact {
        content_hash: hash_bytes(BLOB_CONTENT_HASH_DOMAIN, &bytes),
        bytes,
    };
    let byte_length = blob.bytes.len() as u64;
    let blob_id = context.write_content_fact(&blob)?;
    context.write_content_fact(&LeafFact {
        blob_id: blob_id.into(),
        byte_start: 0,
        byte_length,
        utf16_length,
        line_breaks,
    })
}

fn make_leaf_slice<T: GraphFacts>(
    context: &mut PlanContext<'_, T>,
    leaf: &LeafFact,
    relative_start: u64,
    byte_length: u64,
) -> RopeResult<Option<NodeId>> {
    if byte_length == 0 {
        return Ok(None);
    }
    let blob_id = NodeId::from(leaf.blob_id);
    let bytes = context.verified_blob_fault(blob_id)?.bytes;
    let start = usize::try_from(leaf.byte_start + relative_start).map_err(|_| {
        RopeFault::declared_rope_inconsistent("leaf offset exceeds addressable memory".to_owned())
    })?;
    let end = usize::try_from(leaf.byte_start + relative_start + byte_length).map_err(|_| {
        RopeFault::declared_rope_inconsistent("leaf end exceeds addressable memory".to_owned())
    })?;
    let slice = bytes.get(start..end).ok_or_else(|| {
        RopeFault::fact_malformed(format!("leaf {} exceeds blob bounds", node_id_hex(blob_id)))
    })?;
    let text = std::str::from_utf8(slice).map_err(|_| {
        RopeFault::invalid_utf8_slice("replace offset splits a UTF-8 code point".to_owned())
    })?;
    let fact = LeafFact {
        blob_id: leaf.blob_id,
        byte_start: leaf.byte_start + relative_start,
        byte_length,
        utf16_length: text.encode_utf16().count() as u64,
        line_breaks: slice.iter().filter(|byte| **byte == b'\n').count() as u64,
    };
    context
        .write_content_fact(&fact)
        .map(Some)
        .map_err(RopeFault::structural_dependency)
}

pub(super) fn split<T: GraphFacts>(
    context: &mut PlanContext<'_, T>,
    root: Option<NodeId>,
    offset: u64,
) -> RopeResult<(Option<NodeId>, Option<NodeId>)> {
    let Some(root_id) = root else {
        if offset == 0 {
            return Ok((None, None));
        }
        return Err(RopeFault::declared_rope_inconsistent(
            "split exceeds empty rope".to_owned(),
        ));
    };
    let metrics = context
        .node_metrics(root_id)
        .map_err(RopeFault::structural_dependency)?;
    if offset > metrics.byte_length {
        return Err(RopeFault::declared_rope_inconsistent(
            "split exceeds rope length".to_owned(),
        ));
    }
    if offset == 0 {
        return Ok((None, Some(root_id)));
    }
    if offset == metrics.byte_length {
        return Ok((Some(root_id), None));
    }
    match context
        .rope_node(root_id)
        .map_err(RopeFault::structural_dependency)?
    {
        RopeNode::Leaf(leaf) => Ok((
            make_leaf_slice(context, &leaf, 0, offset)?,
            make_leaf_slice(context, &leaf, offset, leaf.byte_length - offset)?,
        )),
        RopeNode::Branch(branch) => {
            let left = NodeId::from(branch.left);
            let right = NodeId::from(branch.right);
            let left_length = context
                .node_metrics(left)
                .map_err(RopeFault::structural_dependency)?
                .byte_length;
            if offset < left_length {
                let (prefix, middle) = split(context, Some(left), offset)?;
                Ok((
                    prefix,
                    join(context, middle, Some(right)).map_err(RopeFault::structural_dependency)?,
                ))
            } else if offset == left_length {
                Ok((Some(left), Some(right)))
            } else {
                let (middle, suffix) = split(context, Some(right), offset - left_length)?;
                Ok((
                    join(context, Some(left), middle).map_err(RopeFault::structural_dependency)?,
                    suffix,
                ))
            }
        }
    }
}

pub(super) fn join<T: GraphFacts>(
    context: &mut PlanContext<'_, T>,
    left: Option<NodeId>,
    right: Option<NodeId>,
) -> HostResult<Option<NodeId>> {
    let (Some(left_id), Some(right_id)) = (left, right) else {
        return Ok(left.or(right));
    };
    let left_metrics = context.node_metrics(left_id)?;
    let right_metrics = context.node_metrics(right_id)?;
    if left_metrics.height > right_metrics.height + 1 {
        let RopeNode::Branch(left_branch) = context.rope_node(left_id)? else {
            return Err(HostError::MalformedFact(
                "unbalanced leaf height".to_owned(),
            ));
        };
        let joined = join(
            context,
            Some(NodeId::from(left_branch.right)),
            Some(right_id),
        )?;
        return join(context, Some(NodeId::from(left_branch.left)), joined);
    }
    if right_metrics.height > left_metrics.height + 1 {
        let RopeNode::Branch(right_branch) = context.rope_node(right_id)? else {
            return Err(HostError::MalformedFact(
                "unbalanced leaf height".to_owned(),
            ));
        };
        let joined = join(
            context,
            Some(left_id),
            Some(NodeId::from(right_branch.left)),
        )?;
        return join(context, joined, Some(NodeId::from(right_branch.right)));
    }
    let branch = BranchFact {
        left: left_id.into(),
        right: right_id.into(),
        byte_length: left_metrics.byte_length + right_metrics.byte_length,
        utf16_length: left_metrics.utf16_length + right_metrics.utf16_length,
        line_breaks: left_metrics.line_breaks + right_metrics.line_breaks,
        height: left_metrics.height.max(right_metrics.height) + 1,
    };
    context.write_content_fact(&branch).map(Some)
}

pub(super) fn root_metrics<T: GraphFacts>(
    context: &mut PlanContext<'_, T>,
    root: Option<NodeId>,
) -> HostResult<NodeMetrics> {
    match root {
        Some(id) => context.node_metrics(id),
        None => Ok(NodeMetrics {
            byte_length: 0,
            utf16_length: 0,
            line_breaks: 0,
            height: 0,
        }),
    }
}

pub(super) fn root_digest(root: Option<NodeId>) -> [u8; 32] {
    root.map_or_else(
        || hash_bytes(EMPTY_ROOT_DIGEST_DOMAIN, &[]),
        |id| *id.as_bytes(),
    )
}
