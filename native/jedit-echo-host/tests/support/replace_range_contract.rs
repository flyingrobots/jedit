pub use jedit_echo_host::rope::ReplaceRangeObstructionCode as SemanticObstructionCode;

pub const ORACLE_SCHEMA_VERSION: u32 = 1;
pub const ORACLE_COORDINATE: &str = "jedit.text.ReplaceRange.oracle@1";
pub const APPLICATION_SCHEMA_COORDINATE: &str = "jedit.text.schema@1";
pub const INVOCATION_SCHEMA_COORDINATE: &str = "jedit.text.ReplaceRange.oracle-invocation@1";
pub const SEMANTIC_BASELINE_COMMIT: &str = "c70e12d73b4b00bc92412bab67e1761f7dd22f82";
pub const EVIDENCE_GRADE: &str = "deterministic-self-validation";
pub const INDEPENDENCE_LIMIT: &str = "independent finite-corpus evidence begins only when a separately implemented Echo evaluator agrees";
pub const ORACLE_WARP_LABEL: &str = "jedit.replace-range.oracle.v1";
pub const OBSTRUCTED_PATCH_POSTURE: &str = "no-mutation-plan";

#[cfg(test)]
mod tests {
    use std::collections::BTreeSet;

    use super::*;

    #[test]
    fn operation_contract_constants_are_frozen() {
        assert_eq!(ORACLE_SCHEMA_VERSION, 1);
        assert_eq!(ORACLE_COORDINATE, "jedit.text.ReplaceRange.oracle@1");
        assert_eq!(APPLICATION_SCHEMA_COORDINATE, "jedit.text.schema@1");
        assert_eq!(
            INVOCATION_SCHEMA_COORDINATE,
            "jedit.text.ReplaceRange.oracle-invocation@1"
        );
        assert_eq!(SEMANTIC_BASELINE_COMMIT.len(), 40);
        assert_eq!(EVIDENCE_GRADE, "deterministic-self-validation");
        assert!(INDEPENDENCE_LIMIT.contains("separately implemented Echo evaluator"));
        assert_eq!(ORACLE_WARP_LABEL, "jedit.replace-range.oracle.v1");
        assert_eq!(OBSTRUCTED_PATCH_POSTURE, "no-mutation-plan");
    }

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
