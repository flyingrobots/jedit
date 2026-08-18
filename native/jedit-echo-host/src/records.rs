use serde::{de::DeserializeOwned, Deserialize, Serialize};
use warp_core::{make_type_id, AttachmentValue, NodeId, TypeId};

use crate::error::{HostError, HostResult};
use crate::identity::content_node_id;

pub const BUFFER_FACT_TYPE: &str = "jedit.text.BufferWorldline.v1";
pub const BLOB_FACT_TYPE: &str = "jedit.text.TextBlob.v1";
pub const LEAF_FACT_TYPE: &str = "jedit.text.RopeLeaf.v1";
pub const BRANCH_FACT_TYPE: &str = "jedit.text.RopeBranch.v1";
pub const HEAD_FACT_TYPE: &str = "jedit.text.RopeHead.v1";
pub const REWRITE_FACT_TYPE: &str = "jedit.text.RopeRewrite.v1";
pub const DIFF_FACT_TYPE: &str = "jedit.text.RopeDiff.v1";
pub const CHECKPOINT_FACT_TYPE: &str = "jedit.text.RopeCheckpoint.v1";

const BLOB_ID_DOMAIN: &[u8] = b"jedit.text.blob.v1\0";
const LEAF_ID_DOMAIN: &[u8] = b"jedit.text.leaf.v1\0";
const BRANCH_ID_DOMAIN: &[u8] = b"jedit.text.branch.v1\0";
const HEAD_ID_DOMAIN: &[u8] = b"jedit.text.head.v1\0";
const REWRITE_ID_DOMAIN: &[u8] = b"jedit.text.rewrite.v1\0";
const DIFF_ID_DOMAIN: &[u8] = b"jedit.text.diff.v1\0";
const CHECKPOINT_ID_DOMAIN: &[u8] = b"jedit.text.checkpoint.v1\0";

pub const BUFFER_NODE_ID_DOMAIN: &[u8] = b"jedit.text.buffer-key.v1\0";
pub const BLOB_CONTENT_HASH_DOMAIN: &[u8] = b"jedit.text.blob-content.v1\0";
pub const EMPTY_ROOT_DIGEST_DOMAIN: &[u8] = b"jedit.text.empty-root.v1\0";

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub struct BufferFact {
    pub buffer_key: String,
    pub projection_path: Option<String>,
    pub canonical_head_id: NodeIdBytes,
    pub version: u64,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub struct BlobFact {
    pub content_hash: [u8; 32],
    pub bytes: Vec<u8>,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub struct LeafFact {
    pub blob_id: NodeIdBytes,
    pub byte_start: u64,
    pub byte_length: u64,
    pub utf16_length: u64,
    pub line_breaks: u64,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub struct BranchFact {
    pub left: NodeIdBytes,
    pub right: NodeIdBytes,
    pub byte_length: u64,
    pub utf16_length: u64,
    pub line_breaks: u64,
    pub height: u32,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub struct HeadFact {
    pub buffer_id: NodeIdBytes,
    pub basis_head_id: Option<NodeIdBytes>,
    pub root_node_id: Option<NodeIdBytes>,
    pub byte_length: u64,
    pub utf16_length: u64,
    pub line_count: u64,
    pub root_digest: [u8; 32],
    pub sequence: u64,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub struct RewriteFact {
    pub buffer_id: NodeIdBytes,
    pub basis_head_id: NodeIdBytes,
    pub next_head_id: NodeIdBytes,
    pub start_byte: u64,
    pub end_byte: u64,
    pub inserted_byte_length: u64,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub struct DiffFact {
    pub rewrite_id: NodeIdBytes,
    pub basis_head_id: NodeIdBytes,
    pub next_head_id: NodeIdBytes,
    pub start_byte: u64,
    pub end_byte: u64,
    pub inserted_byte_length: u64,
    pub deleted_byte_length: u64,
}

#[derive(Clone, Copy, Debug, Deserialize, Eq, Ord, PartialEq, PartialOrd, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum CheckpointReason {
    ManualSave,
    Autosave,
    RetentionBoundary,
    Export,
    Import,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub struct CheckpointFact {
    pub worldline_id: NodeIdBytes,
    pub head_id: NodeIdBytes,
    pub reason: CheckpointReason,
}

#[derive(Clone, Copy, Debug, Deserialize, Eq, Ord, PartialEq, PartialOrd, Serialize)]
pub struct NodeIdBytes(pub [u8; 32]);

impl From<NodeId> for NodeIdBytes {
    fn from(value: NodeId) -> Self {
        Self(*value.as_bytes())
    }
}

impl From<NodeIdBytes> for NodeId {
    fn from(value: NodeIdBytes) -> Self {
        Self(value.0)
    }
}

pub trait TypedFact: DeserializeOwned + Serialize {
    const TYPE_LABEL: &'static str;
}

pub trait ContentAddressedFact: TypedFact {
    const ID_DOMAIN: &'static [u8];
}

macro_rules! typed_fact {
    ($fact:ty, $label:expr) => {
        impl TypedFact for $fact {
            const TYPE_LABEL: &'static str = $label;
        }
    };
}

macro_rules! content_addressed_fact {
    ($fact:ty, $domain:expr) => {
        impl ContentAddressedFact for $fact {
            const ID_DOMAIN: &'static [u8] = $domain;
        }
    };
}

typed_fact!(BufferFact, BUFFER_FACT_TYPE);
typed_fact!(BlobFact, BLOB_FACT_TYPE);
typed_fact!(LeafFact, LEAF_FACT_TYPE);
typed_fact!(BranchFact, BRANCH_FACT_TYPE);
typed_fact!(HeadFact, HEAD_FACT_TYPE);
typed_fact!(RewriteFact, REWRITE_FACT_TYPE);
typed_fact!(DiffFact, DIFF_FACT_TYPE);
typed_fact!(CheckpointFact, CHECKPOINT_FACT_TYPE);

content_addressed_fact!(BlobFact, BLOB_ID_DOMAIN);
content_addressed_fact!(LeafFact, LEAF_ID_DOMAIN);
content_addressed_fact!(BranchFact, BRANCH_ID_DOMAIN);
content_addressed_fact!(HeadFact, HEAD_ID_DOMAIN);
content_addressed_fact!(RewriteFact, REWRITE_ID_DOMAIN);
content_addressed_fact!(DiffFact, DIFF_ID_DOMAIN);
content_addressed_fact!(CheckpointFact, CHECKPOINT_ID_DOMAIN);

pub fn fact_type_id<T: TypedFact>() -> TypeId {
    make_type_id(T::TYPE_LABEL)
}

pub fn fact_bytes<T: TypedFact>(fact: &T) -> HostResult<Vec<u8>> {
    serde_json::to_vec(fact)
        .map_err(|error| HostError::MalformedFact(format!("encode {}: {error}", T::TYPE_LABEL)))
}

pub fn fact_id<T: ContentAddressedFact>(fact: &T) -> HostResult<NodeId> {
    Ok(content_node_id(T::ID_DOMAIN, &fact_bytes(fact)?))
}

pub(crate) fn decode_fact_bytes<T: TypedFact>(bytes: &[u8]) -> HostResult<T> {
    serde_json::from_slice(bytes)
        .map_err(|error| HostError::MalformedFact(format!("decode {}: {error}", T::TYPE_LABEL)))
}

pub fn decode_fact<T: TypedFact>(attachment: &AttachmentValue) -> HostResult<T> {
    let AttachmentValue::Atom(payload) = attachment else {
        return Err(HostError::MalformedFact(format!(
            "{} uses a descended attachment",
            T::TYPE_LABEL
        )));
    };
    if payload.type_id != fact_type_id::<T>() {
        return Err(HostError::MalformedFact(format!(
            "{} attachment has the wrong type",
            T::TYPE_LABEL
        )));
    }
    decode_fact_bytes(payload.bytes.as_ref())
}
