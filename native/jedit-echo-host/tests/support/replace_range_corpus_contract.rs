use std::collections::BTreeSet;

use jedit_echo_host::identity::hash_bytes;
use jedit_echo_host::records::EMPTY_ROOT_DIGEST_DOMAIN;
use serde::{Deserialize, Serialize};

use super::contract::{
    SemanticObstructionCode, APPLICATION_SCHEMA_COORDINATE, EVIDENCE_GRADE,
    HISTORICAL_PLANNER_CHECKPOINT_COMMIT, INDEPENDENCE_LIMIT, INVOCATION_SCHEMA_COORDINATE,
    OBSTRUCTED_PATCH_POSTURE, ORACLE_COORDINATE, ORACLE_SCHEMA_VERSION, ORACLE_WARP_LABEL,
};
use super::lexemes::{CommitSha, Hex32, HexBytes, Utf8Hex};
use super::patch_fact_contract::{validate_patch, PatchOperation};
use super::source_set::source_set;

#[path = "replace_range_corpus_result_contract.rs"]
mod result_contract;

pub(super) const NONCANONICAL_CORPUS_BYTES: &str = "oracle corpus bytes are not canonical";

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct CorpusEnvelope {
    schema_version: u32,
    coordinate: String,
    application_schema_coordinate: String,
    invocation_schema_coordinate: String,
    historical_planner_checkpoint_commit: CommitSha,
    source_set: SourceSetEnvelope,
    evidence_grade: String,
    independence_limit: String,
    warp_id: Hex32,
    cases: Vec<CorpusCase>,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct SourceSetEnvelope {
    algorithm: String,
    domain_hex: HexBytes,
    framing: String,
    paths: Vec<String>,
    digest_hex: Hex32,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct CorpusCase {
    id: String,
    purpose: String,
    basis_facts: Vec<BasisFact>,
    invocation: Invocation,
    invocation_bytes_hex: HexBytes,
    terminal: Terminal,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct BasisFact {
    node_id: Hex32,
    type_id: Hex32,
    attachment_bytes_hex: HexBytes,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Invocation {
    buffer_id: Hex32,
    basis_head_id: Hex32,
    start_byte: u64,
    end_byte: u64,
    replacement_utf8_hex: Utf8Hex,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(
    tag = "posture",
    rename_all = "kebab-case",
    rename_all_fields = "camelCase",
    deny_unknown_fields
)]
enum Terminal {
    Committable {
        footprint: Footprint,
        patch: Vec<PatchOperation>,
        created_node_ids: Vec<Hex32>,
        updated_node_ids: Vec<Hex32>,
        untouched_basis_node_ids: Vec<Hex32>,
        result: Box<ResultEvidence>,
    },
    Obstructed {
        semantic_code: SemanticObstructionCode,
        legacy_error_class: String,
        legacy_message: String,
        parent_graph_unchanged: bool,
        patch_posture: String,
    },
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Footprint {
    node_reads: Vec<Hex32>,
    node_writes: Vec<Hex32>,
    attachment_reads: Vec<Hex32>,
    attachment_writes: Vec<Hex32>,
    edge_reads: Vec<Hex32>,
    edge_writes: Vec<Hex32>,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct ResultEvidence {
    buffer_id: Hex32,
    head_id: Hex32,
    root_node_id: Option<Hex32>,
    root_digest: Hex32,
    rewrite_id: Hex32,
    diff_id: Hex32,
    byte_length: u64,
    utf16_length: u64,
    line_count: u64,
    sequence: u64,
    version: u64,
    materialized_text_utf8_hex: Utf8Hex,
}

struct CommittableEvidence<'a> {
    footprint: &'a Footprint,
    patch: &'a [PatchOperation],
    created: &'a [Hex32],
    updated: &'a [Hex32],
    untouched: &'a [Hex32],
    result: &'a ResultEvidence,
}

pub fn validate_oracle_contract(bytes: &[u8]) -> Result<(), String> {
    let corpus: CorpusEnvelope = serde_json::from_slice(bytes)
        .map_err(|error| format!("oracle corpus transport is invalid: {error}"))?;
    validate_envelope(&corpus)?;
    let mut canonical = serde_json::to_vec_pretty(&corpus)
        .map_err(|error| format!("oracle corpus canonicalization failed: {error}"))?;
    canonical.push(b'\n');
    if canonical != bytes {
        return Err(NONCANONICAL_CORPUS_BYTES.to_owned());
    }
    Ok(())
}

fn validate_envelope(corpus: &CorpusEnvelope) -> Result<(), String> {
    require_equal(
        "schemaVersion",
        corpus.schema_version,
        ORACLE_SCHEMA_VERSION,
    )?;
    require_equal("coordinate", corpus.coordinate.as_str(), ORACLE_COORDINATE)?;
    require_equal(
        "applicationSchemaCoordinate",
        corpus.application_schema_coordinate.as_str(),
        APPLICATION_SCHEMA_COORDINATE,
    )?;
    require_equal(
        "invocationSchemaCoordinate",
        corpus.invocation_schema_coordinate.as_str(),
        INVOCATION_SCHEMA_COORDINATE,
    )?;
    require_equal(
        "historicalPlannerCheckpointCommit",
        corpus.historical_planner_checkpoint_commit.as_str(),
        HISTORICAL_PLANNER_CHECKPOINT_COMMIT,
    )?;
    require_equal(
        "evidenceGrade",
        corpus.evidence_grade.as_str(),
        EVIDENCE_GRADE,
    )?;
    require_equal(
        "independenceLimit",
        corpus.independence_limit.as_str(),
        INDEPENDENCE_LIMIT,
    )?;
    let expected_warp_id = hex::encode(warp_core::make_warp_id(ORACLE_WARP_LABEL).as_bytes());
    require_equal("warpId", corpus.warp_id.as_str(), expected_warp_id.as_str())?;
    validate_source_set(&corpus.source_set)?;
    if corpus.cases.is_empty() {
        return Err("cases must not be empty".to_owned());
    }
    let mut case_ids = BTreeSet::new();
    for case in &corpus.cases {
        if case.id.is_empty() || case.purpose.is_empty() {
            return Err("case id and purpose must not be empty".to_owned());
        }
        if !case_ids.insert(case.id.as_str()) {
            return Err(format!("duplicate case id {}", case.id));
        }
        validate_case(case)?;
    }
    Ok(())
}

fn validate_source_set(claimed: &SourceSetEnvelope) -> Result<(), String> {
    let expected = source_set();
    require_equal(
        "sourceSet.algorithm",
        claimed.algorithm.as_str(),
        expected.algorithm,
    )?;
    require_equal(
        "sourceSet.domainHex",
        claimed.domain_hex.as_str(),
        expected.domain_hex.as_str(),
    )?;
    require_equal(
        "sourceSet.framing",
        claimed.framing.as_str(),
        expected.framing,
    )?;
    if claimed
        .paths
        .iter()
        .map(String::as_str)
        .ne(expected.paths.iter().copied())
    {
        return Err("sourceSet.paths differ from the generator source set".to_owned());
    }
    require_equal(
        "sourceSet.digestHex",
        claimed.digest_hex.as_str(),
        expected.digest_hex.as_str(),
    )
}

fn validate_case(case: &CorpusCase) -> Result<(), String> {
    unique_ids(
        "basisFacts.nodeId",
        case.basis_facts.iter().map(|fact| fact.node_id.as_str()),
    )?;
    let expected_invocation = serde_json::to_vec(&case.invocation)
        .map_err(|error| format!("invocation encoding failed: {error}"))?;
    require_equal(
        "invocationBytesHex",
        case.invocation_bytes_hex.bytes(),
        expected_invocation,
    )?;
    match &case.terminal {
        Terminal::Committable {
            footprint,
            patch,
            created_node_ids,
            updated_node_ids,
            untouched_basis_node_ids,
            result,
        } => validate_committable(
            case,
            CommittableEvidence {
                footprint,
                patch,
                created: created_node_ids,
                updated: updated_node_ids,
                untouched: untouched_basis_node_ids,
                result,
            },
        ),
        Terminal::Obstructed {
            semantic_code: _,
            legacy_error_class,
            legacy_message,
            parent_graph_unchanged,
            patch_posture,
        } => {
            if legacy_error_class.is_empty() || legacy_message.is_empty() {
                return Err("obstruction legacy evidence must not be empty".to_owned());
            }
            require_equal("parentGraphUnchanged", *parent_graph_unchanged, true)?;
            require_equal(
                "patchPosture",
                patch_posture.as_str(),
                OBSTRUCTED_PATCH_POSTURE,
            )
        }
    }
}

fn validate_committable(
    case: &CorpusCase,
    evidence: CommittableEvidence<'_>,
) -> Result<(), String> {
    let CommittableEvidence {
        footprint,
        patch,
        created,
        updated,
        untouched,
        result,
    } = evidence;
    let basis = unique_ids(
        "basisFacts.nodeId",
        case.basis_facts.iter().map(|fact| fact.node_id.as_str()),
    )?;
    let reads = unique_ids("footprint.nodeReads", ids(&footprint.node_reads))?;
    let writes = unique_ids("footprint.nodeWrites", ids(&footprint.node_writes))?;
    if !reads.is_subset(&basis) {
        return Err("footprint reads must identify retained basis facts".to_owned());
    }
    require_equal(
        "attachmentReads",
        unique_ids(
            "footprint.attachmentReads",
            ids(&footprint.attachment_reads),
        )?,
        reads,
    )?;
    require_equal(
        "attachmentWrites",
        unique_ids(
            "footprint.attachmentWrites",
            ids(&footprint.attachment_writes),
        )?,
        writes.clone(),
    )?;
    if !footprint.edge_reads.is_empty() || !footprint.edge_writes.is_empty() {
        return Err("ReplaceRange footprint must not contain edges".to_owned());
    }
    let created = unique_ids("createdNodeIds", ids(created))?;
    let updated = unique_ids("updatedNodeIds", ids(updated))?;
    let untouched = unique_ids("untouchedBasisNodeIds", ids(untouched))?;
    if !created.is_disjoint(&updated)
        || !created.is_disjoint(&untouched)
        || !updated.is_disjoint(&untouched)
    {
        return Err("created, updated, and untouched node sets must be disjoint".to_owned());
    }
    require_equal(
        "nodeWrites partition",
        created.union(&updated).copied().collect::<BTreeSet<_>>(),
        writes.clone(),
    )?;
    require_equal(
        "basis partition",
        updated.union(&untouched).copied().collect::<BTreeSet<_>>(),
        basis,
    )?;
    let patch = validate_patch(patch, &writes)?;
    validate_result(case, result, &writes, &updated)?;
    result_contract::validate_result_chain(case, result, &patch)
}

fn validate_result(
    case: &CorpusCase,
    result: &ResultEvidence,
    writes: &BTreeSet<&str>,
    updated: &BTreeSet<&str>,
) -> Result<(), String> {
    require_equal(
        "result.bufferId",
        result.buffer_id.as_str(),
        case.invocation.buffer_id.as_str(),
    )?;
    if !updated.contains(result.buffer_id.as_str()) {
        return Err("result Buffer must be an updated basis node".to_owned());
    }
    for (label, id) in [
        ("headId", &result.head_id),
        ("rewriteId", &result.rewrite_id),
        ("diffId", &result.diff_id),
    ] {
        if !writes.contains(id.as_str()) {
            return Err(format!("result {label} must be in the declared writes"));
        }
    }
    match &result.root_node_id {
        Some(root) => require_equal(
            "nonempty root digest",
            result.root_digest.as_str(),
            root.as_str(),
        )?,
        None => require_equal(
            "empty root digest",
            result.root_digest.as_str(),
            hex::encode(hash_bytes(EMPTY_ROOT_DIGEST_DOMAIN, &[])).as_str(),
        )?,
    }
    let text_bytes = result.materialized_text_utf8_hex.bytes();
    let text =
        std::str::from_utf8(&text_bytes).expect("Utf8Hex guarantees valid materialized UTF-8");
    require_equal(
        "result.byteLength",
        result.byte_length,
        u64::try_from(text_bytes.len()).map_err(|_| "materialized text exceeds u64")?,
    )?;
    require_equal(
        "result.utf16Length",
        result.utf16_length,
        u64::try_from(text.encode_utf16().count()).map_err(|_| "UTF-16 length exceeds u64")?,
    )?;
    require_equal(
        "result.lineCount",
        result.line_count,
        u64::try_from(text.bytes().filter(|byte| *byte == b'\n').count())
            .map_err(|_| "line count exceeds u64")?
            + 1,
    )?;
    if result.sequence == 0 || result.version == 0 {
        return Err("committable result sequence and version must advance".to_owned());
    }
    Ok(())
}

fn ids(values: &[Hex32]) -> impl Iterator<Item = &str> {
    values.iter().map(Hex32::as_str)
}

fn unique_ids<'a>(
    label: &str,
    values: impl IntoIterator<Item = &'a str>,
) -> Result<BTreeSet<&'a str>, String> {
    let mut unique = BTreeSet::new();
    for value in values {
        if !unique.insert(value) {
            return Err(format!("{label} contains duplicate {value}"));
        }
    }
    Ok(unique)
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
