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

const RUNTIME_HASH_PREFIX_CAUSAL_FRONTIER = 'causal-frontier:';
const RUNTIME_HASH_PREFIX_CAUSAL_ANCHOR_RECEIPT = 'causal-anchor-receipt:';
const RUNTIME_HASH_PREFIX_CAUSAL_ANCHOR_DIGEST = 'causal-anchor-digest:';
const RUNTIME_HASH_PREFIX_CAUSAL_ANCHOR_ID = 'causal-anchor:';
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

export function createCheckpointFacts(
  head: RopeHeadFact,
  reason: RopeCheckpointReason,
  hash: TextBlobHashPort,
): GraphRopeCreateCheckpointResult {
  const causalAnchor = causalAnchorForCheckpoint(head, reason, hash);
  const checkpoint: RopeCheckpointFact = {
    kind: ROPE_CHECKPOINT_FACT_KIND,
    schemaVersion: GRAPH_ROPE_SCHEMA_VERSION,
    checkpointId: checkpointIdFor(head.worldlineId, head.headId, reason, causalAnchor.anchorId, hash),
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
): EchoCausalAnchorFact {
  const purpose = checkpointAnchorPurpose(reason);
  const retainedRoot = retainedRopeHeadRoot(head.headId);
  const basisFrontierDigest = basisFrontierDigestFor(head, hash);
  const admittedByReceiptId = anchorReceiptIdFor(head, purpose, hash);
  const anchorDigest = hash.sha256Hex(anchorDigestMaterial(head, retainedRoot, purpose, basisFrontierDigest, admittedByReceiptId));
  return {
    kind: ECHO_CAUSAL_ANCHOR_FACT_KIND,
    schemaVersion: GRAPH_ROPE_SCHEMA_VERSION,
    anchorId: `${RUNTIME_HASH_PREFIX_CAUSAL_ANCHOR_ID}${hash.sha256Hex(anchorDigest)}`,
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
  hash: TextBlobHashPort,
): string {
  return hash.sha256Hex(`${RUNTIME_HASH_PREFIX_CAUSAL_ANCHOR_RECEIPT}${head.worldlineId}:${head.headId}:${purpose}`);
}

function anchorDigestMaterial(
  head: RopeHeadFact,
  retainedRoot: EchoCausalAnchorAppSubjectRoot,
  purpose: EchoCausalAnchorPurpose,
  basisFrontierDigest: string,
  admittedByReceiptId: string,
): string {
  return [
    RUNTIME_HASH_PREFIX_CAUSAL_ANCHOR_DIGEST,
    head.worldlineId,
    head.headId,
    basisFrontierDigest,
    purpose,
    admittedByReceiptId,
    retainedRoot.kind,
    retainedRoot.appId,
    retainedRoot.subjectKind,
    retainedRoot.id,
    retainedRoot.role,
  ].join(':');
}

function checkpointIdFor(
  worldlineId: string,
  headId: string,
  reason: RopeCheckpointReason,
  causalAnchorId: string,
  hash: TextBlobHashPort,
): string {
  return `${RUNTIME_HASH_PREFIX_CHECKPOINT_ID}${hash.sha256Hex(`${worldlineId}:${headId}:${reason}:${causalAnchorId}`)}`;
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
