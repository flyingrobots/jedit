import {
  ROPE_CHECKPOINT_REASON_AUTOSAVE,
  ROPE_CHECKPOINT_REASON_EXPORT,
  ROPE_CHECKPOINT_REASON_IMPORT,
  ROPE_CHECKPOINT_REASON_MANUAL_SAVE,
  ROPE_CHECKPOINT_REASON_RETENTION_BOUNDARY,
  ROPE_CHECKPOINT_REASON_TEST_FIXTURE,
  type EchoCausalAnchorPurpose,
  type RopeCheckpointReason,
  type RopeHeadFact,
  type TextBlobHashPort,
} from './graph-rope-types.js';

const RUNTIME_HASH_PREFIX_CAUSAL_FRONTIER = 'causal-frontier:';
const RUNTIME_HASH_PREFIX_CHECKPOINT_ID = 'rope-checkpoint:';

export interface RopeCheckpointIdInput {
  readonly worldlineId: string;
  readonly headId: string;
  readonly reason: RopeCheckpointReason;
  readonly causalAnchorId: string;
  readonly admittedByReceiptId: string;
  readonly hash: TextBlobHashPort;
}

export function basisFrontierDigestForRopeHead(head: RopeHeadFact, hash: TextBlobHashPort): string {
  return hash.sha256Hex(
    `${RUNTIME_HASH_PREFIX_CAUSAL_FRONTIER}${head.worldlineId}:${head.headId}:${head.contentHash}`,
  );
}

export function ropeCheckpointIdFor(input: RopeCheckpointIdInput): string {
  return `${RUNTIME_HASH_PREFIX_CHECKPOINT_ID}${input.hash.sha256Hex([
    input.worldlineId,
    input.headId,
    input.reason,
    input.causalAnchorId,
    input.admittedByReceiptId,
  ].join(':'))}`;
}

export function checkpointAnchorPurpose(reason: RopeCheckpointReason): EchoCausalAnchorPurpose {
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
