use std::path::Path;

use warp_core::{
    make_head_id, make_intent_kind, make_node_id, make_type_id, ContractOperationKind,
    EngineBuilder, GraphStore, InboxPolicy, IngressEnvelope, IngressTarget,
    InstalledContractPackage, IntentOutcome, IntentOutcomeReceipt, NodeRecord, ObservationAt,
    ObservationCoordinate, ObservationFrame, ObservationPayload, ObservationProjection,
    ObservationReadBudget, PlaybackMode, SchedulerKind, TrustedRuntimeHost,
    TrustedRuntimeWalConfig, WorldlineId, WorldlineRuntime, WorldlineState, WriterHead,
    WriterHeadKey,
};

use crate::contract::{generated_checkpoint_reason, installed_package};
use crate::error::{HostError, HostResult};
use crate::generated::contract::__echo_wesley_generated::{
    CreateBufferWorldlineVars, DeclareCheckpointVars, ReplaceRangeAsTickVars, TextWindowVars,
};
use crate::generated::contract::{
    encode_text_window_vars, pack_create_buffer_worldline_intent, pack_declare_checkpoint_intent,
    pack_replace_range_as_tick_intent, CreateBufferWorldlineInput, DeclareCheckpointInput,
    ReplaceRangeAsTickInput, TextWindowInput, GENERATED_RUST_ARTIFACT_HASH,
    OP_CREATE_BUFFER_WORLDLINE, OP_DECLARE_CHECKPOINT, OP_REPLACE_RANGE_AS_TICK, OP_TEXT_WINDOW,
};
use crate::identity::{node_id_hex, parse_node_id};
use crate::protocol::{BufferResponse, HostRequest, HostResponse};
use crate::records::CheckpointReason;
use crate::rope::{
    buffer_snapshot, checkpoint_fact, existing_buffer, plan_checkpoint, plan_replace,
    WindowProjection,
};

const WORLDLINE_BYTES: [u8; 32] = [0x4a; 32];
const DEFAULT_HEAD_LABEL: &str = "jedit.echo-text.default-writer";
const ENGINE_ROOT_LABEL: &str = "jedit.echo-text.engine-root";
const ENGINE_ROOT_TYPE: &str = "jedit.echo-text.engine-world";
const MAX_SCHEDULER_PASSES: u64 = 4;
const EINT_INTENT_KIND: &str = "echo.intent/eint-v1";

pub struct JeditEchoHost {
    host: TrustedRuntimeHost,
    worldline_id: WorldlineId,
}

impl JeditEchoHost {
    pub fn open(wal_root: &Path) -> HostResult<Self> {
        let (runtime, worldline_id) = runtime()?;
        let mut host = TrustedRuntimeHost::new(runtime, empty_engine())
            .map_err(|error| HostError::Echo(error.to_string()))?;
        host.enable_runtime_wal(TrustedRuntimeWalConfig::filesystem(wal_root))
            .map_err(|error| HostError::Echo(error.to_string()))?;
        host.register_contract_package(installed_package())
            .map_err(|error| HostError::Echo(error.to_string()))?;
        Ok(Self { host, worldline_id })
    }

    pub fn handle(&mut self, request: HostRequest) -> HostResponse {
        let request_id = request.request_id();
        let response = match request {
            HostRequest::Open {
                buffer_key,
                initial_text,
                projection_path,
                ..
            } => self.open_buffer(request_id, buffer_key, initial_text, projection_path),
            HostRequest::Replace {
                buffer_id,
                start_byte,
                end_byte,
                insert_text,
                ..
            } => self.replace_range(request_id, buffer_id, start_byte, end_byte, insert_text),
            HostRequest::DeclareCheckpoint {
                buffer_id,
                basis_head_id,
                reason,
                ..
            } => self.declare_checkpoint(request_id, buffer_id, basis_head_id, reason),
            HostRequest::Observe {
                buffer_id,
                basis_head_id,
                start_byte,
                end_byte,
                max_bytes,
                ..
            } => self.observe_window(
                request_id,
                buffer_id,
                basis_head_id,
                start_byte,
                end_byte,
                max_bytes,
            ),
        };
        response.unwrap_or_else(|error| HostResponse::Obstructed {
            request_id,
            code: obstruction_code(&error).to_owned(),
            message: error.to_string(),
        })
    }

    fn open_buffer(
        &mut self,
        request_id: u64,
        buffer_key: String,
        initial_text: String,
        projection_path: Option<String>,
    ) -> HostResult<HostResponse> {
        if let Some(snapshot) = existing_buffer(self.store()?, &buffer_key)? {
            return Ok(HostResponse::Opened {
                request_id,
                buffer: snapshot.into(),
                receipt_id: None,
                admitted_tick_id: None,
            });
        }
        let intent = pack_create_buffer_worldline_intent(&CreateBufferWorldlineVars {
            input: CreateBufferWorldlineInput {
                bufferKey: buffer_key.clone(),
                initialText: initial_text,
                projectionPath: projection_path,
            },
        })
        .map_err(|error| HostError::Protocol(format!("pack create intent: {error:?}")))?;
        let receipt = self.submit_generated_intent(intent, OP_CREATE_BUFFER_WORLDLINE)?;
        let snapshot = existing_buffer(self.store()?, &buffer_key)?.ok_or_else(|| {
            HostError::IntentNotApplied("create receipt did not produce a buffer fact".to_owned())
        })?;
        Ok(HostResponse::Opened {
            request_id,
            buffer: snapshot.into(),
            receipt_id: Some(hex::encode(receipt.tick_receipt_digest)),
            admitted_tick_id: Some(tick_id(&receipt)),
        })
    }

    fn replace_range(
        &mut self,
        request_id: u64,
        buffer_id: String,
        start_byte: u64,
        end_byte: u64,
        insert_text: String,
    ) -> HostResult<HostResponse> {
        let buffer_node = parse_node_id(&buffer_id)?;
        let basis = buffer_snapshot(self.store()?, buffer_node)?;
        {
            let view = warp_core::GraphView::new(self.store()?);
            plan_replace(
                &view,
                buffer_node,
                basis.head_id,
                start_byte,
                end_byte,
                &insert_text,
            )?;
        }
        let intent = pack_replace_range_as_tick_intent(&ReplaceRangeAsTickVars {
            input: ReplaceRangeAsTickInput {
                bufferId: buffer_id,
                basisHeadId: node_id_hex(basis.head_id),
                startByte: bounded_i32(start_byte, "startByte")?,
                endByte: bounded_i32(end_byte, "endByte")?,
                insertText: insert_text,
            },
        })
        .map_err(|error| HostError::Protocol(format!("pack replace intent: {error:?}")))?;
        let receipt = self.submit_generated_intent(intent, OP_REPLACE_RANGE_AS_TICK)?;
        let snapshot = buffer_snapshot(self.store()?, buffer_node)?;
        if snapshot.head_id == basis.head_id {
            return Err(HostError::IntentNotApplied(
                "replace receipt did not advance the canonical rope head".to_owned(),
            ));
        }
        Ok(HostResponse::Applied {
            request_id,
            buffer: BufferResponse::from(snapshot),
            receipt_id: hex::encode(receipt.tick_receipt_digest),
            admitted_tick_id: tick_id(&receipt),
        })
    }

    fn declare_checkpoint(
        &mut self,
        request_id: u64,
        buffer_id: String,
        basis_head_id: String,
        reason: CheckpointReason,
    ) -> HostResult<HostResponse> {
        let buffer_node = parse_node_id(&buffer_id)?;
        let basis_head_node = parse_node_id(&basis_head_id)?;
        let plan = plan_checkpoint(self.store()?, buffer_node, basis_head_node, reason)?;
        let intent = pack_declare_checkpoint_intent(&DeclareCheckpointVars {
            input: DeclareCheckpointInput {
                bufferId: node_id_hex(buffer_node),
                basisHeadId: node_id_hex(basis_head_node),
                reason: generated_checkpoint_reason(reason).to_owned(),
            },
        })
        .map_err(|error| HostError::Protocol(format!("pack checkpoint intent: {error:?}")))?;
        let receipt = self.submit_generated_intent(intent, OP_DECLARE_CHECKPOINT)?;
        let admitted = checkpoint_fact(self.store()?, plan.checkpoint_id)?;
        if admitted.worldline_id.0 != *buffer_node.as_bytes()
            || admitted.head_id.0 != *basis_head_node.as_bytes()
            || admitted.reason != reason
        {
            return Err(HostError::IntentNotApplied(
                "checkpoint receipt did not produce the requested Jim fact".to_owned(),
            ));
        }
        let snapshot = buffer_snapshot(self.store()?, buffer_node)?;
        Ok(HostResponse::CheckpointDeclared {
            request_id,
            buffer: BufferResponse::from(snapshot),
            checkpoint_id: node_id_hex(plan.checkpoint_id),
            basis_head_id: node_id_hex(basis_head_node),
            basis_byte_length: plan.basis_byte_length,
            reason: plan.reason,
            receipt_id: hex::encode(receipt.tick_receipt_digest),
            admitted_tick_id: tick_id(&receipt),
        })
    }

    #[allow(clippy::too_many_arguments)]
    fn observe_window(
        &mut self,
        request_id: u64,
        buffer_id: String,
        basis_head_id: String,
        start_byte: u64,
        end_byte: u64,
        max_bytes: u64,
    ) -> HostResult<HostResponse> {
        let vars = TextWindowVars {
            input: TextWindowInput {
                bufferId: buffer_id,
                basisHeadId: basis_head_id,
                startByte: bounded_i32(start_byte, "startByte")?,
                endByte: bounded_i32(end_byte, "endByte")?,
                maxBytes: bounded_i32(max_bytes, "maxBytes")?,
            },
        };
        let vars_bytes = encode_text_window_vars(&vars)
            .map_err(|error| HostError::Protocol(format!("encode text-window vars: {error}")))?;
        let mut request = warp_core::ObservationRequest::builtin_one_shot(
            ObservationCoordinate {
                worldline_id: self.worldline_id,
                at: ObservationAt::Frontier,
            },
            ObservationFrame::QueryView,
            ObservationProjection::Query {
                query_id: OP_TEXT_WINDOW,
                vars_bytes,
            },
        )
        .map_err(|error| HostError::Observation(error.to_string()))?;
        request.budget = ObservationReadBudget::Bounded {
            max_payload_bytes: max_bytes.saturating_mul(8).saturating_add(16_384),
            max_witness_refs: 256,
        };
        let artifact = self
            .host
            .app()
            .observe(request)
            .map_err(|error| HostError::Observation(error.to_string()))?;
        let ObservationPayload::QueryBytes(bytes) = artifact.payload else {
            return Err(HostError::Observation(
                "text-window observer returned a non-query payload".to_owned(),
            ));
        };
        let window: WindowProjection = serde_json::from_slice(&bytes)
            .map_err(|error| HostError::Observation(format!("decode text window: {error}")))?;
        let reading_id = artifact
            .reading
            .query_identity
            .as_ref()
            .map(|identity| hex::encode(identity.reading_id))
            .ok_or_else(|| {
                HostError::Observation("query reading identity is missing".to_owned())
            })?;
        Ok(HostResponse::Observed {
            request_id,
            window,
            worldline_id: hex::encode(self.worldline_id.as_bytes()),
            reading_id,
            observer_plan_id: hex::encode(
                crate::generated::contract::text_window_observer_plan()
                    .plan_id
                    .as_bytes(),
            ),
            package_artifact_hash: GENERATED_RUST_ARTIFACT_HASH.to_owned(),
            resolved_worldline_tick: artifact.resolved.resolved_worldline_tick.as_u64(),
            commit_hash: hex::encode(artifact.resolved.commit_hash),
        })
    }

    fn submit_generated_intent(
        &mut self,
        intent: Vec<u8>,
        operation_id: u32,
    ) -> HostResult<IntentOutcomeReceipt> {
        require_generated_mutation(&installed_package(), operation_id)?;
        let envelope = IngressEnvelope::local_intent(
            IngressTarget::DefaultWriter {
                worldline_id: self.worldline_id,
            },
            make_intent_kind(EINT_INTENT_KIND),
            intent,
        );
        let submission = self
            .host
            .app()
            .submit_intent_with_runtime_wal_ack(envelope)
            .map_err(|error| HostError::Echo(error.to_string()))?;
        self.host
            .admit_installed_contract_submission(submission.submission_id)
            .map_err(|error| HostError::Echo(error.to_string()))?;
        self.host
            .run_until_idle(MAX_SCHEDULER_PASSES)
            .map_err(|error| HostError::Echo(error.to_string()))?;
        match self
            .host
            .app()
            .observe_intent_outcome(&submission.submission_id)
        {
            IntentOutcome::Applied { receipt, .. } => {
                let contract = receipt.contract.as_ref().ok_or_else(|| {
                    HostError::IntentNotApplied(
                        "receipt lacks installed-package evidence".to_owned(),
                    )
                })?;
                if contract.op_id != operation_id
                    || contract.op_kind != ContractOperationKind::Mutation
                {
                    return Err(HostError::IntentNotApplied(
                        "receipt cites a different generated operation".to_owned(),
                    ));
                }
                Ok(*receipt)
            }
            outcome => Err(HostError::IntentNotApplied(format!("{outcome:?}"))),
        }
    }

    fn store(&self) -> HostResult<&GraphStore> {
        let frontier = self
            .host
            .runtime()
            .worldlines()
            .get(&self.worldline_id)
            .ok_or_else(|| HostError::Echo("Jim worldline is unavailable".to_owned()))?;
        let state = frontier.state();
        state
            .store(&state.root().warp_id)
            .ok_or_else(|| HostError::Echo("Jim worldline root store is unavailable".to_owned()))
    }
}

fn require_generated_mutation(
    package: &InstalledContractPackage<'_>,
    operation_id: u32,
) -> HostResult<()> {
    if package
        .mutation_handlers
        .iter()
        .any(|handler| handler.op_id == operation_id)
    {
        return Ok(());
    }
    Err(HostError::GeneratedOperationUnavailable(format!(
        "mutation operation {operation_id} is not installed"
    )))
}

fn runtime() -> HostResult<(WorldlineRuntime, WorldlineId)> {
    let mut runtime = WorldlineRuntime::new();
    let worldline_id = WorldlineId::from_bytes(WORLDLINE_BYTES);
    runtime
        .register_worldline(worldline_id, WorldlineState::empty())
        .map_err(|error| HostError::Echo(error.to_string()))?;
    runtime
        .register_writer_head(WriterHead::with_routing(
            WriterHeadKey {
                worldline_id,
                head_id: make_head_id(DEFAULT_HEAD_LABEL),
            },
            PlaybackMode::Play,
            InboxPolicy::AcceptAll,
            None,
            true,
        ))
        .map_err(|error| HostError::Echo(error.to_string()))?;
    Ok((runtime, worldline_id))
}

fn empty_engine() -> warp_core::Engine {
    let mut store = GraphStore::default();
    let root = make_node_id(ENGINE_ROOT_LABEL);
    store.insert_node(
        root,
        NodeRecord {
            ty: make_type_id(ENGINE_ROOT_TYPE),
        },
    );
    EngineBuilder::new(store, root)
        .scheduler(SchedulerKind::Radix)
        .workers(1)
        .build()
}

fn tick_id(receipt: &IntentOutcomeReceipt) -> String {
    format!(
        "{}:{}:{}",
        hex::encode(receipt.causal_receipt_ref.worldline_id.as_bytes()),
        receipt.worldline_tick_after.as_u64(),
        hex::encode(receipt.commit_hash)
    )
}

fn bounded_i32(value: u64, field: &str) -> HostResult<i32> {
    i32::try_from(value)
        .map_err(|_| HostError::InvalidRequest(format!("{field} exceeds the v1 contract bound")))
}

fn obstruction_code(error: &HostError) -> &'static str {
    match error {
        HostError::InvalidRequest(_) => "invalid-request",
        HostError::MissingFact(_) => "missing-fact",
        HostError::MalformedFact(_) => "malformed-fact",
        HostError::IntentNotApplied(_) => "intent-not-applied",
        HostError::GeneratedOperationUnavailable(_) => "generated-operation-unavailable",
        HostError::Observation(_) => "observation-obstructed",
        HostError::Echo(_) => "echo-obstructed",
        HostError::Protocol(_) => "protocol-obstructed",
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::protocol::{HostRequest, HostResponse};
    use crate::records::{decode_fact, CheckpointFact, CheckpointReason, NodeIdBytes};

    #[test]
    fn missing_generated_checkpoint_operation_is_typed() {
        let mut test_only_package = installed_package();
        test_only_package
            .mutation_handlers
            .retain(|handler| handler.op_id != OP_DECLARE_CHECKPOINT);
        let error = require_generated_mutation(&test_only_package, OP_DECLARE_CHECKPOINT)
            .expect_err("missing generated operation should be obstructed");
        assert!(matches!(error, HostError::GeneratedOperationUnavailable(_)));
        assert_eq!(obstruction_code(&error), "generated-operation-unavailable");
    }

    #[test]
    fn checkpoint_fact_reconstructs_from_echo_wal_without_a_runtime_lookup_map() {
        let root = tempfile::tempdir().expect("temporary WAL root should exist");
        let (checkpoint_id, buffer_id, head_id) = {
            let mut host = JeditEchoHost::open(root.path()).expect("Echo host should initialize");
            let HostResponse::Opened { buffer, .. } = host.handle(HostRequest::Open {
                request_id: 1,
                buffer_key: "recovery.txt".to_owned(),
                initial_text: "history".to_owned(),
                projection_path: None,
            }) else {
                panic!("buffer should open");
            };
            let HostResponse::CheckpointDeclared { checkpoint_id, .. } =
                host.handle(HostRequest::DeclareCheckpoint {
                    request_id: 2,
                    buffer_id: buffer.buffer_id.clone(),
                    basis_head_id: buffer.head_id.clone(),
                    reason: CheckpointReason::ManualSave,
                })
            else {
                panic!("checkpoint should be declared");
            };
            (checkpoint_id, buffer.buffer_id, buffer.head_id)
        };

        let recovered = JeditEchoHost::open(root.path()).expect("Echo WAL should recover");
        let checkpoint_node_id = parse_node_id(&checkpoint_id).expect("opaque checkpoint id");
        let attachment = recovered
            .store()
            .expect("recovered graph store")
            .node_attachment(&checkpoint_node_id)
            .expect("checkpoint fact should survive restart");
        let checkpoint: CheckpointFact =
            decode_fact(attachment).expect("checkpoint fact should decode");
        assert_eq!(
            checkpoint,
            CheckpointFact {
                worldline_id: NodeIdBytes::from(
                    parse_node_id(&buffer_id).expect("opaque buffer id"),
                ),
                head_id: NodeIdBytes::from(parse_node_id(&head_id).expect("opaque head id")),
                reason: CheckpointReason::ManualSave,
            }
        );
    }
}
