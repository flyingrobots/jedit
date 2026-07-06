import {
  ECHO_CAUSAL_ANCHOR_FACT_KIND,
  ECHO_CAUSAL_ANCHOR_ROOT_KIND_APP_SUBJECT,
  ECHO_CAUSAL_ANCHOR_ROOT_ROLE_AUTHORITY,
  GRAPH_ROPE_SCHEMA_VERSION,
  JEDIT_CAUSAL_ANCHOR_APP_ID,
  JEDIT_CAUSAL_ANCHOR_SUBJECT_KIND_BUFFER_WORLDLINE,
  JEDIT_CAUSAL_ANCHOR_SUBJECT_KIND_ROPE_HEAD,
  ROPE_CHECKPOINT_FACT_KIND,
  type EchoCausalAnchorAppSubjectRoot,
  type EchoCausalAnchorFact,
  type EchoCausalAnchorPurpose,
  type RopeCheckpointFact,
  type RopeCheckpointReason,
  type RopeHeadFact,
  type TextBlobHashPort,
} from './graph-rope-contract.js';
import {
  causalAnchorDigestFor,
  causalAnchorIdForDigest,
} from './graph-rope-causal-anchor-digest.js';
import {
  basisFrontierDigestForRopeHead,
  checkpointAnchorPurpose,
  checkpointAnchorRetentionClass,
  ropeCheckpointIdFor,
} from './graph-rope-checkpoint-identity.js';

const RUNTIME_HASH_PREFIX_CAUSAL_ANCHOR_RECEIPT = 'causal-anchor-receipt:';

export interface GraphRopeCreateCheckpointInput {
  readonly worldlineId: string;
  readonly headId: string;
  readonly reason: RopeCheckpointReason;
}

export interface GraphRopeCreateCheckpointResult {
  readonly head: RopeHeadFact;
  readonly causalAnchor: EchoCausalAnchorFact;
  readonly checkpoint: RopeCheckpointFact;
}

export function createCheckpointFacts(
  head: RopeHeadFact,
  reason: RopeCheckpointReason,
  hash: TextBlobHashPort,
  admissionSequence: number,
): GraphRopeCreateCheckpointResult {
  const causalAnchor = causalAnchorForCheckpoint(head, reason, hash, admissionSequence);
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
  return { head, causalAnchor, checkpoint };
}

function causalAnchorForCheckpoint(
  head: RopeHeadFact,
  reason: RopeCheckpointReason,
  hash: TextBlobHashPort,
  admissionSequence: number,
): EchoCausalAnchorFact {
  const purpose = checkpointAnchorPurpose(reason);
  const retainedRoot = retainedRopeHeadRoot(head.headId);
  const basisFrontierDigest = basisFrontierDigestForRopeHead(head, hash);
  const admittedByReceiptId = anchorReceiptIdFor(head, purpose, admissionSequence, hash);
  const anchor: Omit<EchoCausalAnchorFact, 'anchorDigest' | 'anchorId'> = {
    kind: ECHO_CAUSAL_ANCHOR_FACT_KIND,
    schemaVersion: GRAPH_ROPE_SCHEMA_VERSION,
    subject: {
      appId: JEDIT_CAUSAL_ANCHOR_APP_ID,
      subjectKind: JEDIT_CAUSAL_ANCHOR_SUBJECT_KIND_BUFFER_WORLDLINE,
      subjectId: head.worldlineId,
    },
    basisFrontierDigest,
    retainedRoots: [retainedRoot],
    materializationRoots: [],
    purpose,
    retention: {
      retentionClass: checkpointAnchorRetentionClass(reason),
    },
    admittedByReceiptId,
  };
  const anchorDigest = causalAnchorDigestFor(anchor, hash);
  return {
    ...anchor,
    anchorId: causalAnchorIdForDigest(anchorDigest, hash),
    anchorDigest,
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

function anchorReceiptIdFor(
  head: RopeHeadFact,
  purpose: EchoCausalAnchorPurpose,
  admissionSequence: number,
  hash: TextBlobHashPort,
): string {
  return hash.sha256Hex(`${RUNTIME_HASH_PREFIX_CAUSAL_ANCHOR_RECEIPT}${head.worldlineId}:${head.headId}:${purpose}:${String(admissionSequence)}`);
}
