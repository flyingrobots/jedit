use jedit_echo_host::records::{BufferFact, DiffFact, HeadFact, NodeIdBytes, RewriteFact};

use super::super::lexemes::Hex32;
use super::super::patch_fact_contract::{
    decode_buffer_fact, decode_content_fact, validate_fact, ValidatedPatch,
};
use super::{require_equal, BasisFact, CorpusCase, ResultEvidence};

pub(super) fn validate_result_chain(
    case: &CorpusCase,
    result: &ResultEvidence,
    patch: &ValidatedPatch<'_>,
) -> Result<(), String> {
    require_result_roles(patch)?;
    validate_basis_facts(case)?;
    let basis_buffer = basis_buffer(case)?;
    let basis_head = basis_head(case)?;
    validate_basis(case, &basis_buffer, &basis_head)?;

    let buffer = patch.buffer("result Buffer fact", &result.buffer_id)?;
    let head = patch.content::<HeadFact>("result Head fact", &result.head_id)?;
    let rewrite = patch.content::<RewriteFact>("result Rewrite fact", &result.rewrite_id)?;
    let diff = patch.content::<DiffFact>("result Diff fact", &result.diff_id)?;
    validate_buffer(result, &basis_buffer, &buffer)?;
    validate_head(case, result, &basis_head, &head)?;
    validate_rewrite(case, result, &rewrite)?;
    validate_diff(case, result, &diff)?;
    validate_byte_length(case, result, &basis_head)
}

fn validate_basis_facts(case: &CorpusCase) -> Result<(), String> {
    for fact in &case.basis_facts {
        validate_fact(
            &format!("basis fact {}", fact.node_id.as_str()),
            fact.node_id.as_str(),
            fact.type_id.as_str(),
            &fact.attachment_bytes_hex,
        )?;
    }
    Ok(())
}

fn require_result_roles(patch: &ValidatedPatch<'_>) -> Result<(), String> {
    patch.require_singleton::<BufferFact>("result Buffer fact")?;
    patch.require_singleton::<HeadFact>("result Head fact")?;
    patch.require_singleton::<RewriteFact>("result Rewrite fact")?;
    patch.require_singleton::<DiffFact>("result Diff fact")
}

fn basis_buffer(case: &CorpusCase) -> Result<BufferFact, String> {
    let fact = basis_fact(case, "basis Buffer fact", &case.invocation.buffer_id)?;
    decode_buffer_fact(
        "basis Buffer fact",
        fact.node_id.as_str(),
        fact.type_id.as_str(),
        &fact.attachment_bytes_hex,
    )
}

fn basis_head(case: &CorpusCase) -> Result<HeadFact, String> {
    let fact = basis_fact(case, "basis Head fact", &case.invocation.basis_head_id)?;
    decode_content_fact::<HeadFact>(
        "basis Head fact",
        fact.node_id.as_str(),
        fact.type_id.as_str(),
        &fact.attachment_bytes_hex,
    )
}

fn basis_fact<'a>(
    case: &'a CorpusCase,
    label: &str,
    node_id: &Hex32,
) -> Result<&'a BasisFact, String> {
    case.basis_facts
        .iter()
        .find(|fact| fact.node_id == *node_id)
        .ok_or_else(|| format!("{label} is absent from basisFacts"))
}

fn validate_basis(case: &CorpusCase, buffer: &BufferFact, head: &HeadFact) -> Result<(), String> {
    require_id(
        "basis Buffer canonical Head",
        buffer.canonical_head_id,
        &case.invocation.basis_head_id,
    )?;
    require_id(
        "basis Head Buffer",
        head.buffer_id,
        &case.invocation.buffer_id,
    )
}

fn validate_buffer(
    result: &ResultEvidence,
    basis: &BufferFact,
    current: &BufferFact,
) -> Result<(), String> {
    require_equal(
        "result Buffer key",
        current.buffer_key.as_str(),
        basis.buffer_key.as_str(),
    )?;
    require_equal(
        "result Buffer projection path",
        &current.projection_path,
        &basis.projection_path,
    )?;
    require_id(
        "result Buffer canonical Head",
        current.canonical_head_id,
        &result.head_id,
    )?;
    require_equal("result Buffer version", current.version, result.version)?;
    let expected = basis
        .version
        .checked_add(1)
        .ok_or_else(|| "basis Buffer version overflows u64".to_owned())?;
    require_equal(
        "result Buffer version advancement",
        current.version,
        expected,
    )
}

fn validate_head(
    case: &CorpusCase,
    result: &ResultEvidence,
    basis: &HeadFact,
    current: &HeadFact,
) -> Result<(), String> {
    require_id("result Head Buffer", current.buffer_id, &result.buffer_id)?;
    require_optional_id(
        "result Head basis",
        current.basis_head_id,
        Some(&case.invocation.basis_head_id),
    )?;
    require_optional_id(
        "result Head root node",
        current.root_node_id,
        result.root_node_id.as_ref(),
    )?;
    require_equal(
        "result Head root digest",
        hex::encode(current.root_digest),
        result.root_digest.as_str().to_owned(),
    )?;
    for (label, actual, expected) in [
        (
            "result Head byte length",
            current.byte_length,
            result.byte_length,
        ),
        (
            "result Head UTF-16 length",
            current.utf16_length,
            result.utf16_length,
        ),
        (
            "result Head line count",
            current.line_count,
            result.line_count,
        ),
        ("result Head sequence", current.sequence, result.sequence),
    ] {
        require_equal(label, actual, expected)?;
    }
    let expected = basis
        .sequence
        .checked_add(1)
        .ok_or_else(|| "basis Head sequence overflows u64".to_owned())?;
    require_equal(
        "result Head sequence advancement",
        current.sequence,
        expected,
    )
}

fn validate_rewrite(
    case: &CorpusCase,
    result: &ResultEvidence,
    rewrite: &RewriteFact,
) -> Result<(), String> {
    require_id("Rewrite Buffer", rewrite.buffer_id, &result.buffer_id)?;
    require_id(
        "Rewrite basis Head",
        rewrite.basis_head_id,
        &case.invocation.basis_head_id,
    )?;
    require_id("Rewrite next Head", rewrite.next_head_id, &result.head_id)?;
    require_equal(
        "Rewrite start byte",
        rewrite.start_byte,
        case.invocation.start_byte,
    )?;
    require_equal(
        "Rewrite end byte",
        rewrite.end_byte,
        case.invocation.end_byte,
    )?;
    require_equal(
        "Rewrite inserted byte length",
        rewrite.inserted_byte_length,
        replacement_byte_length(case)?,
    )
}

fn validate_diff(
    case: &CorpusCase,
    result: &ResultEvidence,
    diff: &DiffFact,
) -> Result<(), String> {
    require_id("Diff Rewrite", diff.rewrite_id, &result.rewrite_id)?;
    require_id(
        "Diff basis Head",
        diff.basis_head_id,
        &case.invocation.basis_head_id,
    )?;
    require_id("Diff next Head", diff.next_head_id, &result.head_id)?;
    require_equal(
        "Diff start byte",
        diff.start_byte,
        case.invocation.start_byte,
    )?;
    require_equal("Diff end byte", diff.end_byte, case.invocation.end_byte)?;
    require_equal(
        "Diff inserted byte length",
        diff.inserted_byte_length,
        replacement_byte_length(case)?,
    )?;
    require_equal(
        "Diff deleted byte length",
        diff.deleted_byte_length,
        deleted_byte_length(case)?,
    )
}

fn validate_byte_length(
    case: &CorpusCase,
    result: &ResultEvidence,
    basis: &HeadFact,
) -> Result<(), String> {
    let expected = checked_result_byte_length(
        basis.byte_length,
        case.invocation.start_byte,
        case.invocation.end_byte,
        replacement_byte_length(case)?,
    )?;
    require_equal(
        "result byte length transition",
        result.byte_length,
        expected,
    )
}

fn checked_result_byte_length(
    basis_byte_length: u64,
    start_byte: u64,
    end_byte: u64,
    replacement_byte_length: u64,
) -> Result<u64, String> {
    let deleted_byte_length = end_byte
        .checked_sub(start_byte)
        .ok_or_else(|| "invocation range is reversed".to_owned())?;
    if end_byte > basis_byte_length {
        return Err("invocation range exceeds basis Head byte length".to_owned());
    }
    let after_delete = basis_byte_length
        .checked_sub(deleted_byte_length)
        .ok_or_else(|| "deleted range exceeds basis Head byte length".to_owned())?;
    after_delete
        .checked_add(replacement_byte_length)
        .ok_or_else(|| "result byte length overflows u64".to_owned())
}

fn replacement_byte_length(case: &CorpusCase) -> Result<u64, String> {
    u64::try_from(case.invocation.replacement_utf8_hex.bytes().len())
        .map_err(|_| "replacement byte length exceeds u64".to_owned())
}

fn deleted_byte_length(case: &CorpusCase) -> Result<u64, String> {
    case.invocation
        .end_byte
        .checked_sub(case.invocation.start_byte)
        .ok_or_else(|| "invocation range is reversed".to_owned())
}

fn require_id(label: &str, actual: NodeIdBytes, expected: &Hex32) -> Result<(), String> {
    require_equal(label, hex::encode(actual.0), expected.as_str().to_owned())
}

fn require_optional_id(
    label: &str,
    actual: Option<NodeIdBytes>,
    expected: Option<&Hex32>,
) -> Result<(), String> {
    require_equal(
        label,
        actual.map(|id| hex::encode(id.0)),
        expected.map(|id| id.as_str().to_owned()),
    )
}

#[cfg(test)]
mod tests {
    use super::checked_result_byte_length;

    #[test]
    fn byte_length_transition_rejects_a_range_beyond_the_basis() {
        let error = checked_result_byte_length(4, 10, 11, 0)
            .expect_err("a range beyond the basis must be refused");
        assert_eq!(error, "invocation range exceeds basis Head byte length");
    }
}
