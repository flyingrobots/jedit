use serde::{Deserialize, Serialize};
use thiserror::Error;
use warp_core::NodeId;

use crate::error::{HostError, HostResult};
use crate::identity::node_id_hex;
use crate::records::{BufferFact, DiffFact, HeadFact, NodeIdBytes, RewriteFact};

use super::fault::{RopeFault, RopeFaultKind};
use super::tree::{build_text, join, root_digest, root_metrics, split};
use super::window::read_range_bytes;
use super::{finish_plan, GraphFacts, MutationPlan, PlanContext};

#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum ReplaceRangeObstructionCode {
    RangeOrderInvalid,
    RangeOutOfBounds,
    Utf8BoundaryInvalid,
    NoOp,
    BasisNotCanonical,
    ArithmeticOverflow,
    FactMissing,
    FactMalformed,
    ContentIdentityMismatch,
    MalformedRope,
}

impl ReplaceRangeObstructionCode {
    pub const ALL: [Self; 10] = [
        Self::RangeOrderInvalid,
        Self::RangeOutOfBounds,
        Self::Utf8BoundaryInvalid,
        Self::NoOp,
        Self::BasisNotCanonical,
        Self::ArithmeticOverflow,
        Self::FactMissing,
        Self::FactMalformed,
        Self::ContentIdentityMismatch,
        Self::MalformedRope,
    ];

    pub const fn as_str(self) -> &'static str {
        match self {
            Self::RangeOrderInvalid => "range-order-invalid",
            Self::RangeOutOfBounds => "range-out-of-bounds",
            Self::Utf8BoundaryInvalid => "utf8-boundary-invalid",
            Self::NoOp => "no-op",
            Self::BasisNotCanonical => "basis-not-canonical",
            Self::ArithmeticOverflow => "arithmetic-overflow",
            Self::FactMissing => "fact-missing",
            Self::FactMalformed => "fact-malformed",
            Self::ContentIdentityMismatch => "content-identity-mismatch",
            Self::MalformedRope => "malformed-rope",
        }
    }
}

#[derive(Debug, Error)]
#[error("{legacy}")]
pub struct ReplaceRangeFailure {
    reason: ReplaceRangeObstructionCode,
    #[source]
    legacy: HostError,
}

impl ReplaceRangeFailure {
    fn new(reason: ReplaceRangeObstructionCode, legacy: HostError) -> Self {
        Self { reason, legacy }
    }

    fn from_rope_fault(fault: RopeFault) -> Self {
        let (kind, legacy) = fault.into_parts();
        let reason = match kind {
            RopeFaultKind::FactMissing => ReplaceRangeObstructionCode::FactMissing,
            RopeFaultKind::FactMalformed => ReplaceRangeObstructionCode::FactMalformed,
            RopeFaultKind::ContentIdentityMismatch => {
                ReplaceRangeObstructionCode::ContentIdentityMismatch
            }
            RopeFaultKind::InvalidUtf8Slice => ReplaceRangeObstructionCode::Utf8BoundaryInvalid,
            RopeFaultKind::DeclaredRopeInconsistent => ReplaceRangeObstructionCode::MalformedRope,
        };
        Self::new(reason, legacy)
    }

    pub fn reason(&self) -> ReplaceRangeObstructionCode {
        self.reason
    }

    pub fn host_error(&self) -> &HostError {
        &self.legacy
    }

    pub fn into_host_error(self) -> HostError {
        self.legacy
    }
}

pub fn plan_replace<T: GraphFacts>(
    source: &T,
    buffer_id: NodeId,
    expected_basis_head_id: NodeId,
    start_byte: u64,
    end_byte: u64,
    insert_text: &str,
) -> HostResult<MutationPlan> {
    plan_replace_with_reason(
        source,
        buffer_id,
        expected_basis_head_id,
        start_byte,
        end_byte,
        insert_text,
    )
    .map_err(ReplaceRangeFailure::into_host_error)
}

pub fn plan_replace_with_reason<T: GraphFacts>(
    source: &T,
    buffer_id: NodeId,
    expected_basis_head_id: NodeId,
    start_byte: u64,
    end_byte: u64,
    insert_text: &str,
) -> Result<MutationPlan, ReplaceRangeFailure> {
    let mut context = PlanContext::new(source);
    let buffer: BufferFact = context
        .read_fact(buffer_id)
        .map_err(RopeFault::structural_dependency)
        .map_err(ReplaceRangeFailure::from_rope_fault)?;
    let basis_head_id = NodeId::from(buffer.canonical_head_id);
    if basis_head_id != expected_basis_head_id {
        return Err(ReplaceRangeFailure::new(
            ReplaceRangeObstructionCode::BasisNotCanonical,
            HostError::InvalidRequest(format!(
                "stale replace basis {}; canonical head is {}",
                node_id_hex(expected_basis_head_id),
                node_id_hex(basis_head_id)
            )),
        ));
    }
    let basis_head: HeadFact = context
        .read_fact(basis_head_id)
        .map_err(RopeFault::structural_dependency)
        .map_err(ReplaceRangeFailure::from_rope_fault)?;
    if start_byte > end_byte {
        return Err(range_failure(
            ReplaceRangeObstructionCode::RangeOrderInvalid,
            start_byte,
            end_byte,
            basis_head.byte_length,
        ));
    }
    if end_byte > basis_head.byte_length {
        return Err(range_failure(
            ReplaceRangeObstructionCode::RangeOutOfBounds,
            start_byte,
            end_byte,
            basis_head.byte_length,
        ));
    }
    let basis_root = basis_head.root_node_id.map(NodeId::from);
    let current_bytes = read_range_bytes(&mut context, basis_root, start_byte, end_byte)
        .map_err(ReplaceRangeFailure::from_rope_fault)?;
    if current_bytes == insert_text.as_bytes() {
        return Err(ReplaceRangeFailure::new(
            ReplaceRangeObstructionCode::NoOp,
            HostError::InvalidRequest("replace range is a no-op".to_owned()),
        ));
    }
    let next_sequence = basis_head.sequence.checked_add(1).ok_or_else(|| {
        ReplaceRangeFailure::new(
            ReplaceRangeObstructionCode::ArithmeticOverflow,
            HostError::MalformedFact("head sequence overflow".to_owned()),
        )
    })?;
    let next_version = buffer.version.checked_add(1).ok_or_else(|| {
        ReplaceRangeFailure::new(
            ReplaceRangeObstructionCode::ArithmeticOverflow,
            HostError::MalformedFact("buffer version overflow".to_owned()),
        )
    })?;
    let (left, suffix) = split(&mut context, basis_root, start_byte)
        .map_err(ReplaceRangeFailure::from_rope_fault)?;
    let (_, right) = split(&mut context, suffix, end_byte - start_byte)
        .map_err(ReplaceRangeFailure::from_rope_fault)?;
    let inserted = build_text(&mut context, insert_text.as_bytes())
        .map_err(RopeFault::structural_dependency)
        .map_err(ReplaceRangeFailure::from_rope_fault)?;
    let left_with_insert = join(&mut context, left, inserted)
        .map_err(RopeFault::structural_dependency)
        .map_err(ReplaceRangeFailure::from_rope_fault)?;
    let root = join(&mut context, left_with_insert, right)
        .map_err(RopeFault::structural_dependency)
        .map_err(ReplaceRangeFailure::from_rope_fault)?;
    let metrics = root_metrics(&mut context, root)
        .map_err(RopeFault::structural_dependency)
        .map_err(ReplaceRangeFailure::from_rope_fault)?;
    let head = HeadFact {
        buffer_id: buffer_id.into(),
        basis_head_id: Some(basis_head_id.into()),
        root_node_id: root.map(NodeIdBytes::from),
        byte_length: metrics.byte_length,
        utf16_length: metrics.utf16_length,
        line_count: metrics.line_breaks + 1,
        root_digest: root_digest(root),
        sequence: next_sequence,
    };
    let head_id = context
        .write_content_fact(&head)
        .map_err(RopeFault::structural_dependency)
        .map_err(ReplaceRangeFailure::from_rope_fault)?;
    let rewrite = RewriteFact {
        buffer_id: buffer_id.into(),
        basis_head_id: basis_head_id.into(),
        next_head_id: head_id.into(),
        start_byte,
        end_byte,
        inserted_byte_length: insert_text.len() as u64,
    };
    let rewrite_id = context
        .write_content_fact(&rewrite)
        .map_err(RopeFault::structural_dependency)
        .map_err(ReplaceRangeFailure::from_rope_fault)?;
    context
        .write_content_fact(&DiffFact {
            rewrite_id: rewrite_id.into(),
            basis_head_id: basis_head_id.into(),
            next_head_id: head_id.into(),
            start_byte,
            end_byte,
            inserted_byte_length: insert_text.len() as u64,
            deleted_byte_length: end_byte - start_byte,
        })
        .map_err(RopeFault::structural_dependency)
        .map_err(ReplaceRangeFailure::from_rope_fault)?;
    context
        .write_fact_at(
            buffer_id,
            &BufferFact {
                canonical_head_id: head_id.into(),
                version: next_version,
                ..buffer
            },
        )
        .map_err(RopeFault::structural_dependency)
        .map_err(ReplaceRangeFailure::from_rope_fault)?;
    Ok(finish_plan(
        context,
        buffer_id,
        head_id,
        &head,
        next_version,
    ))
}

fn range_failure(
    reason: ReplaceRangeObstructionCode,
    start_byte: u64,
    end_byte: u64,
    basis_length: u64,
) -> ReplaceRangeFailure {
    ReplaceRangeFailure::new(
        reason,
        HostError::InvalidRequest(format!(
            "replace range {start_byte}..{end_byte} exceeds {basis_length} bytes"
        )),
    )
}
