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
) -> RopeResult<Option<NodeId>> {
    let text = std::str::from_utf8(bytes).map_err(|error| {
        RopeFault::structural_dependency(HostError::InvalidRequest(format!(
            "text is not UTF-8: {error}"
        )))
    })?;
    if text.is_empty() {
        return Ok(None);
    }
    let mut roots = Vec::new();
    let mut start = 0;
    while start < text.len() {
        let mut end = start.saturating_add(MAX_LEAF_BYTES).min(text.len());
        while end > start && !text.is_char_boundary(end) {
            end -= 1;
        }
        if end == start {
            return Err(RopeFault::structural_dependency(HostError::InvalidRequest(
                "unable to split UTF-8 leaf".to_owned(),
            )));
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
) -> RopeResult<NodeId> {
    let text = std::str::from_utf8(&bytes).map_err(|error| {
        RopeFault::structural_dependency(HostError::InvalidRequest(format!(
            "leaf is not UTF-8: {error}"
        )))
    })?;
    let utf16_length = u64::try_from(text.encode_utf16().count())
        .map_err(|_| RopeFault::arithmetic_overflow("leaf UTF-16 length overflow"))?;
    let line_breaks = u64::try_from(bytes.iter().filter(|byte| **byte == b'\n').count())
        .map_err(|_| RopeFault::arithmetic_overflow("leaf line break count overflow"))?;
    let blob = BlobFact {
        content_hash: hash_bytes(BLOB_CONTENT_HASH_DOMAIN, &bytes),
        bytes,
    };
    let byte_length = u64::try_from(blob.bytes.len())
        .map_err(|_| RopeFault::arithmetic_overflow("leaf byte length overflow"))?;
    let blob_id = context
        .write_content_fact(&blob)
        .map_err(RopeFault::structural_dependency)?;
    context
        .write_content_fact(&LeafFact {
            blob_id: blob_id.into(),
            byte_start: 0,
            byte_length,
            utf16_length,
            line_breaks,
        })
        .map_err(RopeFault::structural_dependency)
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
    let absolute_start =
        RopeFault::checked_add_u64(leaf.byte_start, relative_start, "leaf range start overflow")?;
    let absolute_end =
        RopeFault::checked_add_u64(absolute_start, byte_length, "leaf range end overflow")?;
    let start = usize::try_from(absolute_start).map_err(|_| {
        RopeFault::declared_rope_inconsistent("leaf offset exceeds addressable memory".to_owned())
    })?;
    let end = usize::try_from(absolute_end).map_err(|_| {
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
        byte_start: absolute_start,
        byte_length,
        utf16_length: u64::try_from(text.encode_utf16().count())
            .map_err(|_| RopeFault::arithmetic_overflow("leaf UTF-16 length overflow"))?,
        line_breaks: u64::try_from(slice.iter().filter(|byte| **byte == b'\n').count())
            .map_err(|_| RopeFault::arithmetic_overflow("leaf line break count overflow"))?,
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
        RopeNode::Leaf(leaf) => {
            let suffix_length = leaf.byte_length.checked_sub(offset).ok_or_else(|| {
                RopeFault::declared_rope_inconsistent(
                    "leaf split exceeds declared length".to_owned(),
                )
            })?;
            Ok((
                make_leaf_slice(context, &leaf, 0, offset)?,
                make_leaf_slice(context, &leaf, offset, suffix_length)?,
            ))
        }
        RopeNode::Branch(branch) => {
            let left = NodeId::from(branch.left);
            let right = NodeId::from(branch.right);
            let left_length = context
                .node_metrics(left)
                .map_err(RopeFault::structural_dependency)?
                .byte_length;
            if offset < left_length {
                let (prefix, middle) = split(context, Some(left), offset)?;
                Ok((prefix, join(context, middle, Some(right))?))
            } else if offset == left_length {
                Ok((Some(left), Some(right)))
            } else {
                let right_offset = offset.checked_sub(left_length).ok_or_else(|| {
                    RopeFault::declared_rope_inconsistent(
                        "branch split offset underflow".to_owned(),
                    )
                })?;
                let (middle, suffix) = split(context, Some(right), right_offset)?;
                Ok((join(context, Some(left), middle)?, suffix))
            }
        }
    }
}

pub(super) fn join<T: GraphFacts>(
    context: &mut PlanContext<'_, T>,
    left: Option<NodeId>,
    right: Option<NodeId>,
) -> RopeResult<Option<NodeId>> {
    let (Some(left_id), Some(right_id)) = (left, right) else {
        return Ok(left.or(right));
    };
    let left_metrics = context
        .node_metrics(left_id)
        .map_err(RopeFault::structural_dependency)?;
    let right_metrics = context
        .node_metrics(right_id)
        .map_err(RopeFault::structural_dependency)?;
    let right_height_limit =
        RopeFault::checked_add_u32(right_metrics.height, 1, "right rope height overflow")?;
    if left_metrics.height > right_height_limit {
        let RopeNode::Branch(left_branch) = context
            .rope_node(left_id)
            .map_err(RopeFault::structural_dependency)?
        else {
            return Err(RopeFault::fact_malformed(
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
    let left_height_limit =
        RopeFault::checked_add_u32(left_metrics.height, 1, "left rope height overflow")?;
    if right_metrics.height > left_height_limit {
        let RopeNode::Branch(right_branch) = context
            .rope_node(right_id)
            .map_err(RopeFault::structural_dependency)?
        else {
            return Err(RopeFault::fact_malformed(
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
        byte_length: RopeFault::checked_add_u64(
            left_metrics.byte_length,
            right_metrics.byte_length,
            "rope byte length overflow",
        )?,
        utf16_length: RopeFault::checked_add_u64(
            left_metrics.utf16_length,
            right_metrics.utf16_length,
            "rope UTF-16 length overflow",
        )?,
        line_breaks: RopeFault::checked_add_u64(
            left_metrics.line_breaks,
            right_metrics.line_breaks,
            "rope line break count overflow",
        )?,
        height: RopeFault::checked_add_u32(
            left_metrics.height.max(right_metrics.height),
            1,
            "rope height overflow",
        )?,
    };
    context
        .write_content_fact(&branch)
        .map(Some)
        .map_err(RopeFault::structural_dependency)
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

#[cfg(test)]
mod tests {
    use warp_core::{make_warp_id, GraphStore};

    use super::*;
    use crate::records::NodeIdBytes;

    #[test]
    fn join_refuses_left_height_overflow_with_structural_provenance() {
        let store = GraphStore::new(make_warp_id("left-height-overflow"));
        let mut context = PlanContext::new(&store);
        let child = NodeIdBytes([0xA5; 32]);
        let left = context
            .write_content_fact(&BranchFact {
                left: child,
                right: child,
                byte_length: 0,
                utf16_length: 0,
                line_breaks: 0,
                height: u32::MAX,
            })
            .expect("left fixture should identify");
        let right = context
            .write_content_fact(&BranchFact {
                left: child,
                right: child,
                byte_length: 0,
                utf16_length: 0,
                line_breaks: 0,
                height: u32::MAX - 1,
            })
            .expect("right fixture should identify");

        let error = join(&mut context, Some(left), Some(right))
            .expect_err("left height overflow must obstruct joining");
        let (kind, legacy) = error.into_parts();
        assert_eq!(kind, super::super::fault::RopeFaultKind::ArithmeticOverflow);
        assert!(matches!(
            legacy,
            HostError::MalformedFact(message) if message == "left rope height overflow"
        ));
    }
}
