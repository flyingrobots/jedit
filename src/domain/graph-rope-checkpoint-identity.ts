import {
  type RopeCheckpointReason,
  type TextBlobHashPort,
} from './graph-rope-types.js';

const RUNTIME_HASH_PREFIX_CHECKPOINT_ID = 'rope-checkpoint:';
const RUNTIME_HASH_PREFIX_CHECKPOINT_ANCHOR_ASSOCIATION_ID = 'rope-checkpoint-anchor:';

export interface RopeCheckpointIdInput {
  readonly worldlineId: string;
  readonly headId: string;
  readonly reason: RopeCheckpointReason;
  readonly hash: TextBlobHashPort;
}

export interface RopeCheckpointAnchorAssociationIdInput {
  readonly checkpointId: string;
  readonly causalAnchorId: string;
  readonly causalAnchorFactId: string;
  readonly causalAnchorReceiptId: string;
  readonly hash: TextBlobHashPort;
}

export function ropeCheckpointIdFor(input: RopeCheckpointIdInput): string {
  return `${RUNTIME_HASH_PREFIX_CHECKPOINT_ID}${input.hash.sha256Hex(identityTuple([
    input.worldlineId,
    input.headId,
    input.reason,
  ]))}`;
}

export function ropeCheckpointAnchorAssociationIdFor(
  input: RopeCheckpointAnchorAssociationIdInput,
): string {
  return `${RUNTIME_HASH_PREFIX_CHECKPOINT_ANCHOR_ASSOCIATION_ID}${input.hash.sha256Hex(identityTuple([
    input.checkpointId,
    input.causalAnchorId,
    input.causalAnchorFactId,
    input.causalAnchorReceiptId,
  ]))}`;
}

function identityTuple(fields: readonly string[]): string {
  return JSON.stringify(fields);
}
