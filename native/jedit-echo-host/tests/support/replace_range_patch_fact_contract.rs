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

pub(super) struct ValidatedPatch<'a> {
    attachments: BTreeMap<&'a str, (&'a str, &'a HexBytes)>,
}

impl ValidatedPatch<'_> {
    pub(super) fn buffer(&self, label: &str, node_id: &Hex32) -> Result<BufferFact, String> {
        let (type_id, bytes) = self.entry(label, node_id)?;
        decode_buffer_fact(label, node_id.as_str(), type_id, bytes)
    }

    pub(super) fn content<F: ContentAddressedFact>(
        &self,
        label: &str,
        node_id: &Hex32,
    ) -> Result<F, String> {
        let (type_id, bytes) = self.entry(label, node_id)?;
        decode_content_fact::<F>(label, node_id.as_str(), type_id, bytes)
    }

    pub(super) fn require_singleton<F: TypedFact>(&self, label: &str) -> Result<(), String> {
        let expected_type = type_id_hex::<F>();
        let count = self
            .attachments
            .values()
            .filter(|(type_id, _)| *type_id == expected_type)
            .count();
        if count != 1 {
            return Err(format!(
                "patch must contain exactly one {label}; found {count}"
            ));
        }
        Ok(())
    }

    fn entry(&self, label: &str, node_id: &Hex32) -> Result<(&str, &HexBytes), String> {
        self.attachments
            .get(node_id.as_str())
            .copied()
            .ok_or_else(|| format!("{label} is absent from the patch"))
    }
}

pub(super) fn validate_patch<'a>(
    patch: &'a [PatchOperation],
    writes: &BTreeSet<&str>,
) -> Result<ValidatedPatch<'a>, String> {
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
    validate_patch_order(patch)?;
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
        validate_fact(
            &format!("patch fact {node_id}"),
            node_id,
            upsert_type,
            attachment_bytes,
        )?;
    }
    Ok(ValidatedPatch { attachments })
}

fn validate_patch_order(patch: &[PatchOperation]) -> Result<(), String> {
    let mut attachment_phase = false;
    let mut previous_upsert = None;
    let mut previous_attachment = None;
    for operation in patch {
        match operation {
            PatchOperation::UpsertNode { node_id, .. } => {
                if attachment_phase {
                    return Err("patch node upsert follows an attachment".to_owned());
                }
                require_ascending("node upsert", &mut previous_upsert, node_id.as_str())?;
            }
            PatchOperation::SetNodeAlpha { node_id, .. } => {
                attachment_phase = true;
                require_ascending("attachment", &mut previous_attachment, node_id.as_str())?;
            }
        }
    }
    Ok(())
}

pub(super) fn validate_fact(
    label: &str,
    node_id: &str,
    type_id: &str,
    attachment_bytes: &HexBytes,
) -> Result<(), String> {
    if type_id == type_id_hex::<BufferFact>() {
        return decode_buffer_fact(label, node_id, type_id, attachment_bytes).map(drop);
    }
    if type_id == type_id_hex::<BlobFact>() {
        return decode_content_fact::<BlobFact>(label, node_id, type_id, attachment_bytes)
            .map(drop);
    }
    if type_id == type_id_hex::<LeafFact>() {
        return decode_content_fact::<LeafFact>(label, node_id, type_id, attachment_bytes)
            .map(drop);
    }
    if type_id == type_id_hex::<BranchFact>() {
        return decode_content_fact::<BranchFact>(label, node_id, type_id, attachment_bytes)
            .map(drop);
    }
    if type_id == type_id_hex::<HeadFact>() {
        return decode_content_fact::<HeadFact>(label, node_id, type_id, attachment_bytes)
            .map(drop);
    }
    if type_id == type_id_hex::<RewriteFact>() {
        return decode_content_fact::<RewriteFact>(label, node_id, type_id, attachment_bytes)
            .map(drop);
    }
    if type_id == type_id_hex::<DiffFact>() {
        return decode_content_fact::<DiffFact>(label, node_id, type_id, attachment_bytes)
            .map(drop);
    }
    Err(format!(
        "{label} has unsupported ReplaceRange fact type {type_id}"
    ))
}

pub(super) fn decode_buffer_fact(
    label: &str,
    node_id: &str,
    type_id: &str,
    attachment_bytes: &HexBytes,
) -> Result<BufferFact, String> {
    require_declared_type::<BufferFact>(label, type_id)?;
    let fact: BufferFact = decode_canonical(label, attachment_bytes)?;
    require_node_id(label, node_id, buffer_node_id(&fact.buffer_key))?;
    Ok(fact)
}

pub(super) fn decode_content_fact<F: ContentAddressedFact>(
    label: &str,
    node_id: &str,
    type_id: &str,
    attachment_bytes: &HexBytes,
) -> Result<F, String> {
    require_declared_type::<F>(label, type_id)?;
    let fact: F = decode_canonical(label, attachment_bytes)?;
    let expected = fact_id(&fact).map_err(|error| error.to_string())?;
    require_node_id(label, node_id, expected)?;
    Ok(fact)
}

fn decode_canonical<F: TypedFact>(label: &str, attachment_bytes: &HexBytes) -> Result<F, String> {
    let bytes = attachment_bytes.bytes();
    let fact: F = serde_json::from_slice(&bytes)
        .map_err(|error| format!("{label} attachment cannot decode: {error}"))?;
    let canonical = fact_bytes(&fact).map_err(|error| error.to_string())?;
    if canonical != bytes {
        return Err(format!("{label} attachment bytes are not canonical"));
    }
    Ok(fact)
}

fn require_node_id(label: &str, claimed: &str, expected: NodeId) -> Result<(), String> {
    let claimed = parse_node_id(claimed).map_err(|error| error.to_string())?;
    if claimed != expected {
        return Err(format!(
            "{label} attachment identity does not match its node"
        ));
    }
    Ok(())
}

fn require_declared_type<F: TypedFact>(label: &str, actual: &str) -> Result<(), String> {
    if actual != type_id_hex::<F>() {
        return Err(format!(
            "{label} does not identify the declared {}",
            F::TYPE_LABEL
        ));
    }
    Ok(())
}

fn require_ascending<'a>(
    label: &str,
    previous: &mut Option<&'a str>,
    current: &'a str,
) -> Result<(), String> {
    if previous.is_some_and(|value| value >= current) {
        return Err(format!(
            "patch {label} targets are not in ascending node identity order"
        ));
    }
    *previous = Some(current);
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
