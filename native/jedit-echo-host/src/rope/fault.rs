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
        let kind = Self::structural_dependency_kind(&legacy).unwrap_or_else(|| {
            panic!("non-structural host error cannot acquire rope semantics: {legacy}")
        });
        Self { kind, legacy }
    }

    fn structural_dependency_kind(legacy: &HostError) -> Option<RopeFaultKind> {
        match legacy {
            HostError::MissingFact(_) => Some(RopeFaultKind::FactMissing),
            HostError::MalformedFact(_) => Some(RopeFaultKind::FactMalformed),
            HostError::InvalidRequest(_) => Some(RopeFaultKind::DeclaredRopeInconsistent),
            HostError::Echo(_)
            | HostError::IntentNotApplied(_)
            | HostError::GeneratedOperationUnavailable(_)
            | HostError::Observation(_)
            | HostError::Protocol(_) => None,
        }
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

#[cfg(test)]
mod tests {
    use super::*;

    fn infrastructure_errors() -> [HostError; 5] {
        [
            HostError::Echo("echo".to_owned()),
            HostError::IntentNotApplied("outcome".to_owned()),
            HostError::GeneratedOperationUnavailable("operation".to_owned()),
            HostError::Observation("observation".to_owned()),
            HostError::Protocol("protocol".to_owned()),
        ]
    }

    #[test]
    fn structural_dependency_classifies_only_structural_errors() {
        for (error, expected) in [
            (
                HostError::MissingFact("missing".to_owned()),
                RopeFaultKind::FactMissing,
            ),
            (
                HostError::MalformedFact("malformed".to_owned()),
                RopeFaultKind::FactMalformed,
            ),
            (
                HostError::InvalidRequest("invalid".to_owned()),
                RopeFaultKind::DeclaredRopeInconsistent,
            ),
        ] {
            assert_eq!(
                RopeFault::structural_dependency_kind(&error),
                Some(expected)
            );
        }
        for error in infrastructure_errors() {
            assert_eq!(RopeFault::structural_dependency_kind(&error), None);
        }
    }

    #[test]
    fn structural_dependency_refuses_infrastructure_errors() {
        for error in infrastructure_errors() {
            assert!(
                std::panic::catch_unwind(move || RopeFault::structural_dependency(error)).is_err()
            );
        }
    }
}
