use std::collections::BTreeSet;

use jedit_echo_host::error::HostError;
use jedit_echo_host::identity::hash_bytes;
use jedit_echo_host::records::{
    decode_fact, fact_bytes, fact_id, fact_type_id, BufferFact, DiffFact, HeadFact, RewriteFact,
    EMPTY_ROOT_DIGEST_DOMAIN,
};
use jedit_echo_host::rope::{plan_replace, read_window, MutationPlan};
use serde::Serialize;
use warp_core::{
    make_warp_id, AttachmentOwner, AttachmentPlane, AttachmentValue, Footprint, GraphStore, NodeId,
    TickDelta, TypeId, WarpOp,
};

#[path = "replace_range_basis.rs"]
mod basis;
#[path = "replace_range_contract.rs"]
mod contract;
#[path = "replace_range_source_set.rs"]
mod source_set;

pub use basis::BasisSetup;
use basis::{apply_ops, make_basis};
pub use contract::SemanticObstructionCode;
use source_set::{source_set, SourceSet};

const ORACLE_WARP_LABEL: &str = "jedit.replace-range.oracle.v1";
const SEMANTIC_BASELINE_COMMIT: &str = "c70e12d73b4b00bc92412bab67e1761f7dd22f82";

#[derive(Clone, Copy)]
pub enum ExpectedPosture {
    Success,
    Obstruction {
        semantic_code: SemanticObstructionCode,
        error_class: &'static str,
        message_fragment: &'static str,
    },
}

pub struct CaseSpec {
    pub id: &'static str,
    pub purpose: &'static str,
    pub initial_text: String,
    pub setup: BasisSetup,
    pub start_byte: u64,
    pub end_byte: u64,
    pub replacement: String,
    pub expected: ExpectedPosture,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OracleCorpus {
    schema_version: u32,
    coordinate: &'static str,
    application_schema_coordinate: &'static str,
    invocation_schema_coordinate: &'static str,
    semantic_baseline_commit: &'static str,
    source_set: SourceSet,
    evidence_grade: &'static str,
    independence_limit: &'static str,
    warp_id: String,
    cases: Vec<OracleCase>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct OracleCase {
    id: &'static str,
    purpose: &'static str,
    basis_facts: Vec<FactProjection>,
    invocation: InvocationProjection,
    invocation_bytes_hex: String,
    terminal: TerminalProjection,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
struct FactProjection {
    node_id: String,
    type_id: String,
    attachment_bytes_hex: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct InvocationProjection {
    buffer_id: String,
    basis_head_id: String,
    start_byte: u64,
    end_byte: u64,
    replacement_utf8_hex: String,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
#[serde(
    tag = "posture",
    rename_all = "kebab-case",
    rename_all_fields = "camelCase"
)]
enum TerminalProjection {
    Committable {
        footprint: FootprintProjection,
        patch: Vec<PatchOpProjection>,
        created_node_ids: Vec<String>,
        updated_node_ids: Vec<String>,
        untouched_basis_node_ids: Vec<String>,
        result: Box<ResultProjection>,
    },
    Obstructed {
        semantic_code: SemanticObstructionCode,
        legacy_error_class: &'static str,
        legacy_message: String,
        parent_graph_unchanged: bool,
        patch_posture: &'static str,
    },
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
struct FootprintProjection {
    node_reads: Vec<String>,
    node_writes: Vec<String>,
    attachment_reads: Vec<String>,
    attachment_writes: Vec<String>,
    edge_reads: Vec<String>,
    edge_writes: Vec<String>,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
#[serde(
    tag = "kind",
    rename_all = "kebab-case",
    rename_all_fields = "camelCase"
)]
enum PatchOpProjection {
    UpsertNode {
        node_id: String,
        type_id: String,
    },
    SetNodeAlpha {
        node_id: String,
        type_id: String,
        attachment_bytes_hex: String,
    },
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
struct ResultProjection {
    buffer_id: String,
    head_id: String,
    root_node_id: Option<String>,
    root_digest: String,
    rewrite_id: String,
    diff_id: String,
    byte_length: u64,
    utf16_length: u64,
    line_count: u64,
    sequence: u64,
    version: u64,
    materialized_text_utf8_hex: String,
}

#[derive(Debug)]
struct ValidatedConsequence {
    buffer: BufferFact,
    head: HeadFact,
    rewrite_id: NodeId,
    diff_id: NodeId,
    materialized_text: String,
}

pub fn generate_corpus(specs: Vec<CaseSpec>) -> OracleCorpus {
    let warp_id = make_warp_id(ORACLE_WARP_LABEL);
    let cases = specs
        .into_iter()
        .map(|spec| evaluate_case(warp_id, spec))
        .collect();
    OracleCorpus {
        schema_version: 1,
        coordinate: "jedit.text.ReplaceRange.oracle@1",
        application_schema_coordinate: "jedit.text.schema@1",
        invocation_schema_coordinate: "jedit.text.ReplaceRange.oracle-invocation@1",
        semantic_baseline_commit: SEMANTIC_BASELINE_COMMIT,
        source_set: source_set(),
        evidence_grade: "deterministic-self-validation",
        independence_limit: "independent finite-corpus evidence begins only when a separately implemented Echo evaluator agrees",
        warp_id: hex::encode(warp_id.as_bytes()),
        cases,
    }
}

pub fn canonical_corpus_bytes(corpus: &OracleCorpus) -> Vec<u8> {
    let mut bytes = serde_json::to_vec_pretty(corpus).expect("oracle corpus should encode");
    bytes.push(b'\n');
    bytes
}

fn evaluate_case(warp_id: warp_core::WarpId, spec: CaseSpec) -> OracleCase {
    let (store, buffer_id, canonical_head_id, invocation_basis_id) =
        make_basis(warp_id, spec.id, &spec.initial_text, spec.setup);
    let basis_facts = project_store(&store);
    let basis_head_id = invocation_basis_id.unwrap_or(canonical_head_id);
    let invocation = InvocationProjection {
        buffer_id: hex::encode(buffer_id.as_bytes()),
        basis_head_id: hex::encode(basis_head_id.as_bytes()),
        start_byte: spec.start_byte,
        end_byte: spec.end_byte,
        replacement_utf8_hex: hex::encode(spec.replacement.as_bytes()),
    };
    let invocation_bytes_hex = hex::encode(
        serde_json::to_vec(&invocation).expect("oracle invocation should encode canonically"),
    );
    let before = project_store(&store);
    let first = plan_replace(
        &store,
        buffer_id,
        basis_head_id,
        spec.start_byte,
        spec.end_byte,
        &spec.replacement,
    );
    let after_evaluation = project_store(&store);
    assert_eq!(before, after_evaluation, "{} mutated its basis", spec.id);
    let terminal = match (first, spec.expected) {
        (Ok(plan), ExpectedPosture::Success) => success_projection(&store, &plan, &spec),
        (
            Err(error),
            ExpectedPosture::Obstruction {
                semantic_code,
                error_class,
                message_fragment,
            },
        ) => {
            let (actual_class, actual_message) = error_projection(&error);
            assert_eq!(actual_class, error_class, "{} error class", spec.id);
            assert!(
                actual_message.contains(message_fragment),
                "{} error message {actual_message:?} did not contain {message_fragment:?}",
                spec.id
            );
            TerminalProjection::Obstructed {
                semantic_code,
                legacy_error_class: error_class,
                legacy_message: actual_message,
                parent_graph_unchanged: before == project_store(&store),
                patch_posture: "no-mutation-plan",
            }
        }
        (Ok(_), ExpectedPosture::Obstruction { .. }) => {
            panic!("{} unexpectedly produced a mutation plan", spec.id)
        }
        (Err(error), ExpectedPosture::Success) => {
            panic!("{} unexpectedly obstructed: {error}", spec.id)
        }
    };
    OracleCase {
        id: spec.id,
        purpose: spec.purpose,
        basis_facts,
        invocation,
        invocation_bytes_hex,
        terminal,
    }
}

fn success_projection(
    store: &GraphStore,
    plan: &MutationPlan,
    spec: &CaseSpec,
) -> TerminalProjection {
    let buffer: BufferFact = decode_fact(
        store
            .node_attachment(&plan.buffer_id)
            .expect("buffer attachment should exist"),
    )
    .expect("buffer should decode");
    let second = plan_replace(
        store,
        plan.buffer_id,
        NodeId::from(buffer.canonical_head_id),
        spec.start_byte,
        spec.end_byte,
        &spec.replacement,
    )
    .expect("deterministic rerun should plan");
    let first_plan = project_plan(plan, store.warp_id());
    let second_plan = project_plan(&second, store.warp_id());
    assert_eq!(first_plan, second_plan, "{} rerun drifted", spec.id);

    let basis_ids: BTreeSet<_> = store
        .iter_nodes()
        .map(|(id, _)| hex::encode(id.as_bytes()))
        .collect();
    let mut next = store.clone();
    apply_ops(&mut next, &first_plan.1);
    let retained = validate_consequence(
        store,
        &next,
        plan,
        NodeId::from(buffer.canonical_head_id),
        spec.start_byte,
        spec.end_byte,
        &spec.replacement,
    )
    .unwrap_or_else(|error| panic!("{} retained consequence: {error}", spec.id));
    let write_ids: BTreeSet<_> = first_plan.0.node_writes.iter().cloned().collect();
    let created_node_ids = write_ids.difference(&basis_ids).cloned().collect();
    let updated_node_ids = write_ids.intersection(&basis_ids).cloned().collect();
    let untouched_basis_node_ids = basis_ids.difference(&write_ids).cloned().collect();
    TerminalProjection::Committable {
        footprint: first_plan.0,
        patch: first_plan
            .1
            .iter()
            .map(|operation| project_op(operation, store.warp_id()))
            .collect::<Vec<_>>(),
        created_node_ids,
        updated_node_ids,
        untouched_basis_node_ids,
        result: Box::new(ResultProjection {
            buffer_id: hex::encode(plan.buffer_id.as_bytes()),
            head_id: hex::encode(plan.head_id.as_bytes()),
            root_node_id: retained.head.root_node_id.map(|id| hex::encode(id.0)),
            root_digest: hex::encode(retained.head.root_digest),
            rewrite_id: hex::encode(retained.rewrite_id.as_bytes()),
            diff_id: hex::encode(retained.diff_id.as_bytes()),
            byte_length: retained.head.byte_length,
            utf16_length: retained.head.utf16_length,
            line_count: retained.head.line_count,
            sequence: retained.head.sequence,
            version: retained.buffer.version,
            materialized_text_utf8_hex: hex::encode(retained.materialized_text.as_bytes()),
        }),
    }
}

fn node_with_type(store: &GraphStore, type_id: TypeId) -> Result<NodeId, String> {
    let matches: Vec<_> = store
        .iter_nodes()
        .filter_map(|(node_id, record)| (record.ty == type_id).then_some(node_id))
        .collect();
    let [node_id] = matches.as_slice() else {
        return Err(format!(
            "expected exactly one fact of type {}, received {}",
            hex::encode(type_id.as_bytes()),
            matches.len()
        ));
    };
    Ok(**node_id)
}

fn validate_consequence(
    basis: &GraphStore,
    next: &GraphStore,
    plan: &MutationPlan,
    basis_head_id: NodeId,
    start_byte: u64,
    end_byte: u64,
    replacement: &str,
) -> Result<ValidatedConsequence, String> {
    let basis_buffer: BufferFact = read_fact(basis, plan.buffer_id)?;
    require_equal(
        "basis Buffer canonical head",
        NodeId::from(basis_buffer.canonical_head_id),
        basis_head_id,
    )?;
    let basis_head: HeadFact = read_fact(basis, basis_head_id)?;
    let buffer: BufferFact = read_fact(next, plan.buffer_id)?;
    require_equal(
        "result Buffer canonical head",
        NodeId::from(buffer.canonical_head_id),
        plan.head_id,
    )?;
    require_equal(
        "result Buffer key",
        &buffer.buffer_key,
        &basis_buffer.buffer_key,
    )?;
    require_equal(
        "result Buffer projection path",
        &buffer.projection_path,
        &basis_buffer.projection_path,
    )?;
    let expected_version = basis_buffer
        .version
        .checked_add(1)
        .ok_or_else(|| "basis Buffer version overflowed during validation".to_owned())?;
    require_equal("result Buffer version", buffer.version, expected_version)?;
    require_equal("plan Buffer version", plan.version, buffer.version)?;

    let head: HeadFact = read_fact(next, plan.head_id)?;
    require_equal(
        "result Head identity",
        fact_id(&head).map_err(host_error)?,
        plan.head_id,
    )?;
    require_equal(
        "result Head buffer",
        NodeId::from(head.buffer_id),
        plan.buffer_id,
    )?;
    require_equal(
        "result Head basis",
        head.basis_head_id.map(NodeId::from),
        Some(basis_head_id),
    )?;
    require_equal(
        "result Head byte length",
        head.byte_length,
        plan.byte_length,
    )?;
    require_equal("result Head line count", head.line_count, plan.line_count)?;
    let expected_sequence = basis_head
        .sequence
        .checked_add(1)
        .ok_or_else(|| "basis Head sequence overflowed during validation".to_owned())?;
    require_equal("result Head sequence", head.sequence, expected_sequence)?;
    let expected_root_digest = head
        .root_node_id
        .map_or_else(|| hash_bytes(EMPTY_ROOT_DIGEST_DOMAIN, &[]), |id| id.0);
    require_equal(
        "result Head root digest",
        head.root_digest,
        expected_root_digest,
    )?;

    let inserted_byte_length = u64::try_from(replacement.len())
        .map_err(|_| "replacement length exceeds u64".to_owned())?;
    let deleted_byte_length = end_byte
        .checked_sub(start_byte)
        .ok_or_else(|| "validated range is reversed".to_owned())?;
    let rewrite_id = node_with_type(next, fact_type_id::<RewriteFact>())?;
    let rewrite: RewriteFact = read_fact(next, rewrite_id)?;
    require_equal(
        "Rewrite identity",
        fact_id(&rewrite).map_err(host_error)?,
        rewrite_id,
    )?;
    require_equal(
        "Rewrite buffer",
        NodeId::from(rewrite.buffer_id),
        plan.buffer_id,
    )?;
    require_equal(
        "Rewrite basis",
        NodeId::from(rewrite.basis_head_id),
        basis_head_id,
    )?;
    require_equal(
        "Rewrite next head",
        NodeId::from(rewrite.next_head_id),
        plan.head_id,
    )?;
    require_equal("Rewrite start", rewrite.start_byte, start_byte)?;
    require_equal("Rewrite end", rewrite.end_byte, end_byte)?;
    require_equal(
        "Rewrite inserted length",
        rewrite.inserted_byte_length,
        inserted_byte_length,
    )?;

    let diff_id = node_with_type(next, fact_type_id::<DiffFact>())?;
    let diff: DiffFact = read_fact(next, diff_id)?;
    require_equal(
        "Diff identity",
        fact_id(&diff).map_err(host_error)?,
        diff_id,
    )?;
    require_equal("Diff rewrite", NodeId::from(diff.rewrite_id), rewrite_id)?;
    require_equal(
        "Diff basis",
        NodeId::from(diff.basis_head_id),
        basis_head_id,
    )?;
    require_equal(
        "Diff next head",
        NodeId::from(diff.next_head_id),
        plan.head_id,
    )?;
    require_equal("Diff start", diff.start_byte, start_byte)?;
    require_equal("Diff end", diff.end_byte, end_byte)?;
    require_equal(
        "Diff inserted length",
        diff.inserted_byte_length,
        inserted_byte_length,
    )?;
    require_equal(
        "Diff deleted length",
        diff.deleted_byte_length,
        deleted_byte_length,
    )?;

    let window = read_window(
        next,
        plan.buffer_id,
        plan.head_id,
        0,
        head.byte_length,
        head.byte_length,
    )
    .map_err(host_error)?;
    let materialized_text = window.text;
    require_equal(
        "result Head UTF-16 length",
        head.utf16_length,
        materialized_text.encode_utf16().count() as u64,
    )?;
    require_equal(
        "result Head materialized line count",
        head.line_count,
        materialized_text
            .bytes()
            .filter(|byte| *byte == b'\n')
            .count() as u64
            + 1,
    )?;

    Ok(ValidatedConsequence {
        buffer,
        head,
        rewrite_id,
        diff_id,
        materialized_text,
    })
}

fn read_fact<F: jedit_echo_host::records::TypedFact>(
    store: &GraphStore,
    node_id: NodeId,
) -> Result<F, String> {
    let attachment = store
        .node_attachment(&node_id)
        .ok_or_else(|| format!("missing retained fact {}", hex::encode(node_id.as_bytes())))?;
    decode_fact(attachment).map_err(host_error)
}

fn require_equal<T: std::fmt::Debug + PartialEq>(
    label: &str,
    actual: T,
    expected: T,
) -> Result<(), String> {
    if actual != expected {
        return Err(format!(
            "{label} differs: expected {expected:?}, received {actual:?}"
        ));
    }
    Ok(())
}

fn host_error(error: HostError) -> String {
    error.to_string()
}

fn project_plan(
    plan: &MutationPlan,
    warp_id: warp_core::WarpId,
) -> (FootprintProjection, Vec<WarpOp>) {
    let mut footprint = Footprint::default();
    plan.extend_footprint(&mut footprint);
    let mut delta = TickDelta::new();
    plan.emit(&mut delta);
    (project_footprint(&footprint, warp_id), delta.finalize())
}

fn project_footprint(footprint: &Footprint, warp_id: warp_core::WarpId) -> FootprintProjection {
    FootprintProjection {
        node_reads: footprint
            .n_read
            .iter()
            .map(|key| node_hex(key, warp_id))
            .collect(),
        node_writes: footprint
            .n_write
            .iter()
            .map(|key| node_hex(key, warp_id))
            .collect(),
        attachment_reads: footprint
            .a_read
            .iter()
            .map(|key| attachment_node_hex(key, warp_id))
            .collect(),
        attachment_writes: footprint
            .a_write
            .iter()
            .map(|key| attachment_node_hex(key, warp_id))
            .collect(),
        edge_reads: footprint
            .e_read
            .iter()
            .map(|key| edge_hex(key, warp_id))
            .collect(),
        edge_writes: footprint
            .e_write
            .iter()
            .map(|key| edge_hex(key, warp_id))
            .collect(),
    }
}

fn node_hex(key: &warp_core::NodeKey, warp_id: warp_core::WarpId) -> String {
    assert_eq!(
        key.warp_id, warp_id,
        "oracle footprint WARP must match the corpus WARP"
    );
    hex::encode(key.local_id.as_bytes())
}

fn edge_hex(key: &warp_core::EdgeKey, warp_id: warp_core::WarpId) -> String {
    assert_eq!(
        key.warp_id, warp_id,
        "oracle footprint WARP must match the corpus WARP"
    );
    hex::encode(key.local_id.as_bytes())
}

fn attachment_node_hex(key: &warp_core::AttachmentKey, warp_id: warp_core::WarpId) -> String {
    assert_eq!(key.plane, AttachmentPlane::Alpha);
    let AttachmentOwner::Node(node) = key.owner else {
        panic!("ReplaceRange footprint must not contain edge attachments")
    };
    node_hex(&node, warp_id)
}

fn project_store(store: &GraphStore) -> Vec<FactProjection> {
    store
        .iter_nodes()
        .map(|(node_id, record)| {
            let AttachmentValue::Atom(atom) = store
                .node_attachment(node_id)
                .expect("every oracle fact should have an atom attachment")
            else {
                panic!("oracle facts must not use descended attachments")
            };
            assert_eq!(record.ty, atom.type_id);
            FactProjection {
                node_id: hex::encode(node_id.as_bytes()),
                type_id: hex::encode(record.ty.as_bytes()),
                attachment_bytes_hex: hex::encode(&atom.bytes),
            }
        })
        .collect()
}

fn project_op(op: &WarpOp, warp_id: warp_core::WarpId) -> PatchOpProjection {
    match op {
        WarpOp::UpsertNode { node, record } => PatchOpProjection::UpsertNode {
            node_id: node_hex(node, warp_id),
            type_id: hex::encode(record.ty.as_bytes()),
        },
        WarpOp::SetAttachment { key, value } => {
            let node_id = attachment_node_hex(key, warp_id);
            let Some(AttachmentValue::Atom(atom)) = value else {
                panic!("ReplaceRange must set atom attachments")
            };
            PatchOpProjection::SetNodeAlpha {
                node_id,
                type_id: hex::encode(atom.type_id.as_bytes()),
                attachment_bytes_hex: hex::encode(&atom.bytes),
            }
        }
        _ => panic!("ReplaceRange emitted an unsupported graph operation"),
    }
}

fn error_projection(error: &HostError) -> (&'static str, String) {
    match error {
        HostError::MissingFact(message) => ("missing-fact", message.clone()),
        HostError::MalformedFact(message) => ("malformed-fact", message.clone()),
        HostError::InvalidRequest(message) => ("invalid-request", message.clone()),
        other => panic!("oracle received unexpected host error: {other}"),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    #[should_panic(expected = "oracle footprint WARP must match the corpus WARP")]
    fn footprint_projection_rejects_a_foreign_node_read() {
        let expected = make_warp_id("oracle-local");
        let mut footprint = Footprint::default();
        footprint
            .n_read
            .insert_with_warp(make_warp_id("oracle-foreign"), NodeId([0xA5; 32]));

        project_footprint(&footprint, expected);
    }

    #[test]
    #[should_panic(expected = "oracle footprint WARP must match the corpus WARP")]
    fn footprint_projection_rejects_a_foreign_attachment_write() {
        let expected = make_warp_id("oracle-local");
        let mut footprint = Footprint::default();
        footprint
            .a_write
            .insert(warp_core::AttachmentKey::node_alpha(warp_core::NodeKey {
                warp_id: make_warp_id("oracle-foreign"),
                local_id: NodeId([0xA5; 32]),
            }));

        project_footprint(&footprint, expected);
    }

    #[test]
    #[should_panic(expected = "oracle footprint WARP must match the corpus WARP")]
    fn patch_projection_rejects_a_foreign_node_write() {
        let expected = make_warp_id("oracle-local");
        let operation = WarpOp::UpsertNode {
            node: warp_core::NodeKey {
                warp_id: make_warp_id("oracle-foreign"),
                local_id: NodeId([0xA5; 32]),
            },
            record: warp_core::NodeRecord {
                ty: warp_core::make_type_id("oracle.foreign"),
            },
        };

        project_op(&operation, expected);
    }

    #[test]
    fn retained_consequence_is_internally_consistent() {
        let warp_id = make_warp_id("oracle-consistency");
        let (basis, buffer_id, basis_head_id, _) =
            make_basis(warp_id, "consistent", "abc", BasisSetup::Plain);
        let plan = plan_replace(&basis, buffer_id, basis_head_id, 1, 2, "XY")
            .expect("replacement should plan");
        let mut delta = TickDelta::new();
        plan.emit(&mut delta);
        let mut next = basis.clone();
        apply_ops(&mut next, &delta.finalize());

        validate_consequence(&basis, &next, &plan, basis_head_id, 1, 2, "XY")
            .expect("retained consequence should be internally consistent");
    }

    #[test]
    fn retained_consequence_rejects_a_buffer_head_mismatch() {
        let warp_id = make_warp_id("oracle-inconsistent");
        let (basis, buffer_id, basis_head_id, _) =
            make_basis(warp_id, "inconsistent", "abc", BasisSetup::Plain);
        let plan = plan_replace(&basis, buffer_id, basis_head_id, 1, 2, "XY")
            .expect("replacement should plan");
        let mut delta = TickDelta::new();
        plan.emit(&mut delta);
        let mut next = basis.clone();
        apply_ops(&mut next, &delta.finalize());
        let mut buffer: BufferFact = read_fact(&next, buffer_id).expect("Buffer should decode");
        buffer.canonical_head_id = basis_head_id.into();
        next.set_node_attachment(
            buffer_id,
            Some(AttachmentValue::Atom(warp_core::AtomPayload::new(
                fact_type_id::<BufferFact>(),
                fact_bytes(&buffer).expect("Buffer should encode").into(),
            ))),
        );

        let error = validate_consequence(&basis, &next, &plan, basis_head_id, 1, 2, "XY")
            .expect_err("inconsistent retained consequence should fail");
        assert!(error.contains("result Buffer canonical head"));
    }
}
