mod fact_read;
mod fault;
mod replace;
mod tree;
mod window;

use std::collections::{BTreeMap, BTreeSet};

use warp_core::{
    AttachmentKey, AttachmentValue, Footprint, GraphStore, GraphView, NodeId, NodeKey, NodeRecord,
    TickDelta, TypeId, WarpId, WarpOp,
};

use crate::error::{HostError, HostResult};
use crate::identity::{hash_bytes, node_id_hex};
use crate::records::{
    decode_fact, decode_fact_bytes, fact_bytes, fact_id, fact_type_id, BlobFact, BranchFact,
    BufferFact, CheckpointFact, CheckpointReason, ContentAddressedFact, HeadFact, LeafFact,
    NodeIdBytes, TypedFact, BLOB_CONTENT_HASH_DOMAIN, BUFFER_NODE_ID_DOMAIN,
};
use fault::{RopeFault, RopeResult};
pub use replace::{
    plan_replace, plan_replace_with_reason, ReplaceRangeFailure, ReplaceRangeObstructionCode,
};
use tree::{build_text, root_digest, root_metrics};
pub use window::{read_window, WindowLine, WindowProjection, WindowSupport};

pub const MAX_LEAF_BYTES: usize = 4096;

pub trait GraphFacts {
    fn warp_id(&self) -> WarpId;
    fn node(&self, id: &NodeId) -> Option<&NodeRecord>;
    fn attachment(&self, id: &NodeId) -> Option<&AttachmentValue>;
}

impl GraphFacts for GraphStore {
    fn warp_id(&self) -> WarpId {
        self.warp_id()
    }

    fn node(&self, id: &NodeId) -> Option<&NodeRecord> {
        self.node(id)
    }

    fn attachment(&self, id: &NodeId) -> Option<&AttachmentValue> {
        self.node_attachment(id)
    }
}

impl GraphFacts for GraphView<'_> {
    fn warp_id(&self) -> WarpId {
        self.warp_id()
    }

    fn node(&self, id: &NodeId) -> Option<&NodeRecord> {
        self.node(id)
    }

    fn attachment(&self, id: &NodeId) -> Option<&AttachmentValue> {
        self.node_attachment(id)
    }
}

#[derive(Clone, Debug)]
struct PendingFact {
    type_id: TypeId,
    bytes: Vec<u8>,
}

#[derive(Clone, Copy, Debug)]
struct NodeMetrics {
    byte_length: u64,
    utf16_length: u64,
    line_breaks: u64,
    height: u32,
}

#[derive(Clone, Debug)]
enum RopeNode {
    Leaf(LeafFact),
    Branch(BranchFact),
}

#[derive(Debug)]
struct PlanContext<'a, T: GraphFacts> {
    source: &'a T,
    reads: BTreeSet<NodeId>,
    pending: BTreeMap<NodeId, PendingFact>,
}

impl<'a, T: GraphFacts> PlanContext<'a, T> {
    fn new(source: &'a T) -> Self {
        Self {
            source,
            reads: BTreeSet::new(),
            pending: BTreeMap::new(),
        }
    }

    fn read_fact<F: TypedFact>(&mut self, id: NodeId) -> HostResult<F> {
        if let Some(pending) = self.pending.get(&id) {
            if pending.type_id != fact_type_id::<F>() {
                return Err(HostError::MalformedFact(format!(
                    "node {} is not {}",
                    node_id_hex(id),
                    F::TYPE_LABEL
                )));
            }
            return decode_fact_bytes::<F>(&pending.bytes);
        }
        self.reads.insert(id);
        let attachment = self.source.attachment(&id).ok_or_else(|| {
            HostError::MissingFact(format!("{} at {}", F::TYPE_LABEL, node_id_hex(id)))
        })?;
        decode_fact(attachment)
    }

    fn write_fact_at<F: TypedFact>(&mut self, id: NodeId, fact: &F) -> HostResult<()> {
        self.pending.insert(
            id,
            PendingFact {
                type_id: fact_type_id::<F>(),
                bytes: fact_bytes(fact)?,
            },
        );
        Ok(())
    }

    fn write_content_fact<F: ContentAddressedFact>(&mut self, fact: &F) -> HostResult<NodeId> {
        let id = fact_id(fact)?;
        self.write_fact_at(id, fact)?;
        Ok(id)
    }

    fn node_metrics(&mut self, id: NodeId) -> HostResult<NodeMetrics> {
        match self.rope_node(id)? {
            RopeNode::Leaf(leaf) => Ok(NodeMetrics {
                byte_length: leaf.byte_length,
                utf16_length: leaf.utf16_length,
                line_breaks: leaf.line_breaks,
                height: 1,
            }),
            RopeNode::Branch(branch) => Ok(NodeMetrics {
                byte_length: branch.byte_length,
                utf16_length: branch.utf16_length,
                line_breaks: branch.line_breaks,
                height: branch.height,
            }),
        }
    }

    fn rope_node(&mut self, id: NodeId) -> HostResult<RopeNode> {
        let type_id = self
            .pending
            .get(&id)
            .map(|fact| fact.type_id)
            .or_else(|| self.source.node(&id).map(|record| record.ty))
            .ok_or_else(|| HostError::MissingFact(format!("rope node {}", node_id_hex(id))))?;
        if type_id == fact_type_id::<LeafFact>() {
            return self.read_fact(id).map(RopeNode::Leaf);
        }
        if type_id == fact_type_id::<BranchFact>() {
            return self.read_fact(id).map(RopeNode::Branch);
        }
        Err(HostError::MalformedFact(format!(
            "node {} is not a rope leaf or branch",
            node_id_hex(id)
        )))
    }

    fn verified_blob(&mut self, id: NodeId) -> HostResult<BlobFact> {
        self.verified_blob_fault(id)
            .map_err(RopeFault::into_host_error)
    }

    fn verified_blob_fault(&mut self, id: NodeId) -> RopeResult<BlobFact> {
        let blob: BlobFact = self
            .read_fact(id)
            .map_err(RopeFault::structural_dependency)?;
        if hash_bytes(BLOB_CONTENT_HASH_DOMAIN, &blob.bytes) != blob.content_hash {
            return Err(RopeFault::content_identity(format!(
                "blob {} content hash does not match",
                node_id_hex(id)
            )));
        }
        Ok(blob)
    }

    fn blob_bytes(&mut self, id: NodeId) -> HostResult<Vec<u8>> {
        Ok(self.verified_blob(id)?.bytes)
    }
}

#[derive(Debug)]
pub struct MutationPlan {
    warp_id: WarpId,
    reads: BTreeSet<NodeId>,
    writes: BTreeMap<NodeId, PendingFact>,
    pub buffer_id: NodeId,
    pub head_id: NodeId,
    pub byte_length: u64,
    pub line_count: u64,
    pub version: u64,
}

impl MutationPlan {
    pub fn extend_footprint(&self, footprint: &mut Footprint) {
        for id in &self.reads {
            footprint.n_read.insert_with_warp(self.warp_id, *id);
            footprint.a_read.insert(AttachmentKey::node_alpha(NodeKey {
                warp_id: self.warp_id,
                local_id: *id,
            }));
        }
        for id in self.writes.keys() {
            footprint.n_write.insert_with_warp(self.warp_id, *id);
            footprint.a_write.insert(AttachmentKey::node_alpha(NodeKey {
                warp_id: self.warp_id,
                local_id: *id,
            }));
        }
    }

    pub fn emit(&self, delta: &mut TickDelta) {
        for (id, fact) in &self.writes {
            delta.push(WarpOp::UpsertNode {
                node: NodeKey {
                    warp_id: self.warp_id,
                    local_id: *id,
                },
                record: NodeRecord { ty: fact.type_id },
            });
            delta.push(WarpOp::SetAttachment {
                key: AttachmentKey::node_alpha(NodeKey {
                    warp_id: self.warp_id,
                    local_id: *id,
                }),
                value: Some(AttachmentValue::Atom(warp_core::AtomPayload::new(
                    fact.type_id,
                    bytes::Bytes::copy_from_slice(&fact.bytes),
                ))),
            });
        }
    }
}

#[derive(Debug)]
pub struct CheckpointPlan {
    mutation: MutationPlan,
    pub checkpoint_id: NodeId,
    pub basis_byte_length: u64,
    pub reason: CheckpointReason,
}

impl CheckpointPlan {
    pub fn extend_footprint(&self, footprint: &mut Footprint) {
        self.mutation.extend_footprint(footprint);
    }

    pub fn emit(&self, delta: &mut TickDelta) {
        self.mutation.emit(delta);
    }
}

pub fn buffer_node_id(buffer_key: &str) -> NodeId {
    crate::identity::content_node_id(BUFFER_NODE_ID_DOMAIN, buffer_key.as_bytes())
}

pub fn existing_buffer<T: GraphFacts>(
    source: &T,
    buffer_key: &str,
) -> HostResult<Option<BufferSnapshot>> {
    let id = buffer_node_id(buffer_key);
    if source.node(&id).is_none() {
        return Ok(None);
    }
    buffer_snapshot(source, id).map(Some)
}

pub fn buffer_snapshot<T: GraphFacts>(source: &T, buffer_id: NodeId) -> HostResult<BufferSnapshot> {
    let mut context = PlanContext::new(source);
    let buffer: BufferFact = context.read_fact(buffer_id)?;
    let head_id = NodeId::from(buffer.canonical_head_id);
    let head: HeadFact = context.read_fact(head_id)?;
    Ok(BufferSnapshot {
        buffer_id,
        buffer_key: buffer.buffer_key,
        projection_path: buffer.projection_path,
        head_id,
        root_node_id: head.root_node_id.map(NodeId::from),
        byte_length: head.byte_length,
        line_count: head.line_count,
        version: buffer.version,
    })
}

#[derive(Clone, Debug)]
pub struct BufferSnapshot {
    pub buffer_id: NodeId,
    pub buffer_key: String,
    pub projection_path: Option<String>,
    pub head_id: NodeId,
    pub root_node_id: Option<NodeId>,
    pub byte_length: u64,
    pub line_count: u64,
    pub version: u64,
}

pub fn checkpoint_fact<T: GraphFacts>(
    source: &T,
    checkpoint_id: NodeId,
) -> HostResult<CheckpointFact> {
    PlanContext::new(source).read_fact(checkpoint_id)
}

pub fn plan_checkpoint<T: GraphFacts>(
    source: &T,
    buffer_id: NodeId,
    basis_head_id: NodeId,
    reason: CheckpointReason,
) -> HostResult<CheckpointPlan> {
    let mut context = PlanContext::new(source);
    let buffer: BufferFact = context.read_fact(buffer_id)?;
    let basis_head: HeadFact = context.read_fact(basis_head_id)?;
    if NodeId::from(basis_head.buffer_id) != buffer_id {
        return Err(HostError::InvalidRequest(format!(
            "checkpoint basis {} does not belong to buffer {}",
            node_id_hex(basis_head_id),
            node_id_hex(buffer_id)
        )));
    }
    let checkpoint_id = context.write_content_fact(&CheckpointFact {
        worldline_id: buffer_id.into(),
        head_id: basis_head_id.into(),
        reason,
    })?;
    let basis_byte_length = basis_head.byte_length;
    let mutation = finish_plan(
        context,
        buffer_id,
        basis_head_id,
        &basis_head,
        buffer.version,
    );
    Ok(CheckpointPlan {
        mutation,
        checkpoint_id,
        basis_byte_length,
        reason,
    })
}

pub fn plan_create<T: GraphFacts>(
    source: &T,
    buffer_key: &str,
    initial_text: &str,
    projection_path: Option<String>,
) -> HostResult<MutationPlan> {
    let buffer_id = buffer_node_id(buffer_key);
    let mut context = PlanContext::new(source);
    context.reads.insert(buffer_id);
    if context.source.node(&buffer_id).is_some() {
        return Err(HostError::InvalidRequest(format!(
            "buffer {buffer_key} already exists"
        )));
    }
    let root =
        build_text(&mut context, initial_text.as_bytes()).map_err(RopeFault::into_host_error)?;
    let metrics = root_metrics(&mut context, root)?;
    let line_count = metrics
        .line_breaks
        .checked_add(1)
        .ok_or_else(|| HostError::MalformedFact("head line count overflow".to_owned()))?;
    let head = HeadFact {
        buffer_id: buffer_id.into(),
        basis_head_id: None,
        root_node_id: root.map(NodeIdBytes::from),
        byte_length: metrics.byte_length,
        utf16_length: metrics.utf16_length,
        line_count,
        root_digest: root_digest(root),
        sequence: 0,
    };
    let head_id = context.write_content_fact(&head)?;
    context.write_fact_at(
        buffer_id,
        &BufferFact {
            buffer_key: buffer_key.to_owned(),
            projection_path,
            canonical_head_id: head_id.into(),
            version: 0,
        },
    )?;
    Ok(finish_plan(context, buffer_id, head_id, &head, 0))
}

fn finish_plan<T: GraphFacts>(
    context: PlanContext<'_, T>,
    buffer_id: NodeId,
    head_id: NodeId,
    head: &HeadFact,
    version: u64,
) -> MutationPlan {
    MutationPlan {
        warp_id: context.source.warp_id(),
        reads: context.reads,
        writes: context.pending,
        buffer_id,
        head_id,
        byte_length: head.byte_length,
        line_count: head.line_count,
        version,
    }
}
