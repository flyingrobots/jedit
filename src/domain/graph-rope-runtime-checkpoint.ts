import {
  GRAPH_ROPE_SCHEMA_VERSION,
  ROPE_CHECKPOINT_ANCHORED_FACT_KIND,
  ROPE_CHECKPOINT_FACT_KIND,
  type EchoCausalAnchorAdmissionEvidence,
  type RopeCheckpointAnchorAdmissionRequest,
  type RopeCheckpointAnchoredFact,
  type RopeCheckpointFact,
  type RopeCheckpointMaterializationRoot,
  type RopeCheckpointReason,
  type RopeHeadFact,
  type TextBlobHashPort,
} from './graph-rope-contract.js';
import {
  ropeCheckpointAnchorAssociationIdFor,
  ropeCheckpointIdFor,
} from './graph-rope-checkpoint-identity.js';

export interface GraphRopeCreateCheckpointInput {
  readonly worldlineId: string;
  readonly headId: string;
  readonly reason: RopeCheckpointReason;
}

export interface GraphRopeCreateCheckpointResult {
  readonly head: RopeHeadFact;
  readonly checkpoint: RopeCheckpointFact;
}

export interface GraphRopeAnchorCheckpointInput {
  readonly checkpointId: string;
  readonly materializationRoots?: readonly RopeCheckpointMaterializationRoot[];
}

export interface GraphRopeAnchorCheckpointResult {
  readonly head: RopeHeadFact;
  readonly checkpoint: RopeCheckpointFact;
  readonly echoEvidence: EchoCausalAnchorAdmissionEvidence;
  readonly association: RopeCheckpointAnchoredFact;
}

export function createCheckpointFact(
  head: RopeHeadFact,
  reason: RopeCheckpointReason,
  hash: TextBlobHashPort,
): RopeCheckpointFact {
  return {
    kind: ROPE_CHECKPOINT_FACT_KIND,
    schemaVersion: GRAPH_ROPE_SCHEMA_VERSION,
    checkpointId: ropeCheckpointIdFor({
      worldlineId: head.worldlineId,
      headId: head.headId,
      reason,
      hash,
    }),
    worldlineId: head.worldlineId,
    headId: head.headId,
    reason,
  };
}

export function createCheckpointAnchorAdmissionRequest(
  checkpoint: RopeCheckpointFact,
  materializationRoots: readonly RopeCheckpointMaterializationRoot[] = [],
): RopeCheckpointAnchorAdmissionRequest {
  return {
    checkpointId: checkpoint.checkpointId,
    worldlineId: checkpoint.worldlineId,
    headId: checkpoint.headId,
    reason: checkpoint.reason,
    materializationRoots: [...materializationRoots],
  };
}

export function createCheckpointAnchorAssociation(
  checkpoint: RopeCheckpointFact,
  evidence: EchoCausalAnchorAdmissionEvidence,
  hash: TextBlobHashPort,
): RopeCheckpointAnchoredFact {
  return {
    kind: ROPE_CHECKPOINT_ANCHORED_FACT_KIND,
    schemaVersion: GRAPH_ROPE_SCHEMA_VERSION,
    associationId: ropeCheckpointAnchorAssociationIdFor({
      checkpointId: checkpoint.checkpointId,
      causalAnchorId: evidence.anchorId,
      causalAnchorFactId: evidence.anchorFactId,
      causalAnchorReceiptId: evidence.receiptId,
      hash,
    }),
    checkpointId: checkpoint.checkpointId,
    causalAnchorId: evidence.anchorId,
    causalAnchorFactId: evidence.anchorFactId,
    causalAnchorReceiptId: evidence.receiptId,
  };
}
