use warp_core::{AttachmentValue, NodeId, TypeId};

use crate::error::HostError;
use crate::identity::{content_node_id, node_id_hex};
use crate::records::{
    decode_fact_bytes, fact_bytes, fact_type_id, ContentAddressedFact, TypedFact,
};

use super::fault::{RopeFault, RopeResult};
use super::{GraphFacts, PlanContext};

impl<'a, T: GraphFacts> PlanContext<'a, T> {
    pub(super) fn read_content_fact<F: ContentAddressedFact>(
        &mut self,
        id: NodeId,
    ) -> RopeResult<F> {
        let bytes = self.content_fact_bytes::<F>(id)?;
        if content_node_id(F::ID_DOMAIN, &bytes) != id {
            return Err(RopeFault::content_identity(format!(
                "{} {} retained-byte content identity does not match",
                F::TYPE_LABEL,
                node_id_hex(id)
            )));
        }
        let fact = decode_fact_bytes::<F>(&bytes).map_err(RopeFault::structural_dependency)?;
        let canonical_bytes = fact_bytes(&fact).map_err(RopeFault::structural_dependency)?;
        if canonical_bytes != bytes {
            return Err(RopeFault::fact_malformed(format!(
                "{} {} retained bytes are not canonical",
                F::TYPE_LABEL,
                node_id_hex(id)
            )));
        }
        Ok(fact)
    }

    fn content_fact_bytes<F: ContentAddressedFact>(&mut self, id: NodeId) -> RopeResult<Vec<u8>> {
        if let Some(pending) = self.pending.get(&id) {
            require_fact_type::<F>(id, pending.type_id)?;
            return Ok(pending.bytes.clone());
        }
        self.reads.insert(id);
        let record = self.source.node(&id).ok_or_else(|| {
            RopeFault::structural_dependency(HostError::MissingFact(format!(
                "{} at {}",
                F::TYPE_LABEL,
                node_id_hex(id)
            )))
        })?;
        require_fact_type::<F>(id, record.ty)?;
        let attachment = self.source.attachment(&id).ok_or_else(|| {
            RopeFault::structural_dependency(HostError::MissingFact(format!(
                "{} at {}",
                F::TYPE_LABEL,
                node_id_hex(id)
            )))
        })?;
        atom_fact_bytes::<F>(id, attachment)
    }
}

fn require_fact_type<F: TypedFact>(id: NodeId, actual: TypeId) -> RopeResult<()> {
    if actual != fact_type_id::<F>() {
        return Err(RopeFault::fact_malformed(format!(
            "node {} is not {}",
            node_id_hex(id),
            F::TYPE_LABEL
        )));
    }
    Ok(())
}

fn atom_fact_bytes<F: TypedFact>(id: NodeId, attachment: &AttachmentValue) -> RopeResult<Vec<u8>> {
    let AttachmentValue::Atom(payload) = attachment else {
        return Err(RopeFault::fact_malformed(format!(
            "{} at {} uses a descended attachment",
            F::TYPE_LABEL,
            node_id_hex(id)
        )));
    };
    require_fact_type::<F>(id, payload.type_id)?;
    Ok(payload.bytes.as_ref().to_vec())
}
