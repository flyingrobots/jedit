use echo_registry_api::ContractArtifactVerificationPolicy;
use warp_core::{
    ContractMutationHandler, ContractPackageIdentity, ContractQueryObserverContext,
    ContractQueryObserverError, ContractQueryObserverResult, Footprint, GraphView,
    InstalledContractPackage, NodeId, TickDelta,
};

use crate::generated::contract::__echo_wesley_generated::{
    CreateBufferWorldlineVars, ReplaceRangeAsTickVars, TextWindowVars,
};
use crate::generated::contract::{
    create_buffer_worldline_contract_rule,
    create_buffer_worldline_contract_runtime_ingress_footprint,
    create_buffer_worldline_contract_vars, replace_range_as_tick_contract_rule,
    replace_range_as_tick_contract_runtime_ingress_footprint, replace_range_as_tick_contract_vars,
    text_window_query_observer, CONTRACT_HOST_HELPER_API_VERSION, ECHO_CONTRACT_ABI_VERSION,
    GENERATED_RUST_ARTIFACT_HASH, OP_CREATE_BUFFER_WORLDLINE, OP_REPLACE_RANGE_AS_TICK, REGISTRY,
    REGISTRY_VERSION, SCHEMA_SHA256, WESLEY_GENERATOR_VERSION,
};
use crate::identity::parse_node_id;
use crate::rope::{plan_create, plan_replace, read_window};

const PACKAGE_NAME: &str = "jedit-echo-text";
const PACKAGE_VERSION: &str = "0.1.0-wesley-compat";

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
