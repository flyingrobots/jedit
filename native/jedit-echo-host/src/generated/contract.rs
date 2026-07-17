use echo_wasm_abi::codec::{Decode as _, Encode as _};
use serde::{Deserialize, Serialize};
pub const SCHEMA_SHA256: &str = "fa8a33ad961bbd49eecd1f7b26782124e570948c290000a3f8d6ce2fb61d0f55";
pub const ECHO_CONTRACT_ABI_VERSION: u32 = 1;
pub const CODEC_ID: &str = "le-binary-v1";
pub const REGISTRY_VERSION: u32 = 1u32;
pub const WESLEY_GENERATOR_VERSION: &str = "echo-wesley-gen/0.1.0";
pub const CONTRACT_HOST_HELPER_API_VERSION: u32 = 1;
pub const GENERATED_RUST_ARTIFACT_HASH: &str =
    "d07f667d060664348e3980fb2b2694a2e0f45810843110e355272513fdbf13b7";
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct BufferWorldline {
    pub bufferId: String,
    pub canonicalHeadId: String,
    pub byteLength: i32,
    pub lineCount: i32,
}
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct CreateBufferWorldlineInput {
    pub bufferKey: String,
    pub initialText: String,
    pub projectionPath: Option<String>,
}
impl echo_wasm_abi::codec::Encode for CreateBufferWorldlineInput {
    fn encode(
        &self,
        w: &mut echo_wasm_abi::codec::Writer,
    ) -> Result<(), echo_wasm_abi::codec::CodecError> {
        w.write_string(&self.bufferKey, usize::MAX)?;
        w.write_string(&self.initialText, usize::MAX)?;
        w.write_option(self.projectionPath.as_deref(), |w, v| {
            w.write_string(v, usize::MAX)
        })?;
        Ok(())
    }
}
impl echo_wasm_abi::codec::Decode for CreateBufferWorldlineInput {
    fn decode(
        r: &mut echo_wasm_abi::codec::Reader<'_>,
    ) -> Result<Self, echo_wasm_abi::codec::CodecError> {
        Ok(Self {
            bufferKey: r.read_string(usize::MAX)?,
            initialText: r.read_string(usize::MAX)?,
            projectionPath: r.read_option(|r| r.read_string(usize::MAX))?,
        })
    }
}
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Mutation {
    pub createBufferWorldline: BufferWorldline,
    pub replaceRangeAsTick: BufferWorldline,
}
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Query {
    pub textWindow: TextWindowReading,
}
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ReplaceRangeAsTickInput {
    pub bufferId: String,
    pub basisHeadId: String,
    pub startByte: i32,
    pub endByte: i32,
    pub insertText: String,
}
impl echo_wasm_abi::codec::Encode for ReplaceRangeAsTickInput {
    fn encode(
        &self,
        w: &mut echo_wasm_abi::codec::Writer,
    ) -> Result<(), echo_wasm_abi::codec::CodecError> {
        w.write_string(&self.bufferId, usize::MAX)?;
        w.write_string(&self.basisHeadId, usize::MAX)?;
        w.write_i32_le(self.startByte);
        w.write_i32_le(self.endByte);
        w.write_string(&self.insertText, usize::MAX)?;
        Ok(())
    }
}
impl echo_wasm_abi::codec::Decode for ReplaceRangeAsTickInput {
    fn decode(
        r: &mut echo_wasm_abi::codec::Reader<'_>,
    ) -> Result<Self, echo_wasm_abi::codec::CodecError> {
        Ok(Self {
            bufferId: r.read_string(usize::MAX)?,
            basisHeadId: r.read_string(usize::MAX)?,
            startByte: r.read_i32_le()?,
            endByte: r.read_i32_le()?,
            insertText: r.read_string(usize::MAX)?,
        })
    }
}
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct TextWindowInput {
    pub bufferId: String,
    pub basisHeadId: String,
    pub startByte: i32,
    pub endByte: i32,
    pub maxBytes: i32,
}
impl echo_wasm_abi::codec::Encode for TextWindowInput {
    fn encode(
        &self,
        w: &mut echo_wasm_abi::codec::Writer,
    ) -> Result<(), echo_wasm_abi::codec::CodecError> {
        w.write_string(&self.bufferId, usize::MAX)?;
        w.write_string(&self.basisHeadId, usize::MAX)?;
        w.write_i32_le(self.startByte);
        w.write_i32_le(self.endByte);
        w.write_i32_le(self.maxBytes);
        Ok(())
    }
}
impl echo_wasm_abi::codec::Decode for TextWindowInput {
    fn decode(
        r: &mut echo_wasm_abi::codec::Reader<'_>,
    ) -> Result<Self, echo_wasm_abi::codec::CodecError> {
        Ok(Self {
            bufferId: r.read_string(usize::MAX)?,
            basisHeadId: r.read_string(usize::MAX)?,
            startByte: r.read_i32_le()?,
            endByte: r.read_i32_le()?,
            maxBytes: r.read_i32_le()?,
        })
    }
}
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct TextWindowLine {
    pub lineNumber: i32,
    pub startByte: i32,
    pub endByte: i32,
    pub text: String,
}
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct TextWindowReading {
    pub bufferId: String,
    pub basisHeadId: String,
    pub rootNodeId: Option<String>,
    pub byteLength: i32,
    pub lineCount: i32,
    pub startByte: i32,
    pub endByte: i32,
    pub lines: Vec<TextWindowLine>,
}
use echo_registry_api::{
    ArgDef, EnumDef, ObjectDef, OpDef, OpKind, RegistryInfo, RegistryProvider,
};
pub const ENUMS: &[EnumDef] = &[];
pub const OBJ_BUFFERWORLDLINE_FIELDS: &[ArgDef] = &[
    ArgDef {
        name: "bufferId",
        ty: "ID",
        required: true,
        list: false,
    },
    ArgDef {
        name: "canonicalHeadId",
        ty: "ID",
        required: true,
        list: false,
    },
    ArgDef {
        name: "byteLength",
        ty: "Int",
        required: true,
        list: false,
    },
    ArgDef {
        name: "lineCount",
        ty: "Int",
        required: true,
        list: false,
    },
];
pub const OBJ_MUTATION_FIELDS: &[ArgDef] = &[
    ArgDef {
        name: "createBufferWorldline",
        ty: "BufferWorldline",
        required: true,
        list: false,
    },
    ArgDef {
        name: "replaceRangeAsTick",
        ty: "BufferWorldline",
        required: true,
        list: false,
    },
];
pub const OBJ_QUERY_FIELDS: &[ArgDef] = &[ArgDef {
    name: "textWindow",
    ty: "TextWindowReading",
    required: true,
    list: false,
}];
pub const OBJ_TEXTWINDOWLINE_FIELDS: &[ArgDef] = &[
    ArgDef {
        name: "lineNumber",
        ty: "Int",
        required: true,
        list: false,
    },
    ArgDef {
        name: "startByte",
        ty: "Int",
        required: true,
        list: false,
    },
    ArgDef {
        name: "endByte",
        ty: "Int",
        required: true,
        list: false,
    },
    ArgDef {
        name: "text",
        ty: "String",
        required: true,
        list: false,
    },
];
pub const OBJ_TEXTWINDOWREADING_FIELDS: &[ArgDef] = &[
    ArgDef {
        name: "bufferId",
        ty: "ID",
        required: true,
        list: false,
    },
    ArgDef {
        name: "basisHeadId",
        ty: "ID",
        required: true,
        list: false,
    },
    ArgDef {
        name: "rootNodeId",
        ty: "ID",
        required: false,
        list: false,
    },
    ArgDef {
        name: "byteLength",
        ty: "Int",
        required: true,
        list: false,
    },
    ArgDef {
        name: "lineCount",
        ty: "Int",
        required: true,
        list: false,
    },
    ArgDef {
        name: "startByte",
        ty: "Int",
        required: true,
        list: false,
    },
    ArgDef {
        name: "endByte",
        ty: "Int",
        required: true,
        list: false,
    },
    ArgDef {
        name: "lines",
        ty: "TextWindowLine",
        required: true,
        list: true,
    },
];
pub const OBJECTS: &[ObjectDef] = &[
    ObjectDef {
        name: "BufferWorldline",
        fields: OBJ_BUFFERWORLDLINE_FIELDS,
    },
    ObjectDef {
        name: "Mutation",
        fields: OBJ_MUTATION_FIELDS,
    },
    ObjectDef {
        name: "Query",
        fields: OBJ_QUERY_FIELDS,
    },
    ObjectDef {
        name: "TextWindowLine",
        fields: OBJ_TEXTWINDOWLINE_FIELDS,
    },
    ObjectDef {
        name: "TextWindowReading",
        fields: OBJ_TEXTWINDOWREADING_FIELDS,
    },
];
pub const OP_TEXT_WINDOW: u32 = 2414231278u32;
pub const OP_TEXT_WINDOW_ARGS: &[ArgDef] = &[ArgDef {
    name: "input",
    ty: "TextWindowInput",
    required: true,
    list: false,
}];
pub const OP_CREATE_BUFFER_WORLDLINE: u32 = 2519122874u32;
pub const OP_CREATE_BUFFER_WORLDLINE_ARGS: &[ArgDef] = &[ArgDef {
    name: "input",
    ty: "CreateBufferWorldlineInput",
    required: true,
    list: false,
}];
pub const OP_REPLACE_RANGE_AS_TICK: u32 = 3329158538u32;
pub const OP_REPLACE_RANGE_AS_TICK_ARGS: &[ArgDef] = &[ArgDef {
    name: "input",
    ty: "ReplaceRangeAsTickInput",
    required: true,
    list: false,
}];
/// Generated operation helper namespace.
///
/// Helper-only types live here so user-controlled Wesley types can
/// use names such as `IncrementVars` or `GeneratedIntentError`
/// without colliding with generated plumbing.
pub mod __echo_wesley_generated {
    use echo_wasm_abi::codec::{Decode as _, Encode as _};
    use echo_wasm_abi::kernel_port::{
        AdmissionLawId, DispatchOpticIntentRequest, IntentFamilyId, OpticCapability, OpticCause,
        OpticIntentPayload,
    };
    use echo_wasm_abi::kernel_port::{
        AttachmentDescentPolicy, EchoCoordinate, ObservationAt, ObservationCoordinate,
        ObservationFrame, ObservationProjection, ObservationRequest, ObserveOpticRequest,
        OpticAperture, OpticApertureShape, OpticCapabilityId, OpticFocus, OpticId, OpticReadBudget,
        ProjectionVersion, ReducerVersion, WorldlineId,
    };
    use echo_wasm_abi::pack_intent_v1;
    /// Error produced while building a generated EINT intent.
    #[derive(Debug)]
    pub enum GeneratedIntentError {
        /// Operation vars could not be encoded.
        EncodeVars(echo_wasm_abi::codec::CodecError),
        /// Encoded vars could not be packed into an EINT envelope.
        PackEnvelope(echo_wasm_abi::EnvelopeError),
    }
    use warp_core::{
        ConflictPolicy, Footprint, GraphView, NodeId, PatternGraph, RewriteRule, TickDelta,
    };
    fn generated_vars_digest(vars_bytes: &[u8]) -> Vec<u8> {
        echo_wasm_abi::query_vars_digest_v1(vars_bytes)
    }
    /// LE binary vars payload for this generated operation.
    #[derive(Debug, Clone, PartialEq, serde::Serialize, serde::Deserialize)]
    pub struct TextWindowVars {
        pub input: super::TextWindowInput,
    }
    impl echo_wasm_abi::codec::Encode for TextWindowVars {
        fn encode(
            &self,
            w: &mut echo_wasm_abi::codec::Writer,
        ) -> Result<(), echo_wasm_abi::codec::CodecError> {
            self.input.encode(w)?;
            Ok(())
        }
    }
    impl echo_wasm_abi::codec::Decode for TextWindowVars {
        fn decode(
            r: &mut echo_wasm_abi::codec::Reader<'_>,
        ) -> Result<Self, echo_wasm_abi::codec::CodecError> {
            Ok(Self {
                input: super::TextWindowInput::decode(r)?,
            })
        }
    }
    /// Encode this operation's vars using the LE binary codec.
    pub fn encode_text_window_vars(
        vars: &TextWindowVars,
    ) -> Result<Vec<u8>, echo_wasm_abi::codec::CodecError> {
        echo_wasm_abi::codec::encode_to_vec(vars)
    }
    /// Encode this query's vars and build a frontier query-view observation request.
    pub fn text_window_observation_request(
        worldline_id: WorldlineId,
        vars: &TextWindowVars,
    ) -> Result<ObservationRequest, echo_wasm_abi::codec::CodecError> {
        let vars_bytes = encode_text_window_vars(vars)?;
        Ok(text_window_observation_request_raw_vars(
            worldline_id,
            &vars_bytes,
        ))
    }
    /// Build a frontier query-view request from already-canonical vars bytes.
    pub fn text_window_observation_request_raw_vars(
        worldline_id: WorldlineId,
        vars: &[u8],
    ) -> ObservationRequest {
        ObservationRequest::builtin_one_shot(
            ObservationCoordinate {
                worldline_id,
                at: ObservationAt::Frontier,
            },
            ObservationFrame::QueryView,
            ObservationProjection::Query {
                query_id: super::OP_TEXT_WINDOW,
                vars_bytes: Vec::from(vars),
            },
        )
        .expect("generated query observation request uses a valid frame/projection pair")
    }
    /// Encode this query's vars and build a bounded optic read request.
    #[allow(clippy::too_many_arguments)]
    pub fn text_window_observe_optic_request(
        optic_id: OpticId,
        focus: OpticFocus,
        coordinate: EchoCoordinate,
        capability: OpticCapabilityId,
        projection_version: ProjectionVersion,
        reducer_version: Option<ReducerVersion>,
        budget: OpticReadBudget,
        vars: &TextWindowVars,
    ) -> Result<ObserveOpticRequest, echo_wasm_abi::codec::CodecError> {
        let vars_bytes = encode_text_window_vars(vars)?;
        Ok(text_window_observe_optic_request_raw_vars(
            optic_id,
            focus,
            coordinate,
            capability,
            projection_version,
            reducer_version,
            budget,
            &vars_bytes,
        ))
    }
    /// Build a bounded optic read request from already-canonical vars bytes.
    #[allow(clippy::too_many_arguments)]
    pub fn text_window_observe_optic_request_raw_vars(
        optic_id: OpticId,
        focus: OpticFocus,
        coordinate: EchoCoordinate,
        capability: OpticCapabilityId,
        projection_version: ProjectionVersion,
        reducer_version: Option<ReducerVersion>,
        budget: OpticReadBudget,
        vars: &[u8],
    ) -> ObserveOpticRequest {
        ObserveOpticRequest {
            optic_id,
            focus,
            coordinate,
            aperture: OpticAperture {
                shape: OpticApertureShape::QueryBytes {
                    query_id: super::OP_TEXT_WINDOW,
                    vars_digest: generated_vars_digest(vars),
                },
                budget,
                attachment_descent: AttachmentDescentPolicy::BoundaryOnly,
            },
            projection_version,
            reducer_version,
            capability,
        }
    }
    /// Stable authored observer plan-id label for this generated query.
    pub const OP_TEXT_WINDOW_OBSERVER_PLAN_ID_LABEL: &str = "observer:query/fa8a33ad961bbd49eecd1f7b26782124e570948c290000a3f8d6ce2fb61d0f55/2414231278/textWindow";
    /// Stable artifact hash for this generated query observer helper.
    pub const OP_TEXT_WINDOW_OBSERVER_ARTIFACT_HASH: &str =
        "fbcbb49cdbe36be579a505d616f362ed02e606e1b5870f86277b4fb8eab3e450";
    /// Build the authored observer plan stamped onto readings emitted
    /// by this generated query observer.
    pub fn text_window_observer_plan() -> warp_core::AuthoredObserverPlan {
        warp_core::AuthoredObserverPlan {
            plan_id: warp_core::ObserverPlanId::from_bytes([
                174u8, 65u8, 18u8, 210u8, 111u8, 160u8, 131u8, 26u8, 21u8, 89u8, 22u8, 170u8,
                205u8, 16u8, 127u8, 73u8, 241u8, 198u8, 40u8, 173u8, 1u8, 5u8, 149u8, 37u8, 243u8,
                109u8, 101u8, 61u8, 137u8, 161u8, 91u8, 22u8,
            ]),
            artifact_hash: [
                251u8, 203u8, 180u8, 156u8, 219u8, 227u8, 107u8, 229u8, 121u8, 165u8, 5u8, 214u8,
                22u8, 243u8, 98u8, 237u8, 2u8, 230u8, 6u8, 225u8, 181u8, 135u8, 15u8, 134u8, 39u8,
                123u8, 79u8, 184u8, 234u8, 179u8, 228u8, 80u8,
            ],
            schema_hash: [
                250u8, 138u8, 51u8, 173u8, 150u8, 27u8, 189u8, 73u8, 238u8, 205u8, 31u8, 123u8,
                38u8, 120u8, 33u8, 36u8, 229u8, 112u8, 148u8, 140u8, 41u8, 0u8, 0u8, 163u8, 248u8,
                214u8, 206u8, 47u8, 182u8, 29u8, 15u8, 85u8,
            ],
            state_schema_hash: [
                147u8, 228u8, 214u8, 181u8, 211u8, 49u8, 232u8, 197u8, 152u8, 102u8, 112u8, 205u8,
                46u8, 153u8, 13u8, 232u8, 214u8, 160u8, 41u8, 13u8, 51u8, 200u8, 18u8, 0u8, 4u8,
                52u8, 165u8, 114u8, 220u8, 217u8, 250u8, 54u8,
            ],
            update_law_hash: [
                126u8, 142u8, 166u8, 17u8, 104u8, 153u8, 36u8, 6u8, 149u8, 102u8, 84u8, 208u8,
                154u8, 49u8, 214u8, 186u8, 91u8, 79u8, 245u8, 17u8, 253u8, 66u8, 227u8, 153u8,
                246u8, 59u8, 207u8, 69u8, 25u8, 225u8, 151u8, 234u8,
            ],
            emission_law_hash: [
                91u8, 245u8, 53u8, 43u8, 51u8, 0u8, 19u8, 6u8, 58u8, 173u8, 94u8, 158u8, 224u8,
                253u8, 97u8, 2u8, 153u8, 169u8, 3u8, 69u8, 102u8, 99u8, 118u8, 5u8, 216u8, 24u8,
                14u8, 0u8, 28u8, 220u8, 99u8, 57u8,
            ],
        }
    }
    /// Decode this query's generated vars from read-only observer context.
    pub fn text_window_observer_vars(
        context: &warp_core::ContractQueryObserverContext<'_>,
    ) -> Result<TextWindowVars, echo_wasm_abi::codec::CodecError> {
        echo_wasm_abi::codec::decode_from_bytes(context.vars_bytes)
    }
    /// Build a read-only `warp-core` query observer for this generated query.
    pub fn text_window_query_observer<F>(observe: F) -> warp_core::ContractQueryObserver
    where
        F: for<'a> Fn(
                &warp_core::ContractQueryObserverContext<'a>,
                TextWindowVars,
            ) -> Result<
                warp_core::ContractQueryObserverResult,
                warp_core::ContractQueryObserverError,
            > + Send
            + Sync
            + 'static,
    {
        warp_core::ContractQueryObserver::new(
            super::OP_TEXT_WINDOW,
            text_window_observer_plan(),
            move |context| {
                let vars = text_window_observer_vars(&context).map_err(|error| {
                    warp_core::ContractQueryObserverError::invalid_vars(
                        context.query_id,
                        error.to_string(),
                    )
                })?;
                observe(&context, vars)
            },
        )
    }
    /// LE binary vars payload for this generated operation.
    #[derive(Debug, Clone, PartialEq, serde::Serialize, serde::Deserialize)]
    pub struct CreateBufferWorldlineVars {
        pub input: super::CreateBufferWorldlineInput,
    }
    impl echo_wasm_abi::codec::Encode for CreateBufferWorldlineVars {
        fn encode(
            &self,
            w: &mut echo_wasm_abi::codec::Writer,
        ) -> Result<(), echo_wasm_abi::codec::CodecError> {
            self.input.encode(w)?;
            Ok(())
        }
    }
    impl echo_wasm_abi::codec::Decode for CreateBufferWorldlineVars {
        fn decode(
            r: &mut echo_wasm_abi::codec::Reader<'_>,
        ) -> Result<Self, echo_wasm_abi::codec::CodecError> {
            Ok(Self {
                input: super::CreateBufferWorldlineInput::decode(r)?,
            })
        }
    }
    /// Encode this operation's vars using the LE binary codec.
    pub fn encode_create_buffer_worldline_vars(
        vars: &CreateBufferWorldlineVars,
    ) -> Result<Vec<u8>, echo_wasm_abi::codec::CodecError> {
        echo_wasm_abi::codec::encode_to_vec(vars)
    }
    /// Encode this mutation's vars and pack them into an EINT v1 intent.
    pub fn pack_create_buffer_worldline_intent(
        vars: &CreateBufferWorldlineVars,
    ) -> Result<Vec<u8>, GeneratedIntentError> {
        let vars_bytes =
            encode_create_buffer_worldline_vars(vars).map_err(GeneratedIntentError::EncodeVars)?;
        pack_intent_v1(super::OP_CREATE_BUFFER_WORLDLINE, &vars_bytes)
            .map_err(GeneratedIntentError::PackEnvelope)
    }
    /// Pack already-canonical vars bytes for this generated mutation into EINT v1.
    pub fn pack_create_buffer_worldline_intent_raw_vars(
        vars: &[u8],
    ) -> Result<Vec<u8>, echo_wasm_abi::EnvelopeError> {
        pack_intent_v1(super::OP_CREATE_BUFFER_WORLDLINE, vars)
    }
    /// Build an optic intent-dispatch request for this mutation.
    #[allow(clippy::too_many_arguments)]
    pub fn create_buffer_worldline_dispatch_optic_intent_request(
        optic_id: OpticId,
        base_coordinate: EchoCoordinate,
        intent_family: IntentFamilyId,
        focus: OpticFocus,
        cause: OpticCause,
        capability: OpticCapability,
        admission_law: AdmissionLawId,
        vars: &CreateBufferWorldlineVars,
    ) -> Result<DispatchOpticIntentRequest, GeneratedIntentError> {
        let vars_bytes =
            encode_create_buffer_worldline_vars(vars).map_err(GeneratedIntentError::EncodeVars)?;
        create_buffer_worldline_dispatch_optic_intent_request_raw_vars(
            optic_id,
            base_coordinate,
            intent_family,
            focus,
            cause,
            capability,
            admission_law,
            &vars_bytes,
        )
    }
    /// Build an optic intent-dispatch request from already-canonical vars bytes.
    #[allow(clippy::too_many_arguments)]
    pub fn create_buffer_worldline_dispatch_optic_intent_request_raw_vars(
        optic_id: OpticId,
        base_coordinate: EchoCoordinate,
        intent_family: IntentFamilyId,
        focus: OpticFocus,
        cause: OpticCause,
        capability: OpticCapability,
        admission_law: AdmissionLawId,
        vars: &[u8],
    ) -> Result<DispatchOpticIntentRequest, GeneratedIntentError> {
        let bytes = pack_intent_v1(super::OP_CREATE_BUFFER_WORLDLINE, vars)
            .map_err(GeneratedIntentError::PackEnvelope)?;
        Ok(DispatchOpticIntentRequest {
            optic_id,
            base_coordinate,
            intent_family,
            focus,
            cause,
            capability,
            admission_law,
            payload: OpticIntentPayload::EintV1 { bytes },
        })
    }
    /// Stable command-rule name for this generated contract mutation.
    pub const OP_CREATE_BUFFER_WORLDLINE_CONTRACT_RULE_NAME: &str = "cmd/contract/fa8a33ad961bbd49eecd1f7b26782124e570948c290000a3f8d6ce2fb61d0f55/2519122874/createBufferWorldline";
    /// Stable rule-id label for this generated contract mutation.
    pub const OP_CREATE_BUFFER_WORLDLINE_CONTRACT_RULE_ID_LABEL: &str = "rule:cmd/contract/fa8a33ad961bbd49eecd1f7b26782124e570948c290000a3f8d6ce2fb61d0f55/2519122874/createBufferWorldline";
    /// Return true when a scheduler-materialized runtime ingress event
    /// carries this mutation's EINT operation id.
    pub fn create_buffer_worldline_contract_matches(view: GraphView<'_>, scope: &NodeId) -> bool {
        warp_core::matches_eint_op(view, scope, super::OP_CREATE_BUFFER_WORLDLINE)
    }
    /// Decode this mutation's generated vars from a scheduler-materialized
    /// EINT runtime ingress event.
    pub fn create_buffer_worldline_contract_vars(
        view: GraphView<'_>,
        scope: &NodeId,
    ) -> Option<CreateBufferWorldlineVars> {
        let vars = warp_core::eint_vars_for_op(view, scope, super::OP_CREATE_BUFFER_WORLDLINE)?;
        echo_wasm_abi::codec::decode_from_bytes(vars).ok()
    }
    /// Base footprint for reading this mutation's runtime ingress event.
    ///
    /// Installed executors must extend this with their handler-specific
    /// graph, edge, attachment, and port writes.
    pub fn create_buffer_worldline_contract_runtime_ingress_footprint(
        view: GraphView<'_>,
        scope: &NodeId,
    ) -> Footprint {
        warp_core::runtime_ingress_eint_read_footprint(view, scope)
    }
    /// Build a `warp-core` command rule for this generated contract
    /// mutation using a host-supplied executor and footprint function.
    pub fn create_buffer_worldline_contract_rule(
        executor: for<'a> fn(GraphView<'a>, &NodeId, &mut TickDelta),
        compute_footprint: for<'a> fn(GraphView<'a>, &NodeId) -> Footprint,
    ) -> RewriteRule {
        RewriteRule {
            id: warp_core::make_type_id(OP_CREATE_BUFFER_WORLDLINE_CONTRACT_RULE_ID_LABEL).0,
            name: OP_CREATE_BUFFER_WORLDLINE_CONTRACT_RULE_NAME,
            left: PatternGraph { nodes: Vec::new() },
            matcher: create_buffer_worldline_contract_matches,
            executor,
            compute_footprint,
            factor_mask: 0,
            conflict_policy: ConflictPolicy::Abort,
            join_fn: None,
        }
    }
    /// LE binary vars payload for this generated operation.
    #[derive(Debug, Clone, PartialEq, serde::Serialize, serde::Deserialize)]
    pub struct ReplaceRangeAsTickVars {
        pub input: super::ReplaceRangeAsTickInput,
    }
    impl echo_wasm_abi::codec::Encode for ReplaceRangeAsTickVars {
        fn encode(
            &self,
            w: &mut echo_wasm_abi::codec::Writer,
        ) -> Result<(), echo_wasm_abi::codec::CodecError> {
            self.input.encode(w)?;
            Ok(())
        }
    }
    impl echo_wasm_abi::codec::Decode for ReplaceRangeAsTickVars {
        fn decode(
            r: &mut echo_wasm_abi::codec::Reader<'_>,
        ) -> Result<Self, echo_wasm_abi::codec::CodecError> {
            Ok(Self {
                input: super::ReplaceRangeAsTickInput::decode(r)?,
            })
        }
    }
    /// Encode this operation's vars using the LE binary codec.
    pub fn encode_replace_range_as_tick_vars(
        vars: &ReplaceRangeAsTickVars,
    ) -> Result<Vec<u8>, echo_wasm_abi::codec::CodecError> {
        echo_wasm_abi::codec::encode_to_vec(vars)
    }
    /// Encode this mutation's vars and pack them into an EINT v1 intent.
    pub fn pack_replace_range_as_tick_intent(
        vars: &ReplaceRangeAsTickVars,
    ) -> Result<Vec<u8>, GeneratedIntentError> {
        let vars_bytes =
            encode_replace_range_as_tick_vars(vars).map_err(GeneratedIntentError::EncodeVars)?;
        pack_intent_v1(super::OP_REPLACE_RANGE_AS_TICK, &vars_bytes)
            .map_err(GeneratedIntentError::PackEnvelope)
    }
    /// Pack already-canonical vars bytes for this generated mutation into EINT v1.
    pub fn pack_replace_range_as_tick_intent_raw_vars(
        vars: &[u8],
    ) -> Result<Vec<u8>, echo_wasm_abi::EnvelopeError> {
        pack_intent_v1(super::OP_REPLACE_RANGE_AS_TICK, vars)
    }
    /// Build an optic intent-dispatch request for this mutation.
    #[allow(clippy::too_many_arguments)]
    pub fn replace_range_as_tick_dispatch_optic_intent_request(
        optic_id: OpticId,
        base_coordinate: EchoCoordinate,
        intent_family: IntentFamilyId,
        focus: OpticFocus,
        cause: OpticCause,
        capability: OpticCapability,
        admission_law: AdmissionLawId,
        vars: &ReplaceRangeAsTickVars,
    ) -> Result<DispatchOpticIntentRequest, GeneratedIntentError> {
        let vars_bytes =
            encode_replace_range_as_tick_vars(vars).map_err(GeneratedIntentError::EncodeVars)?;
        replace_range_as_tick_dispatch_optic_intent_request_raw_vars(
            optic_id,
            base_coordinate,
            intent_family,
            focus,
            cause,
            capability,
            admission_law,
            &vars_bytes,
        )
    }
    /// Build an optic intent-dispatch request from already-canonical vars bytes.
    #[allow(clippy::too_many_arguments)]
    pub fn replace_range_as_tick_dispatch_optic_intent_request_raw_vars(
        optic_id: OpticId,
        base_coordinate: EchoCoordinate,
        intent_family: IntentFamilyId,
        focus: OpticFocus,
        cause: OpticCause,
        capability: OpticCapability,
        admission_law: AdmissionLawId,
        vars: &[u8],
    ) -> Result<DispatchOpticIntentRequest, GeneratedIntentError> {
        let bytes = pack_intent_v1(super::OP_REPLACE_RANGE_AS_TICK, vars)
            .map_err(GeneratedIntentError::PackEnvelope)?;
        Ok(DispatchOpticIntentRequest {
            optic_id,
            base_coordinate,
            intent_family,
            focus,
            cause,
            capability,
            admission_law,
            payload: OpticIntentPayload::EintV1 { bytes },
        })
    }
    /// Stable command-rule name for this generated contract mutation.
    pub const OP_REPLACE_RANGE_AS_TICK_CONTRACT_RULE_NAME: &str = "cmd/contract/fa8a33ad961bbd49eecd1f7b26782124e570948c290000a3f8d6ce2fb61d0f55/3329158538/replaceRangeAsTick";
    /// Stable rule-id label for this generated contract mutation.
    pub const OP_REPLACE_RANGE_AS_TICK_CONTRACT_RULE_ID_LABEL: &str = "rule:cmd/contract/fa8a33ad961bbd49eecd1f7b26782124e570948c290000a3f8d6ce2fb61d0f55/3329158538/replaceRangeAsTick";
    /// Return true when a scheduler-materialized runtime ingress event
    /// carries this mutation's EINT operation id.
    pub fn replace_range_as_tick_contract_matches(view: GraphView<'_>, scope: &NodeId) -> bool {
        warp_core::matches_eint_op(view, scope, super::OP_REPLACE_RANGE_AS_TICK)
    }
    /// Decode this mutation's generated vars from a scheduler-materialized
    /// EINT runtime ingress event.
    pub fn replace_range_as_tick_contract_vars(
        view: GraphView<'_>,
        scope: &NodeId,
    ) -> Option<ReplaceRangeAsTickVars> {
        let vars = warp_core::eint_vars_for_op(view, scope, super::OP_REPLACE_RANGE_AS_TICK)?;
        echo_wasm_abi::codec::decode_from_bytes(vars).ok()
    }
    /// Base footprint for reading this mutation's runtime ingress event.
    ///
    /// Installed executors must extend this with their handler-specific
    /// graph, edge, attachment, and port writes.
    pub fn replace_range_as_tick_contract_runtime_ingress_footprint(
        view: GraphView<'_>,
        scope: &NodeId,
    ) -> Footprint {
        warp_core::runtime_ingress_eint_read_footprint(view, scope)
    }
    /// Build a `warp-core` command rule for this generated contract
    /// mutation using a host-supplied executor and footprint function.
    pub fn replace_range_as_tick_contract_rule(
        executor: for<'a> fn(GraphView<'a>, &NodeId, &mut TickDelta),
        compute_footprint: for<'a> fn(GraphView<'a>, &NodeId) -> Footprint,
    ) -> RewriteRule {
        RewriteRule {
            id: warp_core::make_type_id(OP_REPLACE_RANGE_AS_TICK_CONTRACT_RULE_ID_LABEL).0,
            name: OP_REPLACE_RANGE_AS_TICK_CONTRACT_RULE_NAME,
            left: PatternGraph { nodes: Vec::new() },
            matcher: replace_range_as_tick_contract_matches,
            executor,
            compute_footprint,
            factor_mask: 0,
            conflict_policy: ConflictPolicy::Abort,
            join_fn: None,
        }
    }
}
pub use __echo_wesley_generated::{
    create_buffer_worldline_contract_matches, create_buffer_worldline_contract_rule,
    create_buffer_worldline_contract_runtime_ingress_footprint,
    create_buffer_worldline_contract_vars, create_buffer_worldline_dispatch_optic_intent_request,
    create_buffer_worldline_dispatch_optic_intent_request_raw_vars,
    encode_create_buffer_worldline_vars, encode_replace_range_as_tick_vars,
    encode_text_window_vars, pack_create_buffer_worldline_intent,
    pack_create_buffer_worldline_intent_raw_vars, pack_replace_range_as_tick_intent,
    pack_replace_range_as_tick_intent_raw_vars, replace_range_as_tick_contract_matches,
    replace_range_as_tick_contract_rule, replace_range_as_tick_contract_runtime_ingress_footprint,
    replace_range_as_tick_contract_vars, replace_range_as_tick_dispatch_optic_intent_request,
    replace_range_as_tick_dispatch_optic_intent_request_raw_vars, text_window_observation_request,
    text_window_observation_request_raw_vars, text_window_observe_optic_request,
    text_window_observe_optic_request_raw_vars, text_window_observer_plan,
    text_window_observer_vars, text_window_query_observer,
    OP_CREATE_BUFFER_WORLDLINE_CONTRACT_RULE_ID_LABEL,
    OP_CREATE_BUFFER_WORLDLINE_CONTRACT_RULE_NAME, OP_REPLACE_RANGE_AS_TICK_CONTRACT_RULE_ID_LABEL,
    OP_REPLACE_RANGE_AS_TICK_CONTRACT_RULE_NAME, OP_TEXT_WINDOW_OBSERVER_ARTIFACT_HASH,
    OP_TEXT_WINDOW_OBSERVER_PLAN_ID_LABEL,
};
pub const OPS: &[OpDef] = &[
    OpDef {
        kind: OpKind::Query,
        name: "textWindow",
        op_id: 2414231278u32,
        args: OP_TEXT_WINDOW_ARGS,
        result_ty: "TextWindowReading",
        directives_json: "{}",
        footprint_certificate: None,
    },
    OpDef {
        kind: OpKind::Mutation,
        name: "createBufferWorldline",
        op_id: 2519122874u32,
        args: OP_CREATE_BUFFER_WORLDLINE_ARGS,
        result_ty: "BufferWorldline",
        directives_json: "{}",
        footprint_certificate: None,
    },
    OpDef {
        kind: OpKind::Mutation,
        name: "replaceRangeAsTick",
        op_id: 3329158538u32,
        args: OP_REPLACE_RANGE_AS_TICK_ARGS,
        result_ty: "BufferWorldline",
        directives_json: "{}",
        footprint_certificate: None,
    },
];
/// Lookup an op by ID.
pub fn op_by_id(op_id: u32) -> Option<&'static OpDef> {
    OPS.iter().find(|op| op.op_id == op_id)
}
/// Lookup an op by kind + name (useful for dev tooling, not for runtime intent routing).
pub fn op_by_name(kind: OpKind, name: &str) -> Option<&'static OpDef> {
    OPS.iter().find(|op| op.kind == kind && op.name == name)
}
/// Application-supplied registry provider implementation (generated from Wesley IR).
pub struct GeneratedRegistry;
impl RegistryProvider for GeneratedRegistry {
    fn info(&self) -> RegistryInfo {
        RegistryInfo {
            echo_abi_version: ECHO_CONTRACT_ABI_VERSION,
            codec_id: CODEC_ID,
            registry_version: REGISTRY_VERSION,
            schema_sha256_hex: SCHEMA_SHA256,
            wesley_generator_version: WESLEY_GENERATOR_VERSION,
            helper_api_version: CONTRACT_HOST_HELPER_API_VERSION,
        }
    }
    fn op_by_id(&self, op_id: u32) -> Option<&'static OpDef> {
        op_by_id(op_id)
    }
    fn all_ops(&self) -> &'static [OpDef] {
        OPS
    }
    fn all_enums(&self) -> &'static [EnumDef] {
        ENUMS
    }
    fn all_objects(&self) -> &'static [ObjectDef] {
        OBJECTS
    }
}
pub static REGISTRY: GeneratedRegistry = GeneratedRegistry;
