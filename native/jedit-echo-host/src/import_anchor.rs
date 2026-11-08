//! The witnessed association between a file coordinate, the bytes imported
//! from it, and the head built from those bytes.
//!
//! Opening a file that has no buffer creates the buffer and its anchor in the
//! same admitted Tick, so the anchor is recovered from the Echo WAL with the
//! buffer. A later open may reuse the buffer only when the anchor names the
//! coordinate's current basis exactly. Otherwise the open is refused with a
//! typed reason and nothing is written, so neither the disk nor the rope
//! silently replaces the other, and unsaved edits stay in the buffer.
//!
//! The anchor is not part of the rope law: it lives beside the rope facts and
//! leaves their bytes and the `ReplaceRange` planner unchanged.

use serde::{Deserialize, Serialize};
use warp_core::{
    AttachmentKey, AttachmentValue, Footprint, NodeId, NodeKey, NodeRecord, TickDelta, WarpId,
    WarpOp,
};

use crate::error::{HostError, HostResult};
use crate::identity::content_node_id;
use crate::records::{decode_fact, fact_bytes, fact_type_id, HeadFact, NodeIdBytes, TypedFact};
use crate::rope::{existing_buffer, BufferSnapshot, GraphFacts};

pub const IMPORT_ANCHOR_FACT_TYPE: &str = "jedit.text.ImportAnchor.v1";
const IMPORT_ANCHOR_NODE_ID_DOMAIN: &[u8] = b"jedit.text.import-anchor.v1\0";

/// What the host coordinate held when a buffer was imported from it.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(tag = "kind", rename_all = "kebab-case")]
pub enum ImportHostBasis {
    /// A file whose raw bytes had this SHA-256 digest and length.
    File { sha256: [u8; 32], byte_length: u64 },
    /// No file existed at the coordinate.
    Missing,
}

/// Binds one buffer's imported head to the coordinate and bytes it came from.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub struct ImportAnchorFact {
    pub buffer_id: NodeIdBytes,
    pub projection_path: Option<String>,
    pub host_basis: ImportHostBasis,
    pub head_id: NodeIdBytes,
}

impl TypedFact for ImportAnchorFact {
    const TYPE_LABEL: &'static str = IMPORT_ANCHOR_FACT_TYPE;
}

/// One anchor per buffer, keyed by the buffer.
pub fn import_anchor_node_id(buffer_id: NodeId) -> NodeId {
    content_node_id(IMPORT_ANCHOR_NODE_ID_DOMAIN, buffer_id.as_bytes())
}

/// Why an open may not reuse an existing buffer.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum ReopenRefusal {
    /// The buffer records no import, so it cannot be assumed to match.
    AnchorMissing,
    /// The coordinate no longer holds the anchored bytes; the buffer is
    /// still at its imported head.
    FileChanged,
    /// The coordinate no longer holds the anchored bytes and the buffer has
    /// edits beyond its imported head.
    FileAndBufferChanged,
}

impl ReopenRefusal {
    pub fn code(self) -> &'static str {
        match self {
            Self::AnchorMissing => "import-anchor-missing",
            Self::FileChanged => "file-changed-since-import",
            Self::FileAndBufferChanged => "file-and-buffer-changed-since-import",
        }
    }

    pub fn message(self, buffer_key: &str) -> String {
        match self {
            Self::AnchorMissing => format!(
                "{buffer_key} has a buffer with no anchored import, so it cannot be assumed to match the file"
            ),
            Self::FileChanged => {
                format!("{buffer_key} changed on disk since it was imported; the buffer was kept")
            }
            Self::FileAndBufferChanged => format!(
                "{buffer_key} changed on disk and its buffer has unsaved edits since import; both were kept"
            ),
        }
    }
}

/// The decision for an open request.
#[derive(Debug)]
pub enum Reopen {
    /// No buffer exists for the key.
    Absent,
    /// The buffer may be reused; the anchor names the current basis.
    Reuse(Box<BufferSnapshot>, ImportAnchorFact),
    /// The buffer exists but may not be reused.
    Refused(ReopenRefusal),
}

/// Decides whether the buffer for `buffer_key` may be reused for the host
/// coordinate's `current` basis. Reads only; never writes.
pub fn reopen_buffer<T: GraphFacts>(
    source: &T,
    buffer_key: &str,
    projection_path: Option<&str>,
    current: &ImportHostBasis,
) -> HostResult<Reopen> {
    let Some(snapshot) = existing_buffer(source, buffer_key)? else {
        return Ok(Reopen::Absent);
    };
    if source
        .node(&import_anchor_node_id(snapshot.buffer_id))
        .is_none()
    {
        return Ok(Reopen::Refused(ReopenRefusal::AnchorMissing));
    }
    let anchor = read_import_anchor(source, snapshot.buffer_id)?;
    if anchor.projection_path.as_deref() != projection_path {
        return Err(HostError::InvalidRequest(format!(
            "{buffer_key} was imported from another projection path"
        )));
    }
    if anchor.host_basis != *current {
        let refusal = if snapshot.head_id == NodeId::from(anchor.head_id) {
            ReopenRefusal::FileChanged
        } else {
            ReopenRefusal::FileAndBufferChanged
        };
        return Ok(Reopen::Refused(refusal));
    }
    Ok(Reopen::Reuse(Box::new(snapshot), anchor))
}

/// Reads a buffer's anchor and checks that it and its head name the buffer.
pub fn read_import_anchor<T: GraphFacts>(
    source: &T,
    buffer_id: NodeId,
) -> HostResult<ImportAnchorFact> {
    let anchor: ImportAnchorFact = read_fact(source, import_anchor_node_id(buffer_id))?;
    let head: HeadFact = read_fact(source, anchor.head_id.into())?;
    if NodeId::from(anchor.buffer_id) != buffer_id || NodeId::from(head.buffer_id) != buffer_id {
        return Err(HostError::MalformedFact(
            "import anchor names another buffer".to_owned(),
        ));
    }
    Ok(anchor)
}

fn read_fact<T: GraphFacts, F: TypedFact>(source: &T, id: NodeId) -> HostResult<F> {
    let attachment = source.attachment(&id).ok_or_else(|| {
        HostError::MissingFact(format!(
            "{} at {}",
            F::TYPE_LABEL,
            crate::identity::node_id_hex(id)
        ))
    })?;
    decode_fact(attachment)
}

/// The anchor write that accompanies a buffer's creation in the same Tick.
#[derive(Debug)]
pub struct AnchorPlan {
    warp_id: WarpId,
    id: NodeId,
    bytes: Vec<u8>,
}

/// Plans the anchor for a buffer being created at `head_id`. Refuses when the
/// buffer already has one: an anchor is written once, at import.
pub fn plan_import_anchor<T: GraphFacts>(
    source: &T,
    buffer_id: NodeId,
    head_id: NodeId,
    projection_path: Option<String>,
    host_basis: ImportHostBasis,
) -> HostResult<AnchorPlan> {
    let id = import_anchor_node_id(buffer_id);
    if source.node(&id).is_some() {
        return Err(HostError::InvalidRequest(
            "buffer already has an import anchor".to_owned(),
        ));
    }
    let bytes = fact_bytes(&ImportAnchorFact {
        buffer_id: buffer_id.into(),
        projection_path,
        host_basis,
        head_id: head_id.into(),
    })?;
    Ok(AnchorPlan {
        warp_id: source.warp_id(),
        id,
        bytes,
    })
}

impl AnchorPlan {
    fn key(&self) -> NodeKey {
        NodeKey {
            warp_id: self.warp_id,
            local_id: self.id,
        }
    }

    pub fn extend_footprint(&self, footprint: &mut Footprint) {
        footprint.n_read.insert_with_warp(self.warp_id, self.id);
        footprint
            .a_read
            .insert(AttachmentKey::node_alpha(self.key()));
        footprint.n_write.insert_with_warp(self.warp_id, self.id);
        footprint
            .a_write
            .insert(AttachmentKey::node_alpha(self.key()));
    }

    pub fn emit(&self, delta: &mut TickDelta) {
        let type_id = fact_type_id::<ImportAnchorFact>();
        delta.push(WarpOp::UpsertNode {
            node: self.key(),
            record: NodeRecord { ty: type_id },
        });
        delta.push(WarpOp::SetAttachment {
            key: AttachmentKey::node_alpha(self.key()),
            value: Some(AttachmentValue::Atom(warp_core::AtomPayload::new(
                type_id,
                bytes::Bytes::copy_from_slice(&self.bytes),
            ))),
        });
    }
}

#[cfg(test)]
mod tests {
    use warp_core::{GraphStore, TickDelta, WarpOp};

    use super::*;
    use crate::rope::plan_create;

    fn apply(store: &mut GraphStore, delta: TickDelta) {
        for op in delta.finalize() {
            match op {
                WarpOp::UpsertNode { node, record } => store.insert_node(node.local_id, record),
                WarpOp::SetAttachment { key, value } => {
                    let warp_core::AttachmentOwner::Node(node) = key.owner else {
                        panic!("a create patch has only node attachments");
                    };
                    store.set_node_attachment(node.local_id, value);
                }
                _ => panic!("a create patch has only node upserts and attachments"),
            }
        }
    }

    #[test]
    fn a_buffer_without_an_anchor_is_never_assumed_to_match() {
        let mut store = GraphStore::default();
        let plan = plan_create(&store, "unanchored.txt", "text", None)
            .expect("the buffer should be planned");
        let mut delta = TickDelta::new();
        plan.emit(&mut delta);
        apply(&mut store, delta);

        let decision = reopen_buffer(&store, "unanchored.txt", None, &ImportHostBasis::Missing)
            .expect("the decision should not fail");
        assert!(matches!(
            decision,
            Reopen::Refused(ReopenRefusal::AnchorMissing)
        ));
    }

    #[test]
    fn an_anchor_is_written_once() {
        let mut store = GraphStore::default();
        let plan = plan_create(&store, "once.txt", "text", None).expect("planned");
        let anchor = plan_import_anchor(
            &store,
            plan.buffer_id,
            plan.head_id,
            None,
            ImportHostBasis::Missing,
        )
        .expect("anchor planned");
        let mut delta = TickDelta::new();
        plan.emit(&mut delta);
        anchor.emit(&mut delta);
        apply(&mut store, delta);

        let again = plan_import_anchor(
            &store,
            plan.buffer_id,
            plan.head_id,
            None,
            ImportHostBasis::Missing,
        );
        assert!(matches!(again, Err(HostError::InvalidRequest(_))));
    }
}
