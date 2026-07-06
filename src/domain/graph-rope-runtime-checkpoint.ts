import {
  ECHO_CAUSAL_ANCHOR_FACT_KIND,
  ECHO_CAUSAL_ANCHOR_ROOT_KIND_APP_SUBJECT,
  ECHO_CAUSAL_ANCHOR_ROOT_ROLE_AUTHORITY,
  GRAPH_ROPE_SCHEMA_VERSION,
  JEDIT_CAUSAL_ANCHOR_APP_ID,
  JEDIT_CAUSAL_ANCHOR_SUBJECT_KIND_BUFFER_WORLDLINE,
  JEDIT_CAUSAL_ANCHOR_SUBJECT_KIND_ROPE_HEAD,
  ROPE_CHECKPOINT_FACT_KIND,
  ROPE_CHECKPOINT_REASON_AUTOSAVE,
  ROPE_CHECKPOINT_REASON_EXPORT,
  ROPE_CHECKPOINT_REASON_IMPORT,
  ROPE_CHECKPOINT_REASON_MANUAL_SAVE,
  ROPE_CHECKPOINT_REASON_RETENTION_BOUNDARY,
  ROPE_CHECKPOINT_REASON_TEST_FIXTURE,
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

const RUNTIME_HASH_PREFIX_CAUSAL_FRONTIER = 'causal-frontier:';
const RUNTIME_HASH_PREFIX_CAUSAL_ANCHOR_RECEIPT = 'causal-anchor-receipt:';
const RUNTIME_HASH_PREFIX_CHECKPOINT_ID = 'rope-checkpoint:';

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

interface CheckpointIdInput {
  readonly worldlineId: string;
  readonly headId: string;
  readonly reason: RopeCheckpointReason;
  readonly causalAnchorId: string;
  readonly admittedByReceiptId: string;
  readonly hash: TextBlobHashPort;
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
    checkpointId: checkpointIdFor({
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
  const basisFrontierDigest = basisFrontierDigestFor(head, hash);
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

function basisFrontierDigestFor(head: RopeHeadFact, hash: TextBlobHashPort): string {
  return hash.sha256Hex(
    `${RUNTIME_HASH_PREFIX_CAUSAL_FRONTIER}${head.worldlineId}:${head.headId}:${head.contentHash}`,
  );
}

function anchorReceiptIdFor(
  head: RopeHeadFact,
  purpose: EchoCausalAnchorPurpose,
  admissionSequence: number,
  hash: TextBlobHashPort,
): string {
  return hash.sha256Hex(`${RUNTIME_HASH_PREFIX_CAUSAL_ANCHOR_RECEIPT}${head.worldlineId}:${head.headId}:${purpose}:${String(admissionSequence)}`);
}

function checkpointIdFor(input: CheckpointIdInput): string {
  return `${RUNTIME_HASH_PREFIX_CHECKPOINT_ID}${input.hash.sha256Hex([
    input.worldlineId,
    input.headId,
    input.reason,
    input.causalAnchorId,
    input.admittedByReceiptId,
  ].join(':'))}`;
}

function checkpointAnchorPurpose(reason: RopeCheckpointReason): EchoCausalAnchorPurpose {
  switch (reason) {
    case ROPE_CHECKPOINT_REASON_MANUAL_SAVE:
      return 'user-save';
    case ROPE_CHECKPOINT_REASON_AUTOSAVE:
      return 'autosave';
    case ROPE_CHECKPOINT_REASON_RETENTION_BOUNDARY:
      return 'retention';
    case ROPE_CHECKPOINT_REASON_EXPORT:
      return 'export';
    case ROPE_CHECKPOINT_REASON_IMPORT:
      return 'recovery';
    case ROPE_CHECKPOINT_REASON_TEST_FIXTURE:
      return 'debug';
  }
}
