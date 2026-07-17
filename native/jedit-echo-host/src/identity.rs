use crate::error::{HostError, HostResult};
use warp_core::NodeId;

const NODE_ID_BYTES: usize = 32;

pub fn content_node_id(domain: &[u8], material: &[u8]) -> NodeId {
    let mut hasher = blake3::Hasher::new();
    hasher.update(domain);
    hasher.update(material);
    NodeId(hasher.finalize().into())
}

pub fn node_id_hex(node_id: NodeId) -> String {
    hex::encode(node_id.as_bytes())
}

pub fn parse_node_id(value: &str) -> HostResult<NodeId> {
    let bytes = hex::decode(value)
        .map_err(|error| HostError::InvalidRequest(format!("invalid node id: {error}")))?;
    let bytes: [u8; NODE_ID_BYTES] = bytes.try_into().map_err(|_| {
        HostError::InvalidRequest(format!("node id must contain {NODE_ID_BYTES} bytes"))
    })?;
    Ok(NodeId(bytes))
}

pub fn hash_bytes(domain: &[u8], material: &[u8]) -> [u8; 32] {
    let mut hasher = blake3::Hasher::new();
    hasher.update(domain);
    hasher.update(material);
    hasher.finalize().into()
}
