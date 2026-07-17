use thiserror::Error;

#[derive(Debug, Error)]
pub enum HostError {
    #[error("Echo host initialization failed: {0}")]
    Echo(String),
    #[error("Jim graph-rope fact is missing: {0}")]
    MissingFact(String),
    #[error("Jim graph-rope fact is malformed: {0}")]
    MalformedFact(String),
    #[error("Jim graph-rope request is invalid: {0}")]
    InvalidRequest(String),
    #[error("Echo did not apply the generated operation: {0}")]
    IntentNotApplied(String),
    #[error("generated installed operation is unavailable: {0}")]
    GeneratedOperationUnavailable(String),
    #[error("Echo observation failed: {0}")]
    Observation(String),
    #[error("host protocol failed: {0}")]
    Protocol(String),
}

pub type HostResult<T> = Result<T, HostError>;
