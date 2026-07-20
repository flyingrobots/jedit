use crate::error::HostError;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub(super) enum RopeFaultKind {
    FactMissing,
    FactMalformed,
    ContentIdentityMismatch,
    InvalidUtf8Slice,
    DeclaredRopeInconsistent,
    ArithmeticOverflow,
}

#[derive(Debug)]
pub(super) struct RopeFault {
    kind: RopeFaultKind,
    legacy: HostError,
}

pub(super) type RopeResult<T> = Result<T, RopeFault>;

impl RopeFault {
    pub(super) fn structural_dependency(legacy: HostError) -> Self {
        let kind = match legacy {
            HostError::MissingFact(_) => RopeFaultKind::FactMissing,
            HostError::MalformedFact(_) => RopeFaultKind::FactMalformed,
            _ => RopeFaultKind::DeclaredRopeInconsistent,
        };
        Self { kind, legacy }
    }

    pub(super) fn fact_malformed(message: String) -> Self {
        Self {
            kind: RopeFaultKind::FactMalformed,
            legacy: HostError::MalformedFact(message),
        }
    }

    pub(super) fn content_identity(message: String) -> Self {
        Self {
            kind: RopeFaultKind::ContentIdentityMismatch,
            legacy: HostError::MalformedFact(message),
        }
    }

    pub(super) fn invalid_utf8_slice(message: String) -> Self {
        Self {
            kind: RopeFaultKind::InvalidUtf8Slice,
            legacy: HostError::InvalidRequest(message),
        }
    }

    pub(super) fn declared_rope_inconsistent(message: String) -> Self {
        Self {
            kind: RopeFaultKind::DeclaredRopeInconsistent,
            legacy: HostError::InvalidRequest(message),
        }
    }

    pub(super) fn arithmetic_overflow(message: &'static str) -> Self {
        Self {
            kind: RopeFaultKind::ArithmeticOverflow,
            legacy: HostError::MalformedFact(message.to_owned()),
        }
    }

    pub(super) fn checked_add_u64(left: u64, right: u64, message: &'static str) -> RopeResult<u64> {
        left.checked_add(right)
            .ok_or_else(|| Self::arithmetic_overflow(message))
    }

    pub(super) fn checked_add_u32(left: u32, right: u32, message: &'static str) -> RopeResult<u32> {
        left.checked_add(right)
            .ok_or_else(|| Self::arithmetic_overflow(message))
    }

    pub(super) fn into_parts(self) -> (RopeFaultKind, HostError) {
        (self.kind, self.legacy)
    }

    pub(super) fn into_host_error(self) -> HostError {
        self.legacy
    }
}
