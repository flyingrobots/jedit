use serde::{Deserialize, Serialize};

use crate::rope::{BufferSnapshot, WindowProjection};

#[derive(Debug, Deserialize)]
#[serde(tag = "kind", rename_all = "kebab-case")]
pub enum HostRequest {
    Open {
        #[serde(rename = "requestId")]
        request_id: u64,
        #[serde(rename = "bufferKey")]
        buffer_key: String,
        #[serde(rename = "initialText")]
        initial_text: String,
        #[serde(rename = "projectionPath")]
        projection_path: Option<String>,
    },
    Replace {
        #[serde(rename = "requestId")]
        request_id: u64,
        #[serde(rename = "bufferId")]
        buffer_id: String,
        #[serde(rename = "startByte")]
        start_byte: u64,
        #[serde(rename = "endByte")]
        end_byte: u64,
        #[serde(rename = "insertText")]
        insert_text: String,
    },
    Observe {
        #[serde(rename = "requestId")]
        request_id: u64,
        #[serde(rename = "bufferId")]
        buffer_id: String,
        #[serde(rename = "basisHeadId")]
        basis_head_id: String,
        #[serde(rename = "startByte")]
        start_byte: u64,
        #[serde(rename = "endByte")]
        end_byte: u64,
        #[serde(rename = "maxBytes")]
        max_bytes: u64,
    },
}

impl HostRequest {
    pub fn request_id(&self) -> u64 {
        match self {
            Self::Open { request_id, .. }
            | Self::Replace { request_id, .. }
            | Self::Observe { request_id, .. } => *request_id,
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(tag = "kind", rename_all = "kebab-case")]
pub enum HostResponse {
    Opened {
        #[serde(rename = "requestId")]
        request_id: u64,
        #[serde(flatten)]
        buffer: BufferResponse,
        #[serde(rename = "receiptId", skip_serializing_if = "Option::is_none")]
        receipt_id: Option<String>,
        #[serde(rename = "admittedTickId", skip_serializing_if = "Option::is_none")]
        admitted_tick_id: Option<String>,
    },
    Applied {
        #[serde(rename = "requestId")]
        request_id: u64,
        #[serde(flatten)]
        buffer: BufferResponse,
        #[serde(rename = "receiptId")]
        receipt_id: String,
        #[serde(rename = "admittedTickId")]
        admitted_tick_id: String,
    },
    Observed {
        #[serde(rename = "requestId")]
        request_id: u64,
        #[serde(flatten)]
        window: WindowProjection,
        #[serde(rename = "worldlineId")]
        worldline_id: String,
        #[serde(rename = "readingId")]
        reading_id: String,
        #[serde(rename = "observerPlanId")]
        observer_plan_id: String,
        #[serde(rename = "packageArtifactHash")]
        package_artifact_hash: String,
        #[serde(rename = "resolvedWorldlineTick")]
        resolved_worldline_tick: u64,
        #[serde(rename = "commitHash")]
        commit_hash: String,
    },
    Obstructed {
        #[serde(rename = "requestId")]
        request_id: u64,
        code: String,
        message: String,
    },
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BufferResponse {
    pub buffer_id: String,
    pub buffer_key: String,
    pub projection_path: Option<String>,
    pub head_id: String,
    pub root_node_id: Option<String>,
    pub byte_length: u64,
    pub line_count: u64,
    pub buffer_version: u64,
}

impl From<BufferSnapshot> for BufferResponse {
    fn from(snapshot: BufferSnapshot) -> Self {
        Self {
            buffer_id: crate::identity::node_id_hex(snapshot.buffer_id),
            buffer_key: snapshot.buffer_key,
            projection_path: snapshot.projection_path,
            head_id: crate::identity::node_id_hex(snapshot.head_id),
            root_node_id: snapshot.root_node_id.map(crate::identity::node_id_hex),
            byte_length: snapshot.byte_length,
            line_count: snapshot.line_count,
            buffer_version: snapshot.version,
        }
    }
}
