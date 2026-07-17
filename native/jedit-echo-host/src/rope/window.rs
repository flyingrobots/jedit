use warp_core::NodeId;

use crate::error::{HostError, HostResult};
use crate::identity::node_id_hex;
use crate::records::{BufferFact, HeadFact};

use super::{GraphFacts, PlanContext, RopeNode};

#[derive(Clone, Debug, serde::Deserialize, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WindowSupport {
    pub leaf_id: String,
    pub blob_id: String,
    pub content_hash: String,
    pub start_byte: u64,
    pub end_byte: u64,
}

#[derive(Clone, Debug, serde::Deserialize, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WindowLine {
    pub line_number: u64,
    pub start_byte: u64,
    pub end_byte: u64,
    pub text: String,
}

#[derive(Clone, Debug, serde::Deserialize, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WindowProjection {
    pub buffer_id: String,
    pub basis_head_id: String,
    pub root_node_id: Option<String>,
    pub byte_length: u64,
    pub line_count: u64,
    pub start_byte: u64,
    pub end_byte: u64,
    pub text: String,
    pub lines: Vec<WindowLine>,
    pub support: Vec<WindowSupport>,
}

pub fn read_window<T: GraphFacts>(
    source: &T,
    buffer_id: NodeId,
    basis_head_id: NodeId,
    start_byte: u64,
    end_byte: u64,
    max_bytes: u64,
) -> HostResult<WindowProjection> {
    let mut context = PlanContext::new(source);
    let _buffer: BufferFact = context.read_fact(buffer_id)?;
    let head: HeadFact = context.read_fact(basis_head_id)?;
    if NodeId::from(head.buffer_id) != buffer_id {
        return Err(HostError::InvalidRequest(
            "basis head belongs to another buffer".to_owned(),
        ));
    }
    if start_byte > end_byte || end_byte > head.byte_length {
        return Err(HostError::InvalidRequest(format!(
            "window {start_byte}..{end_byte} exceeds {} bytes",
            head.byte_length
        )));
    }
    if end_byte - start_byte > max_bytes {
        return Err(HostError::InvalidRequest(format!(
            "window exceeds maxBytes {max_bytes}"
        )));
    }
    let mut bytes = Vec::new();
    let mut support = Vec::new();
    if let Some(root) = head.root_node_id.map(NodeId::from) {
        collect_range(
            &mut context,
            root,
            0,
            start_byte,
            end_byte,
            &mut bytes,
            &mut support,
        )?;
    }
    let text = String::from_utf8(bytes).map_err(|_| {
        HostError::InvalidRequest("window range splits a UTF-8 code point".to_owned())
    })?;
    let first_line = if let Some(root) = head.root_node_id.map(NodeId::from) {
        count_breaks_before(&mut context, root, start_byte)?
    } else {
        0
    };
    let lines = window_lines(&text, first_line, start_byte);
    Ok(WindowProjection {
        buffer_id: node_id_hex(buffer_id),
        basis_head_id: node_id_hex(basis_head_id),
        root_node_id: head.root_node_id.map(NodeId::from).map(node_id_hex),
        byte_length: head.byte_length,
        line_count: head.line_count,
        start_byte,
        end_byte,
        text,
        lines,
        support,
    })
}

pub(super) fn read_range_bytes<T: GraphFacts>(
    context: &mut PlanContext<'_, T>,
    root: Option<NodeId>,
    start_byte: u64,
    end_byte: u64,
) -> HostResult<Vec<u8>> {
    let mut bytes = Vec::new();
    let mut support = Vec::new();
    if let Some(root_id) = root {
        collect_range(
            context,
            root_id,
            0,
            start_byte,
            end_byte,
            &mut bytes,
            &mut support,
        )?;
    }
    Ok(bytes)
}

#[allow(clippy::too_many_arguments)]
fn collect_range<T: GraphFacts>(
    context: &mut PlanContext<'_, T>,
    node_id: NodeId,
    node_start: u64,
    range_start: u64,
    range_end: u64,
    output: &mut Vec<u8>,
    support: &mut Vec<WindowSupport>,
) -> HostResult<()> {
    let metrics = context.node_metrics(node_id)?;
    let node_end = node_start + metrics.byte_length;
    if range_end <= node_start || range_start >= node_end {
        return Ok(());
    }
    match context.rope_node(node_id)? {
        RopeNode::Branch(branch) => {
            let left = NodeId::from(branch.left);
            let left_length = context.node_metrics(left)?.byte_length;
            collect_range(
                context,
                left,
                node_start,
                range_start,
                range_end,
                output,
                support,
            )?;
            collect_range(
                context,
                NodeId::from(branch.right),
                node_start + left_length,
                range_start,
                range_end,
                output,
                support,
            )
        }
        RopeNode::Leaf(leaf) => {
            let overlap_start = range_start.max(node_start);
            let overlap_end = range_end.min(node_end);
            let blob_id = NodeId::from(leaf.blob_id);
            let blob = context.verified_blob(blob_id)?;
            let relative_start = usize::try_from(leaf.byte_start + overlap_start - node_start)
                .map_err(|_| {
                    HostError::InvalidRequest("window offset exceeds memory".to_owned())
                })?;
            let relative_end = usize::try_from(leaf.byte_start + overlap_end - node_start)
                .map_err(|_| HostError::InvalidRequest("window end exceeds memory".to_owned()))?;
            let slice = blob
                .bytes
                .get(relative_start..relative_end)
                .ok_or_else(|| {
                    HostError::MalformedFact(format!("leaf {} exceeds blob", node_id_hex(node_id)))
                })?;
            output.extend_from_slice(slice);
            support.push(WindowSupport {
                leaf_id: node_id_hex(node_id),
                blob_id: node_id_hex(blob_id),
                content_hash: hex::encode(blob.content_hash),
                start_byte: overlap_start,
                end_byte: overlap_end,
            });
            Ok(())
        }
    }
}

fn count_breaks_before<T: GraphFacts>(
    context: &mut PlanContext<'_, T>,
    node_id: NodeId,
    offset: u64,
) -> HostResult<u64> {
    if offset == 0 {
        return Ok(0);
    }
    match context.rope_node(node_id)? {
        RopeNode::Branch(branch) => {
            let left = NodeId::from(branch.left);
            let left_metrics = context.node_metrics(left)?;
            if offset <= left_metrics.byte_length {
                count_breaks_before(context, left, offset)
            } else {
                Ok(left_metrics.line_breaks
                    + count_breaks_before(
                        context,
                        NodeId::from(branch.right),
                        offset - left_metrics.byte_length,
                    )?)
            }
        }
        RopeNode::Leaf(leaf) => {
            let blob = context.blob_bytes(NodeId::from(leaf.blob_id))?;
            let start = usize::try_from(leaf.byte_start)
                .map_err(|_| HostError::InvalidRequest("leaf start exceeds memory".to_owned()))?;
            let end = usize::try_from(leaf.byte_start + offset)
                .map_err(|_| HostError::InvalidRequest("leaf offset exceeds memory".to_owned()))?;
            let bytes = blob.get(start..end).ok_or_else(|| {
                HostError::MalformedFact("line prefix exceeds leaf blob".to_owned())
            })?;
            Ok(bytes.iter().filter(|byte| **byte == b'\n').count() as u64)
        }
    }
}

fn window_lines(text: &str, first_line: u64, start_byte: u64) -> Vec<WindowLine> {
    let mut lines = Vec::new();
    let mut relative_start = 0usize;
    for (index, segment) in text.split_inclusive('\n').enumerate() {
        let content = segment.strip_suffix('\n').unwrap_or(segment);
        let content = content.strip_suffix('\r').unwrap_or(content);
        let relative_end = relative_start + content.len();
        lines.push(WindowLine {
            line_number: first_line + index as u64,
            start_byte: start_byte + relative_start as u64,
            end_byte: start_byte + relative_end as u64,
            text: content.to_owned(),
        });
        relative_start += segment.len();
    }
    if text.is_empty() || text.ends_with('\n') {
        lines.push(WindowLine {
            line_number: first_line + lines.len() as u64,
            start_byte: start_byte + text.len() as u64,
            end_byte: start_byte + text.len() as u64,
            text: String::new(),
        });
    }
    lines
}
