use jedit_echo_host::error::HostError;

use super::contract::SemanticObstructionCode;

pub(super) fn semantic_obstruction(
    error: &HostError,
    start_byte: u64,
    end_byte: u64,
) -> SemanticObstructionCode {
    match error {
        HostError::MissingFact(_) => SemanticObstructionCode::FactMissing,
        HostError::MalformedFact(message)
            if message == "head sequence overflow" || message == "buffer version overflow" =>
        {
            SemanticObstructionCode::ArithmeticOverflow
        }
        HostError::MalformedFact(message) if message.contains("content hash does not match") => {
            SemanticObstructionCode::ContentIdentityMismatch
        }
        HostError::MalformedFact(_) => SemanticObstructionCode::FactMalformed,
        HostError::InvalidRequest(message) if message.starts_with("stale replace basis ") => {
            SemanticObstructionCode::BasisNotCanonical
        }
        HostError::InvalidRequest(message) if message == "replace range is a no-op" => {
            SemanticObstructionCode::NoOp
        }
        HostError::InvalidRequest(message)
            if message == "replace offset splits a UTF-8 code point" =>
        {
            SemanticObstructionCode::Utf8BoundaryInvalid
        }
        HostError::InvalidRequest(message)
            if message.starts_with("replace range ") && start_byte > end_byte =>
        {
            SemanticObstructionCode::RangeOrderInvalid
        }
        HostError::InvalidRequest(message) if message.starts_with("replace range ") => {
            SemanticObstructionCode::RangeOutOfBounds
        }
        HostError::InvalidRequest(message) if message == "split exceeds empty rope" => {
            SemanticObstructionCode::MalformedRope
        }
        other => panic!("oracle cannot classify semantic obstruction: {other}"),
    }
}
