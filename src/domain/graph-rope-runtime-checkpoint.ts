import {
  ECHO_CAUSAL_ANCHOR_ROOT_KIND_APP_SUBJECT,
  ECHO_CAUSAL_ANCHOR_ROOT_ROLE_AUTHORITY,
  GRAPH_ROPE_SCHEMA_VERSION,
  JEDIT_CAUSAL_ANCHOR_APP_ID,
  JEDIT_CAUSAL_ANCHOR_SUBJECT_KIND_BUFFER_WORLDLINE,
  JEDIT_CAUSAL_ANCHOR_SUBJECT_KIND_ROPE_HEAD,
  ROPE_CHECKPOINT_FACT_KIND,
  makeEchoCausalAnchorAdmissionRequest,
  type EchoCausalAnchorAdmissionRequest,
  type EchoCausalAnchorAdmissionResult,
  type EchoCausalAnchorAppSubjectRoot,
  type RopeCheckpointFact,
  type RopeCheckpointReason,
  type RopeHeadFact,
  type TextBlobHashPort,
} from './graph-rope-contract.js';
import {
  basisFrontierDigestForRopeHead,
  checkpointAnchorPurpose,
  checkpointAnchorRetentionClass,
  ropeCheckpointIdFor,
} from './graph-rope-checkpoint-identity.js';

export interface GraphRopeCreateCheckpointInput {
  readonly worldlineId: string;
  readonly headId: string;
  readonly reason: RopeCheckpointReason;
}

export interface GraphRopeCreateCheckpointResult {
  readonly head: RopeHeadFact;
  readonly causalAnchor: EchoCausalAnchorAdmissionResult['anchor'];
  readonly causalAnchorReceipt: EchoCausalAnchorAdmissionResult['receipt'];
  readonly checkpoint: RopeCheckpointFact;
}

export function createCheckpointAnchorAdmissionRequest(
  head: RopeHeadFact,
  reason: RopeCheckpointReason,
  hash: TextBlobHashPort,
): EchoCausalAnchorAdmissionRequest {
  return makeEchoCausalAnchorAdmissionRequest({
    subject: {
      appId: JEDIT_CAUSAL_ANCHOR_APP_ID,
      subjectKind: JEDIT_CAUSAL_ANCHOR_SUBJECT_KIND_BUFFER_WORLDLINE,
      subjectId: head.worldlineId,
    },
    basisFrontierDigest: basisFrontierDigestForRopeHead(head, hash),
    retainedRoots: [retainedRopeHeadRoot(head.headId)],
    materializationRoots: [],
    purpose: checkpointAnchorPurpose(reason),
    retention: {
      retentionClass: checkpointAnchorRetentionClass(reason),
    },
  });
}

export function createCheckpointFacts(
  head: RopeHeadFact,
  reason: RopeCheckpointReason,
  anchorAdmission: EchoCausalAnchorAdmissionResult,
  hash: TextBlobHashPort,
): GraphRopeCreateCheckpointResult {
  const causalAnchor = anchorAdmission.anchor;
  const checkpoint: RopeCheckpointFact = {
    kind: ROPE_CHECKPOINT_FACT_KIND,
    schemaVersion: GRAPH_ROPE_SCHEMA_VERSION,
    checkpointId: ropeCheckpointIdFor({
      worldlineId: head.worldlineId,
      headId: head.headId,
      reason,
      causalAnchorId: causalAnchor.anchorId,
      admittedByReceiptId: causalAnchor.admittedByReceiptId,
      hash,
    }),
    worldlineId: head.worldlineId,
    headId: head.headId,
    causalAnchorId: causalAnchor.anchorId,
    reason,
  };
  return {
    head,
    causalAnchor,
    causalAnchorReceipt: anchorAdmission.receipt,
    checkpoint,
  };
}

function retainedRopeHeadRoot(headId: string): EchoCausalAnchorAppSubjectRoot {
  return {
    kind: ECHO_CAUSAL_ANCHOR_ROOT_KIND_APP_SUBJECT,
    appId: JEDIT_CAUSAL_ANCHOR_APP_ID,
    subjectKind: JEDIT_CAUSAL_ANCHOR_SUBJECT_KIND_ROPE_HEAD,
    id: headId,
    role: ECHO_CAUSAL_ANCHOR_ROOT_ROLE_AUTHORITY,
  };
}
