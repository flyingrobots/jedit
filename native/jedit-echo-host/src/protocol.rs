use serde::{Deserialize, Serialize};

use crate::error::{HostError, HostResult};
use crate::import_anchor::{ImportAnchorFact, ImportHostBasis};
use crate::records::CheckpointReason;
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
        #[serde(rename = "hostBasis")]
        host_basis: HostBasis,
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
    DeclareCheckpoint {
        #[serde(rename = "requestId")]
        request_id: u64,
        #[serde(rename = "bufferId")]
        buffer_id: String,
        #[serde(rename = "basisHeadId")]
        basis_head_id: String,
        reason: CheckpointReason,
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
            | Self::DeclareCheckpoint { request_id, .. }
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
        #[serde(rename = "importAnchor")]
        import_anchor: ImportAnchorResponse,
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
    CheckpointDeclared {
        #[serde(rename = "requestId")]
        request_id: u64,
        #[serde(flatten)]
        buffer: BufferResponse,
        #[serde(rename = "checkpointId")]
        checkpoint_id: String,
        #[serde(rename = "basisHeadId")]
        basis_head_id: String,
        #[serde(rename = "basisByteLength")]
        basis_byte_length: u64,
        reason: CheckpointReason,
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

/// The host coordinate's current or imported basis, as the client observed
/// it: the SHA-256 digest (lowercase hex) and length of the file's raw bytes,
/// or the absence of a file.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(tag = "kind", rename_all = "kebab-case")]
pub enum HostBasis {
    File {
        sha256: String,
        #[serde(rename = "byteLength")]
        byte_length: u64,
    },
    Missing,
}

impl HostBasis {
    /// Validates the digest and converts to the recorded form.
    pub fn to_import(&self) -> HostResult<ImportHostBasis> {
        match self {
            Self::Missing => Ok(ImportHostBasis::Missing),
            Self::File {
                sha256,
                byte_length,
            } => Ok(ImportHostBasis::File {
                sha256: parse_sha256(sha256)?,
                byte_length: *byte_length,
            }),
        }
    }
}

impl From<&ImportHostBasis> for HostBasis {
    fn from(basis: &ImportHostBasis) -> Self {
        match basis {
            ImportHostBasis::Missing => Self::Missing,
            ImportHostBasis::File {
                sha256,
                byte_length,
            } => Self::File {
                sha256: hex::encode(sha256),
                byte_length: *byte_length,
            },
        }
    }
}

/// Parses a lowercase hex SHA-256 digest.
pub fn parse_sha256(value: &str) -> HostResult<[u8; 32]> {
    if value.len() != 64
        || value
            .bytes()
            .any(|byte| !matches!(byte, b'0'..=b'9' | b'a'..=b'f'))
    {
        return Err(HostError::InvalidRequest(
            "host digest must be 64 lowercase hex characters".to_owned(),
        ));
    }
    let bytes = hex::decode(value)
        .map_err(|error| HostError::InvalidRequest(format!("invalid host digest: {error}")))?;
    bytes
        .try_into()
        .map_err(|_| HostError::InvalidRequest("host digest must contain 32 bytes".to_owned()))
}

/// The anchored import a reopened or created buffer was checked against.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportAnchorResponse {
    pub head_id: String,
    pub host_basis: HostBasis,
}

impl From<&ImportAnchorFact> for ImportAnchorResponse {
    fn from(anchor: &ImportAnchorFact) -> Self {
        Self {
            head_id: crate::identity::node_id_hex(anchor.head_id.into()),
            host_basis: HostBasis::from(&anchor.host_basis),
        }
    }
}
