use jedit_echo_host::identity::content_node_id;
use jedit_echo_host::records::{
    decode_fact, fact_bytes, fact_id, fact_type_id, BlobFact, BranchFact, BufferFact,
    ContentAddressedFact, HeadFact, LeafFact, NodeIdBytes, TypedFact,
};
use jedit_echo_host::rope::{plan_create, plan_replace};
use warp_core::{AttachmentValue, GraphStore, NodeId, NodeRecord, TickDelta, WarpOp};

#[derive(Clone, Copy)]
pub enum BasisSetup {
    Plain,
    Empty,
    SequenceOverflow,
    VersionOverflow,
    MissingBuffer,
    MalformedBuffer,
    BadBlobContentHash,
    LeafRangeStartOverflow,
    LeafRangeEndOverflow,
    RopeNodeEndOverflow,
    RopeByteLengthOverflow,
    RopeUtf16LengthOverflow,
    RopeLineBreakCountOverflow,
    RopeHeightOverflow,
    HeadLineCountOverflow,
    AboveGraphqlIntRange,
    StaleHead,
    ForeignHead,
}

pub fn make_basis(
    warp_id: warp_core::WarpId,
    id: &str,
    initial_text: &str,
    setup: BasisSetup,
) -> (GraphStore, NodeId, NodeId, Option<NodeId>) {
    if matches!(setup, BasisSetup::MissingBuffer) {
        return (
            GraphStore::new(warp_id),
            NodeId([0x11; 32]),
            NodeId([0x22; 32]),
            None,
        );
    }
    let basis_text = if matches!(setup, BasisSetup::Empty) {
        ""
    } else {
        initial_text
    };
    let mut store = GraphStore::new(warp_id);
    let create = plan_create(&store, id, basis_text, None).expect("oracle basis should be created");
    let mut delta = TickDelta::new();
    create.emit(&mut delta);
    apply_ops(&mut store, &delta.finalize());
    let mut head_id = create.head_id;
    let mut invocation_basis_id = None;
    match setup {
        BasisSetup::Plain | BasisSetup::Empty => {}
        BasisSetup::SequenceOverflow => {
            head_id = replace_head(&mut store, create.buffer_id, head_id, |head| {
                head.sequence = u64::MAX;
            });
        }
        BasisSetup::VersionOverflow => {
            replace_buffer(&mut store, create.buffer_id, |buffer| {
                buffer.version = u64::MAX;
            });
        }
        BasisSetup::MalformedBuffer => {
            store.set_node_attachment(
                create.buffer_id,
                Some(AttachmentValue::Atom(warp_core::AtomPayload::new(
                    fact_type_id::<BufferFact>(),
                    bytes::Bytes::from_static(b"{"),
                ))),
            );
        }
        BasisSetup::BadBlobContentHash => corrupt_blob_hash(&mut store, head_id),
        BasisSetup::LeafRangeStartOverflow => {
            head_id = replace_root_leaf(&mut store, create.buffer_id, head_id, |leaf| {
                leaf.byte_start = u64::MAX;
                leaf.byte_length = 2;
            });
        }
        BasisSetup::LeafRangeEndOverflow => {
            head_id = replace_root_leaf(&mut store, create.buffer_id, head_id, |leaf| {
                leaf.byte_start = u64::MAX;
                leaf.byte_length = 1;
            });
        }
        BasisSetup::RopeNodeEndOverflow => {
            head_id = replace_root_left_leaf(&mut store, create.buffer_id, head_id, |leaf| {
                leaf.byte_length = u64::MAX;
            });
        }
        BasisSetup::RopeByteLengthOverflow => {
            head_id = replace_root_leaf(&mut store, create.buffer_id, head_id, |leaf| {
                leaf.byte_length = u64::MAX;
            });
        }
        BasisSetup::RopeUtf16LengthOverflow => {
            head_id = replace_root_leaf(&mut store, create.buffer_id, head_id, |leaf| {
                leaf.utf16_length = u64::MAX;
            });
        }
        BasisSetup::RopeLineBreakCountOverflow | BasisSetup::HeadLineCountOverflow => {
            head_id = replace_root_leaf(&mut store, create.buffer_id, head_id, |leaf| {
                leaf.line_breaks = u64::MAX;
            });
        }
        BasisSetup::RopeHeightOverflow => {
            head_id = replace_root_branch(&mut store, create.buffer_id, head_id, |branch| {
                branch.height = u32::MAX;
            });
        }
        BasisSetup::AboveGraphqlIntRange => {
            head_id = replace_head(&mut store, create.buffer_id, head_id, |head| {
                head.byte_length = i32::MAX as u64 + 1;
            });
        }
        BasisSetup::StaleHead => {
            invocation_basis_id = Some(head_id);
            let replacement = plan_replace(&store, create.buffer_id, head_id, 0, 0, "fresh-")
                .expect("stale-basis setup should advance the canonical head");
            let mut delta = TickDelta::new();
            replacement.emit(&mut delta);
            apply_ops(&mut store, &delta.finalize());
            head_id = replacement.head_id;
        }
        BasisSetup::ForeignHead => {
            let foreign = plan_create(&store, &format!("{id}-foreign"), "foreign", None)
                .expect("foreign-basis setup should create another buffer");
            let mut delta = TickDelta::new();
            foreign.emit(&mut delta);
            apply_ops(&mut store, &delta.finalize());
            invocation_basis_id = Some(foreign.head_id);
        }
        BasisSetup::MissingBuffer => unreachable!(),
    }
    (store, create.buffer_id, head_id, invocation_basis_id)
}

pub fn apply_ops(store: &mut GraphStore, ops: &[WarpOp]) {
    for op in ops {
        match op {
            WarpOp::UpsertNode { node, record } => {
                assert_eq!(node.warp_id, store.warp_id());
                store.insert_node(node.local_id, record.clone());
            }
            WarpOp::SetAttachment { key, value } => {
                let warp_core::AttachmentOwner::Node(node) = key.owner else {
                    panic!("oracle patch must not contain edge attachments")
                };
                assert_eq!(
                    node.warp_id,
                    store.warp_id(),
                    "oracle patch WARP must match its local store"
                );
                store.set_node_attachment(node.local_id, value.clone());
            }
            _ => panic!("oracle patch contains an unsupported graph operation"),
        }
    }
}

fn replace_head(
    store: &mut GraphStore,
    buffer_id: NodeId,
    head_id: NodeId,
    mutate: impl FnOnce(&mut HeadFact),
) -> NodeId {
    let mut head: HeadFact = decode_fact(
        store
            .node_attachment(&head_id)
            .expect("head attachment should exist"),
    )
    .expect("head should decode");
    mutate(&mut head);
    let next_head_id = fact_id(&head).expect("mutated head should identify");
    store.insert_node(
        next_head_id,
        NodeRecord {
            ty: fact_type_id::<HeadFact>(),
        },
    );
    store.set_node_attachment(
        next_head_id,
        Some(AttachmentValue::Atom(warp_core::AtomPayload::new(
            fact_type_id::<HeadFact>(),
            fact_bytes(&head).expect("head should encode").into(),
        ))),
    );
    replace_buffer(store, buffer_id, |buffer| {
        buffer.canonical_head_id = NodeIdBytes::from(next_head_id);
    });
    next_head_id
}

fn replace_buffer(store: &mut GraphStore, buffer_id: NodeId, mutate: impl FnOnce(&mut BufferFact)) {
    let mut buffer: BufferFact = decode_fact(
        store
            .node_attachment(&buffer_id)
            .expect("buffer attachment should exist"),
    )
    .expect("buffer should decode");
    mutate(&mut buffer);
    store.set_node_attachment(
        buffer_id,
        Some(AttachmentValue::Atom(warp_core::AtomPayload::new(
            fact_type_id::<BufferFact>(),
            fact_bytes(&buffer).expect("buffer should encode").into(),
        ))),
    );
}

fn corrupt_blob_hash(store: &mut GraphStore, head_id: NodeId) {
    let head: HeadFact = decode_fact(
        store
            .node_attachment(&head_id)
            .expect("head attachment should exist"),
    )
    .expect("head should decode");
    let root_id = NodeId::from(head.root_node_id.expect("fixture should have a leaf root"));
    let leaf: LeafFact = decode_fact(
        store
            .node_attachment(&root_id)
            .expect("leaf attachment should exist"),
    )
    .expect("leaf should decode");
    let blob_id = NodeId::from(leaf.blob_id);
    let mut blob: BlobFact = decode_fact(
        store
            .node_attachment(&blob_id)
            .expect("blob attachment should exist"),
    )
    .expect("blob should decode");
    blob.content_hash = [0; 32];
    store.set_node_attachment(
        blob_id,
        Some(AttachmentValue::Atom(warp_core::AtomPayload::new(
            fact_type_id::<BlobFact>(),
            fact_bytes(&blob).expect("blob should encode").into(),
        ))),
    );
}

fn replace_root_leaf(
    store: &mut GraphStore,
    buffer_id: NodeId,
    head_id: NodeId,
    mutate: impl FnOnce(&mut LeafFact),
) -> NodeId {
    let root_id = root_node_id(store, head_id);
    let next_root_id = replace_leaf(store, root_id, mutate);
    replace_head_root(store, buffer_id, head_id, next_root_id)
}

fn replace_root_left_leaf(
    store: &mut GraphStore,
    buffer_id: NodeId,
    head_id: NodeId,
    mutate: impl FnOnce(&mut LeafFact),
) -> NodeId {
    let root_id = root_node_id(store, head_id);
    let mut branch: BranchFact = decode_fact(
        store
            .node_attachment(&root_id)
            .expect("branch attachment should exist"),
    )
    .expect("root should decode as a branch");
    let next_left_id = replace_leaf(store, NodeId::from(branch.left), mutate);
    branch.left = next_left_id.into();
    let next_root_id = insert_content_fact(store, &branch);
    replace_head_root(store, buffer_id, head_id, next_root_id)
}

fn replace_root_branch(
    store: &mut GraphStore,
    buffer_id: NodeId,
    head_id: NodeId,
    mutate: impl FnOnce(&mut BranchFact),
) -> NodeId {
    let root_id = root_node_id(store, head_id);
    let mut branch: BranchFact = decode_fact(
        store
            .node_attachment(&root_id)
            .expect("branch attachment should exist"),
    )
    .expect("root should decode as a branch");
    mutate(&mut branch);
    let next_root_id = insert_content_fact(store, &branch);
    replace_head_root(store, buffer_id, head_id, next_root_id)
}

fn root_node_id(store: &GraphStore, head_id: NodeId) -> NodeId {
    let head: HeadFact = decode_fact(
        store
            .node_attachment(&head_id)
            .expect("head attachment should exist"),
    )
    .expect("head should decode");
    NodeId::from(head.root_node_id.expect("fixture should have a rope root"))
}

fn replace_leaf(
    store: &mut GraphStore,
    leaf_id: NodeId,
    mutate: impl FnOnce(&mut LeafFact),
) -> NodeId {
    let mut leaf: LeafFact = decode_fact(
        store
            .node_attachment(&leaf_id)
            .expect("leaf attachment should exist"),
    )
    .expect("leaf should decode");
    mutate(&mut leaf);
    insert_content_fact(store, &leaf)
}

fn replace_head_root(
    store: &mut GraphStore,
    buffer_id: NodeId,
    head_id: NodeId,
    root_id: NodeId,
) -> NodeId {
    replace_head(store, buffer_id, head_id, |head| {
        head.root_node_id = Some(root_id.into());
        head.root_digest = *root_id.as_bytes();
    })
}

fn insert_content_fact<T: ContentAddressedFact>(store: &mut GraphStore, fact: &T) -> NodeId {
    let node_id = fact_id(fact).expect("fixture fact should identify");
    store.insert_node(
        node_id,
        NodeRecord {
            ty: fact_type_id::<T>(),
        },
    );
    set_fact_attachment(store, node_id, fact);
    node_id
}

pub(super) fn insert_raw_content_fact<T: ContentAddressedFact>(
    store: &mut GraphStore,
    bytes: Vec<u8>,
) -> NodeId {
    let node_id = content_node_id(T::ID_DOMAIN, &bytes);
    store.insert_node(
        node_id,
        NodeRecord {
            ty: fact_type_id::<T>(),
        },
    );
    set_raw_fact_attachment::<T>(store, node_id, bytes);
    node_id
}

pub(super) fn set_fact_attachment<T: TypedFact>(store: &mut GraphStore, node_id: NodeId, fact: &T) {
    set_raw_fact_attachment::<T>(
        store,
        node_id,
        fact_bytes(fact).expect("fixture fact should encode"),
    );
}

pub(super) fn set_raw_fact_attachment<T: TypedFact>(
    store: &mut GraphStore,
    node_id: NodeId,
    bytes: Vec<u8>,
) {
    store.set_node_attachment(
        node_id,
        Some(AttachmentValue::Atom(warp_core::AtomPayload::new(
            fact_type_id::<T>(),
            bytes.into(),
        ))),
    );
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    #[should_panic(expected = "oracle patch WARP must match its local store")]
    fn local_patch_applier_rejects_a_foreign_warp_attachment() {
        let mut store = GraphStore::new(warp_core::make_warp_id("oracle-local"));
        let operation = WarpOp::SetAttachment {
            key: warp_core::AttachmentKey::node_alpha(warp_core::NodeKey {
                warp_id: warp_core::make_warp_id("oracle-foreign"),
                local_id: NodeId([0xA5; 32]),
            }),
            value: None,
        };

        apply_ops(&mut store, &[operation]);
    }
}
