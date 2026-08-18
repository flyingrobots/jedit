use jedit_echo_host::error::HostError;
use jedit_echo_host::rope::{plan_replace, ReplaceRangeFailure};
use warp_core::{GraphStore, NodeId};

pub(super) fn error_projection(error: &HostError) -> (&'static str, String) {
    match error {
        HostError::MissingFact(message) => ("missing-fact", message.clone()),
        HostError::MalformedFact(message) => ("malformed-fact", message.clone()),
        HostError::InvalidRequest(message) => ("invalid-request", message.clone()),
        other => panic!("oracle received unexpected host error: {other}"),
    }
}

#[allow(clippy::too_many_arguments)]
pub(super) fn assert_error_parity(
    store: &GraphStore,
    buffer_id: NodeId,
    basis_head_id: NodeId,
    start_byte: u64,
    end_byte: u64,
    replacement: &str,
    case_id: &str,
    typed: &ReplaceRangeFailure,
) {
    let legacy = plan_replace(
        store,
        buffer_id,
        basis_head_id,
        start_byte,
        end_byte,
        replacement,
    )
    .expect_err("typed obstruction must remain a legacy obstruction");
    assert_eq!(
        error_projection(typed.host_error()),
        error_projection(&legacy),
        "{case_id} typed and legacy error projections diverged"
    );
    assert_eq!(
        typed.host_error().to_string(),
        legacy.to_string(),
        "{case_id} typed and legacy diagnostics diverged"
    );
}
