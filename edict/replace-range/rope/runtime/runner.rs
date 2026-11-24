// SPDX-License-Identifier: Apache-2.0 OR LicenseRef-MIND-UCAL-1.0
// © James Ross Ω FLYING•ROBOTS <https://github.com/flyingrobots>
//! Test-only runtime consumer for the schema-2 row runner (#296).
//!
//! It installs a case graph in a fresh trusted host, admits an exact
//! compiler-produced package under an exact policy, admits one invocation,
//! evaluates the effect program in a recording frame, and derives the
//! proposal. It performs no replacement and links no native rope planner.
use echo_edict_canonical::{encode_canonical_cbor_v1 as encode, CanonicalValueV1 as Value};
use warp_core::edict_effects::{EffectFrameError, EffectMutation, TypedNodeRead};
use warp_core::edict_pure::EvaluationLimits;
use warp_core::{
    make_head_id, AtomPayload, AttachmentValue, EchoOperationAdmissionPolicy,
    EchoOperationApplicationBasisV1, EchoOperationBudgetV1, EchoOperationInvocationAdmissionPolicy,
    EdgeId, EdgeRecord, EngineBuilder, GraphStore, InboxPolicy, NodeId, NodeKey, NodeRecord,
    PlaybackMode, EffectPackageHost, TypeId, WarpId, WorldlineId, WorldlineRuntime,
    WorldlineState, WriterHead, WriterHeadKey,
};

const AUTHORITY_GRANT: [u8; 32] = [9; 32];

/// One stored node: its type and, when present, its alpha atom.
pub struct CaseNode {
    pub id: NodeId,
    pub ty: TypeId,
    pub atom: Option<(TypeId, Vec<u8>)>,
}

/// The graph a case runs over, its worldline root, and what the frame may read.
pub struct Case {
    pub warp: WarpId,
    pub root: NodeId,
    pub nodes: Vec<CaseNode>,
    pub edges: Vec<EdgeRecord>,
    pub edge_types: Vec<TypeId>,
    pub max_edge_scans: u64,
    pub typed_reads: Vec<(NodeId, TypeId)>,
    pub input: Vec<u8>,
}

/// The exact package under test and the owner's exact admission policy.
pub struct PackageUnderTest {
    pub bytes: Vec<u8>,
    pub pin: [u8; 32],
    pub operation: &'static str,
    pub authority_label: &'static [u8],
    /// The package's declared ceiling, which the exact policy matches.
    pub budget: (u64, u64, u64),
    /// The budget delegated to the invocation and its frame, within the ceiling.
    pub delegated: (u64, u64, u64),
    pub limits: EvaluationLimits,
}

/// What one evaluation produced.
pub struct Observation {
    pub output: Result<Vec<u8>, EffectFrameError>,
    pub mutations: Vec<EffectMutation>,
    /// The witnessed read set: (slot class, local id, range edge type) per row.
    pub reads: Vec<(u8, [u8; 32], [u8; 32])>,
    /// The derived patch's operation count, or the derivation refusal.
    pub derived_ops: Option<Result<usize, String>>,
}

pub fn hash(domain: &[u8], data: &[u8]) -> [u8; 32] {
    let mut hasher = blake3::Hasher::new();
    hasher.update(domain);
    hasher.update(&(data.len() as u64).to_le_bytes());
    hasher.update(data);
    hasher.finalize().into()
}

fn text(value: &str) -> Value {
    Value::Text(value.into())
}

fn bytes(value: impl AsRef<[u8]>) -> Value {
    Value::Bytes(value.as_ref().to_vec())
}

fn map(fields: impl IntoIterator<Item = (&'static str, Value)>) -> Value {
    Value::Map(fields.into_iter().map(|(key, value)| (text(key), value)).collect())
}

fn host(case: &Case) -> (EffectPackageHost, WriterHeadKey) {
    let mut store = GraphStore::new(case.warp);
    for node in &case.nodes {
        store.insert_node(node.id, NodeRecord { ty: node.ty });
        if let Some((type_id, atom)) = &node.atom {
            store.set_node_attachment(
                node.id,
                Some(AttachmentValue::Atom(AtomPayload {
                    type_id: *type_id,
                    bytes: atom.clone().into(),
                })),
            );
        }
    }
    for edge in &case.edges {
        store.insert_edge(edge.from, edge.clone());
    }
    let state = WorldlineState::from_root_store(store.clone(), case.root).expect("case state");
    let head = WriterHeadKey {
        worldline_id: WorldlineId::from_bytes([0x6a; 32]),
        head_id: make_head_id("jedit-rope-runtime-consumer"),
    };
    let mut runtime = WorldlineRuntime::new();
    runtime.register_worldline(head.worldline_id, state).expect("worldline");
    runtime
        .register_writer_head(WriterHead::with_routing(
            head,
            PlaybackMode::Play,
            InboxPolicy::AcceptAll,
            None,
            true,
        ))
        .expect("writer head");
    let engine = EngineBuilder::new(store, case.root).build();
    (EffectPackageHost::new(runtime, engine).expect("host"), head)
}

fn application_basis(input: &[u8]) -> EchoOperationApplicationBasisV1 {
    EchoOperationApplicationBasisV1::new(
        hash(b"echo:operation-profile:v1\0", b"echo.operation.basis.edict-effect/v1"),
        hash(b"echo:operation-edict-effect-basis:v1\0", input),
    )
}

fn invocation(
    installed: &warp_core::InstalledEchoOperation,
    head: WriterHeadKey,
    basis: warp_core::EchoOperationEvaluationBasisV1,
    package: &PackageUnderTest,
    input: &[u8],
) -> Vec<u8> {
    let app = basis.application_basis();
    let (steps, read_bytes, write_bytes) = package.delegated;
    encode(&map([
        ("schema", text("echo.operation-invocation/v1")),
        ("kind", text("edict-effect-program/v1")),
        ("package_id", bytes(installed.package_identity())),
        ("operation_coordinate", text(installed.operation_coordinate())),
        ("authority_grant_identity", bytes(AUTHORITY_GRANT)),
        (
            "delegated_budget",
            map([
                ("steps", Value::Integer(steps.into())),
                ("read_bytes", Value::Integer(read_bytes.into())),
                ("write_bytes", Value::Integer(write_bytes.into())),
            ]),
        ),
        ("application_input_bytes", Value::Bytes(input.to_vec())),
        (
            "evaluation_basis",
            map([
                ("worldline_id", bytes(head.worldline_id.as_bytes())),
                ("head_id", bytes(head.head_id.as_bytes())),
                ("worldline_tick", Value::Integer(i128::from(basis.worldline_tick().as_u64()))),
                ("commit_global_tick", Value::Null),
                ("state_root", bytes(basis.state_root())),
                ("commit_id", bytes(basis.commit_id())),
                ("application_basis_schema_identity", bytes(app.schema_identity())),
                ("application_basis_value_identity", bytes(app.value_identity())),
            ]),
        ),
    ]))
    .expect("canonical invocation")
}

/// Admits the exact package and one invocation, evaluates it over the case
/// graph, and derives the proposal when evaluation completes.
pub fn run(case: &Case, package: &PackageUnderTest) -> Observation {
    assert_eq!(
        hash(b"echo:operation-package:v1\0", &package.bytes),
        package.pin,
        "package identity"
    );
    let (mut host, head) = host(case);
    let authority = hash(b"echo:operation-profile:v1\0", package.authority_label);
    let (steps, read_bytes, write_bytes) = package.budget;
    let budget = EchoOperationBudgetV1::new(steps, read_bytes, write_bytes);
    let policy =
        EchoOperationAdmissionPolicy::exact(package.pin, package.operation, authority, budget);
    let admitted = host
        .admit_echo_operation_package(&policy, package.bytes.clone())
        .expect("the exact policy admits the package");
    let installed = host
        .install_admitted_echo_operation_package(admitted)
        .expect("installation");
    let program = installed
        .program()
        .as_effect_program()
        .expect("an effect program")
        .clone();
    let parent = host
        .echo_operation_evaluation_basis_v1(head, application_basis(&case.input))
        .expect("evaluation basis");
    let (steps, read_bytes, write_bytes) = package.delegated;
    let delegated = EchoOperationBudgetV1::new(steps, read_bytes, write_bytes);
    let admitted_invocation = host
        .admit_echo_operation_invocation(
            &EchoOperationInvocationAdmissionPolicy::new(authority, AUTHORITY_GRANT, delegated),
            &invocation(&installed, head, parent, package, &case.input),
        )
        .expect("invocation admission");
    let reads: Vec<TypedNodeRead> = case
        .typed_reads
        .iter()
        .map(|(node, absent_node_type)| TypedNodeRead {
            node: NodeKey { warp_id: case.warp, local_id: *node },
            absent_node_type: *absent_node_type,
        })
        .collect();
    let (output, completed) = {
        let mut frame = host
            .effect_evaluation_frame_v1(parent, &case.edge_types, case.max_edge_scans, delegated, package.limits)
            .expect("frame")
            .with_footprint_law(program.footprint_law().clone())
            .expect("footprint law");
        let output = frame
            .evaluate_effect(&program, &case.input, &reads)
            .map(<[u8]>::to_vec);
        let completed = output
            .is_ok()
            .then(|| frame.into_effect_evaluation(1 << 20).expect("completed evidence"));
        (output, completed)
    };
    let mutations = completed
        .as_ref()
        .map(|completed| completed.mutations().to_vec())
        .unwrap_or_default();
    let reads = completed
        .as_ref()
        .map(|completed| {
            let image = completed.read_set_image();
            let view = warp_core::edict_effects::EffectReadSetView::parse(image.as_bytes()).expect("read image");
            view.rows()
                .iter()
                .map(|row| (row.slot.class, row.slot.local_id, row.slot.edge_type))
                .collect()
        })
        .unwrap_or_default();
    let derived_ops = completed.map(|completed| {
        host.derive_echo_operation_effects(&admitted_invocation, completed)
            .map(|derived| derived.patch().ops().len())
            .map_err(|error| format!("{error:?}"))
    });
    Observation { output, mutations, reads, derived_ops }
}

/// The edge id helper the cases use for fixture edges.
pub fn edge(id: [u8; 32], from: NodeId, to: NodeId, ty: TypeId) -> EdgeRecord {
    EdgeRecord { id: EdgeId(id), from, to, ty }
}
