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

#[cfg(test)]
mod tests {
    use std::collections::BTreeSet;

    use super::*;

    #[test]
    fn semantic_obstruction_wire_values_are_bijective() {
        let mut wire_values = BTreeSet::new();
        for code in SemanticObstructionCode::ALL {
            let encoded = serde_json::to_string(&code).expect("obstruction code should encode");
            assert_eq!(encoded, format!("\"{}\"", code.as_str()));
            assert_eq!(
                serde_json::from_str::<SemanticObstructionCode>(&encoded)
                    .expect("obstruction code should decode"),
                code
            );
            assert!(wire_values.insert(code.as_str()));
        }
        assert_eq!(wire_values.len(), SemanticObstructionCode::ALL.len());
        assert!(serde_json::from_str::<SemanticObstructionCode>("\"unknown\"").is_err());
    }
}
