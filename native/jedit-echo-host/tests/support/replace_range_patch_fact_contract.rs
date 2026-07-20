use std::collections::{BTreeMap, BTreeSet};

use jedit_echo_host::identity::parse_node_id;
use jedit_echo_host::records::{
    fact_bytes, fact_id, fact_type_id, BlobFact, BranchFact, BufferFact, ContentAddressedFact,
    DiffFact, HeadFact, LeafFact, RewriteFact, TypedFact,
};
use jedit_echo_host::rope::buffer_node_id;
use serde::{Deserialize, Serialize};
use warp_core::NodeId;

use super::lexemes::{Hex32, HexBytes};

#[derive(Debug, Deserialize, Serialize)]
#[serde(
    tag = "kind",
    rename_all = "kebab-case",
    rename_all_fields = "camelCase",
    deny_unknown_fields
)]
pub(super) enum PatchOperation {
    UpsertNode {
        node_id: Hex32,
        type_id: Hex32,
    },
    SetNodeAlpha {
        node_id: Hex32,
        type_id: Hex32,
        attachment_bytes_hex: HexBytes,
    },
}

pub(super) fn validate_patch(
    patch: &[PatchOperation],
    writes: &BTreeSet<&str>,
) -> Result<(), String> {
    let mut upserts = BTreeMap::new();
    let mut attachments = BTreeMap::new();
    for operation in patch {
        match operation {
            PatchOperation::UpsertNode { node_id, type_id } => {
                insert_unique(&mut upserts, node_id.as_str(), type_id.as_str())?;
            }
            PatchOperation::SetNodeAlpha {
                node_id,
                type_id,
                attachment_bytes_hex,
            } => {
                insert_unique(
                    &mut attachments,
                    node_id.as_str(),
                    (type_id.as_str(), attachment_bytes_hex),
                )?;
            }
        }
    }
    require_targets("patch upsert targets", upserts.keys(), writes)?;
    require_targets("patch attachment targets", attachments.keys(), writes)?;
    for (node_id, upsert_type) in upserts {
        let (atom_type, attachment_bytes) = attachments
            .get(node_id)
            .copied()
            .expect("attachment target equality was already checked");
        if upsert_type != atom_type {
            return Err(format!(
                "patch node and atom type differ for {node_id}: {upsert_type} != {atom_type}"
            ));
        }
        validate_patch_fact(node_id, upsert_type, attachment_bytes)?;
    }
    Ok(())
}

fn validate_patch_fact(
    node_id: &str,
    type_id: &str,
    attachment_bytes: &HexBytes,
) -> Result<(), String> {
    if type_id == type_id_hex::<BufferFact>() {
        return validate_buffer(node_id, attachment_bytes);
    }
    if type_id == type_id_hex::<BlobFact>() {
        return validate_content::<BlobFact>(node_id, attachment_bytes);
    }
    if type_id == type_id_hex::<LeafFact>() {
        return validate_content::<LeafFact>(node_id, attachment_bytes);
    }
    if type_id == type_id_hex::<BranchFact>() {
        return validate_content::<BranchFact>(node_id, attachment_bytes);
    }
    if type_id == type_id_hex::<HeadFact>() {
        return validate_content::<HeadFact>(node_id, attachment_bytes);
    }
    if type_id == type_id_hex::<RewriteFact>() {
        return validate_content::<RewriteFact>(node_id, attachment_bytes);
    }
    if type_id == type_id_hex::<DiffFact>() {
        return validate_content::<DiffFact>(node_id, attachment_bytes);
    }
    Err(format!(
        "unsupported ReplaceRange patch fact type {type_id}"
    ))
}

fn validate_buffer(node_id: &str, attachment_bytes: &HexBytes) -> Result<(), String> {
    let fact: BufferFact = decode_canonical(attachment_bytes)?;
    require_node_id("keyed Buffer", node_id, buffer_node_id(&fact.buffer_key))
}

fn validate_content<F: ContentAddressedFact>(
    node_id: &str,
    attachment_bytes: &HexBytes,
) -> Result<(), String> {
    let fact: F = decode_canonical(attachment_bytes)?;
    let expected = fact_id(&fact).map_err(|error| error.to_string())?;
    require_node_id(F::TYPE_LABEL, node_id, expected)
}

fn decode_canonical<F: TypedFact>(attachment_bytes: &HexBytes) -> Result<F, String> {
    let bytes = attachment_bytes.bytes();
    let fact: F = serde_json::from_slice(&bytes)
        .map_err(|error| format!("patch {} attachment cannot decode: {error}", F::TYPE_LABEL))?;
    let canonical = fact_bytes(&fact).map_err(|error| error.to_string())?;
    if canonical != bytes {
        return Err(format!(
            "patch {} attachment bytes are not canonical",
            F::TYPE_LABEL
        ));
    }
    Ok(fact)
}

fn require_node_id(label: &str, claimed: &str, expected: NodeId) -> Result<(), String> {
    let claimed = parse_node_id(claimed).map_err(|error| error.to_string())?;
    if claimed != expected {
        return Err(format!(
            "patch {label} attachment identity does not match its node"
        ));
    }
    Ok(())
}

fn type_id_hex<F: TypedFact>() -> String {
    hex::encode(fact_type_id::<F>().as_bytes())
}

fn insert_unique<'a, T>(
    values: &mut BTreeMap<&'a str, T>,
    node_id: &'a str,
    value: T,
) -> Result<(), String> {
    if values.insert(node_id, value).is_some() {
        return Err(format!("duplicate patch operation for {node_id}"));
    }
    Ok(())
}

fn require_targets<'a>(
    label: &str,
    actual: impl Iterator<Item = &'a &'a str>,
    expected: &BTreeSet<&'a str>,
) -> Result<(), String> {
    let actual = actual.copied().collect::<BTreeSet<_>>();
    if actual != *expected {
        return Err(format!(
            "{label} differ: expected {expected:?}, received {actual:?}"
        ));
    }
    Ok(())
}
