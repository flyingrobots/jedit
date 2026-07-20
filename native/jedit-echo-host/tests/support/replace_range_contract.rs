use serde::{Deserialize, Serialize};

#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum SemanticObstructionCode {
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

#[allow(dead_code)]
impl SemanticObstructionCode {
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
