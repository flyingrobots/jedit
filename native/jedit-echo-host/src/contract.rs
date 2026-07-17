use echo_registry_api::ContractArtifactVerificationPolicy;
use warp_core::{
    ContractMutationHandler, ContractPackageIdentity, ContractQueryObserverContext,
    ContractQueryObserverError, ContractQueryObserverResult, Footprint, GraphView,
    InstalledContractPackage, NodeId, TickDelta,
};

use crate::generated::contract::__echo_wesley_generated::{
    CreateBufferWorldlineVars, DeclareCheckpointVars, ReplaceRangeAsTickVars, TextWindowVars,
};
use crate::generated::contract::{
    create_buffer_worldline_contract_rule,
    create_buffer_worldline_contract_runtime_ingress_footprint,
    create_buffer_worldline_contract_vars, declare_checkpoint_contract_rule,
    declare_checkpoint_contract_runtime_ingress_footprint, declare_checkpoint_contract_vars,
    replace_range_as_tick_contract_rule, replace_range_as_tick_contract_runtime_ingress_footprint,
    replace_range_as_tick_contract_vars, text_window_query_observer,
    CONTRACT_HOST_HELPER_API_VERSION, ECHO_CONTRACT_ABI_VERSION, GENERATED_RUST_ARTIFACT_HASH,
    OP_CREATE_BUFFER_WORLDLINE, OP_DECLARE_CHECKPOINT, OP_REPLACE_RANGE_AS_TICK, REGISTRY,
    REGISTRY_VERSION, SCHEMA_SHA256, WESLEY_GENERATOR_VERSION,
};
use crate::identity::parse_node_id;
use crate::records::CheckpointReason;
use crate::rope::{plan_checkpoint, plan_create, plan_replace, read_window};

const PACKAGE_NAME: &str = "jedit-echo-text";
const PACKAGE_VERSION: &str = "0.1.0-wesley-compat";
const CHECKPOINT_REASON_MANUAL_SAVE: &str = "manual-save";
const CHECKPOINT_REASON_AUTOSAVE: &str = "autosave";
const CHECKPOINT_REASON_RETENTION_BOUNDARY: &str = "retention-boundary";
const CHECKPOINT_REASON_EXPORT: &str = "export";
const CHECKPOINT_REASON_IMPORT: &str = "import";

pub fn installed_package() -> InstalledContractPackage<'static> {
    InstalledContractPackage {
        identity: ContractPackageIdentity {
            package_name: PACKAGE_NAME,
            package_version: PACKAGE_VERSION,
            artifact_hash_hex: GENERATED_RUST_ARTIFACT_HASH,
        },
        registry: &REGISTRY,
        verification_policy: ContractArtifactVerificationPolicy {
            echo_abi_version: ECHO_CONTRACT_ABI_VERSION,
            codec_id: crate::generated::contract::CODEC_ID,
            registry_version: REGISTRY_VERSION,
            schema_sha256_hex: SCHEMA_SHA256,
            wesley_generator_version: WESLEY_GENERATOR_VERSION,
            helper_api_version: CONTRACT_HOST_HELPER_API_VERSION,
            footprint_certificates: &[],
            require_mutation_footprint_certificates: false,
        },
        mutation_handlers: vec![
            ContractMutationHandler {
                op_id: OP_CREATE_BUFFER_WORLDLINE,
                rule: create_buffer_worldline_contract_rule(
                    create_buffer_executor,
                    create_buffer_footprint,
                ),
            },
            ContractMutationHandler {
                op_id: OP_REPLACE_RANGE_AS_TICK,
                rule: replace_range_as_tick_contract_rule(
                    replace_range_executor,
                    replace_range_footprint,
                ),
            },
            ContractMutationHandler {
                op_id: OP_DECLARE_CHECKPOINT,
                rule: declare_checkpoint_contract_rule(
                    declare_checkpoint_executor,
                    declare_checkpoint_footprint,
                ),
            },
        ],
        inverse_handlers: vec![],
        query_observers: vec![text_window_query_observer(observe_text_window)],
    }
}

fn create_buffer_executor(view: GraphView<'_>, scope: &NodeId, delta: &mut TickDelta) {
    let Some(vars) = create_buffer_worldline_contract_vars(view, scope) else {
        return;
    };
    if let Ok(plan) = create_plan(view, vars) {
        plan.emit(delta);
    }
}

fn create_buffer_footprint(view: GraphView<'_>, scope: &NodeId) -> Footprint {
    let mut footprint = create_buffer_worldline_contract_runtime_ingress_footprint(view, scope);
    if let Some(vars) = create_buffer_worldline_contract_vars(view, scope) {
        if let Ok(plan) = create_plan(view, vars) {
            plan.extend_footprint(&mut footprint);
        }
    }
    footprint
}

fn create_plan(
    view: GraphView<'_>,
    vars: CreateBufferWorldlineVars,
) -> crate::error::HostResult<crate::rope::MutationPlan> {
    plan_create(
        &view,
        &vars.input.bufferKey,
        &vars.input.initialText,
        vars.input.projectionPath,
    )
}

fn replace_range_executor(view: GraphView<'_>, scope: &NodeId, delta: &mut TickDelta) {
    let Some(vars) = replace_range_as_tick_contract_vars(view, scope) else {
        return;
    };
    if let Ok(plan) = replace_plan(view, vars) {
        plan.emit(delta);
    }
}

fn replace_range_footprint(view: GraphView<'_>, scope: &NodeId) -> Footprint {
    let mut footprint = replace_range_as_tick_contract_runtime_ingress_footprint(view, scope);
    if let Some(vars) = replace_range_as_tick_contract_vars(view, scope) {
        if let Ok(plan) = replace_plan(view, vars) {
            plan.extend_footprint(&mut footprint);
        }
    }
    footprint
}

fn replace_plan(
    view: GraphView<'_>,
    vars: ReplaceRangeAsTickVars,
) -> crate::error::HostResult<crate::rope::MutationPlan> {
    plan_replace(
        &view,
        parse_node_id(&vars.input.bufferId)?,
        parse_node_id(&vars.input.basisHeadId)?,
        non_negative(vars.input.startByte, "startByte")?,
        non_negative(vars.input.endByte, "endByte")?,
        &vars.input.insertText,
    )
}

fn declare_checkpoint_executor(view: GraphView<'_>, scope: &NodeId, delta: &mut TickDelta) {
    let Some(vars) = declare_checkpoint_contract_vars(view, scope) else {
        return;
    };
    if let Ok(plan) = declare_checkpoint_plan(view, vars) {
        plan.emit(delta);
    }
}

fn declare_checkpoint_footprint(view: GraphView<'_>, scope: &NodeId) -> Footprint {
    let mut footprint = declare_checkpoint_contract_runtime_ingress_footprint(view, scope);
    if let Some(vars) = declare_checkpoint_contract_vars(view, scope) {
        if let Ok(plan) = declare_checkpoint_plan(view, vars) {
            plan.extend_footprint(&mut footprint);
        }
    }
    footprint
}

fn declare_checkpoint_plan(
    view: GraphView<'_>,
    vars: DeclareCheckpointVars,
) -> crate::error::HostResult<crate::rope::CheckpointPlan> {
    plan_checkpoint(
        &view,
        parse_node_id(&vars.input.bufferId)?,
        parse_node_id(&vars.input.basisHeadId)?,
        checkpoint_reason(&vars.input.reason)?,
    )
}

fn checkpoint_reason(reason: &str) -> crate::error::HostResult<CheckpointReason> {
    match reason {
        CHECKPOINT_REASON_MANUAL_SAVE => Ok(CheckpointReason::ManualSave),
        CHECKPOINT_REASON_AUTOSAVE => Ok(CheckpointReason::Autosave),
        CHECKPOINT_REASON_RETENTION_BOUNDARY => Ok(CheckpointReason::RetentionBoundary),
        CHECKPOINT_REASON_EXPORT => Ok(CheckpointReason::Export),
        CHECKPOINT_REASON_IMPORT => Ok(CheckpointReason::Import),
        unsupported => Err(crate::error::HostError::InvalidRequest(format!(
            "unsupported checkpoint reason: {unsupported}"
        ))),
    }
}

pub fn generated_checkpoint_reason(reason: CheckpointReason) -> &'static str {
    match reason {
        CheckpointReason::ManualSave => CHECKPOINT_REASON_MANUAL_SAVE,
        CheckpointReason::Autosave => CHECKPOINT_REASON_AUTOSAVE,
        CheckpointReason::RetentionBoundary => CHECKPOINT_REASON_RETENTION_BOUNDARY,
        CheckpointReason::Export => CHECKPOINT_REASON_EXPORT,
        CheckpointReason::Import => CHECKPOINT_REASON_IMPORT,
    }
}

fn observe_text_window(
    context: &ContractQueryObserverContext<'_>,
    vars: TextWindowVars,
) -> Result<ContractQueryObserverResult, ContractQueryObserverError> {
    let frontier = context
        .runtime
        .worldlines()
        .get(&context.resolved.worldline_id)
        .ok_or_else(|| observer_error("resolved worldline is unavailable"))?;
    let state = frontier.state();
    let store = state
        .store(&state.root().warp_id)
        .ok_or_else(|| observer_error("resolved worldline root store is unavailable"))?;
    let projection = read_window(
        store,
        parse_node_id(&vars.input.bufferId).map_err(observer_host_error)?,
        parse_node_id(&vars.input.basisHeadId).map_err(observer_host_error)?,
        non_negative(vars.input.startByte, "startByte").map_err(observer_host_error)?,
        non_negative(vars.input.endByte, "endByte").map_err(observer_host_error)?,
        non_negative(vars.input.maxBytes, "maxBytes").map_err(observer_host_error)?,
    )
    .map_err(observer_host_error)?;
    let bytes = serde_json::to_vec(&projection)
        .map_err(|error| observer_error(format!("encode text window: {error}")))?;
    Ok(ContractQueryObserverResult::complete(bytes))
}

fn non_negative(value: i32, field: &str) -> crate::error::HostResult<u64> {
    u64::try_from(value).map_err(|_| {
        crate::error::HostError::InvalidRequest(format!("{field} must be non-negative"))
    })
}

fn observer_host_error(error: crate::error::HostError) -> ContractQueryObserverError {
    observer_error(error.to_string())
}

fn observer_error(message: impl Into<String>) -> ContractQueryObserverError {
    ContractQueryObserverError::failed(crate::generated::contract::OP_TEXT_WINDOW, message)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn checkpoint_reason_scalar_has_an_exact_native_domain() {
        let supported = [
            (CHECKPOINT_REASON_MANUAL_SAVE, CheckpointReason::ManualSave),
            (CHECKPOINT_REASON_AUTOSAVE, CheckpointReason::Autosave),
            (
                CHECKPOINT_REASON_RETENTION_BOUNDARY,
                CheckpointReason::RetentionBoundary,
            ),
            (CHECKPOINT_REASON_EXPORT, CheckpointReason::Export),
            (CHECKPOINT_REASON_IMPORT, CheckpointReason::Import),
        ];

        for (encoded, reason) in supported {
            assert_eq!(checkpoint_reason(encoded).expect("reason should decode"), reason);
            assert_eq!(generated_checkpoint_reason(reason), encoded);
        }

        assert!(matches!(
            checkpoint_reason("initial"),
            Err(crate::error::HostError::InvalidRequest(_))
        ));
    }
}
