import type {
  BufferWorldline,
  RopeHead,
} from '../generated/jedit/rope.types.generated.js';
import type { HashPort } from '../ports/hash.js';
import type {
  HotTextAuthorityBasis,
  HotTextBufferState,
} from '../ports/hot-text-runtime.js';
import {
  digest,
  parseHeadId,
  parseWorldlineId,
  toHeadId,
  toWorldlineId,
} from './jedit-contract-runtime-id.js';
import {
  JeditContractRuntimeError,
  JeditContractRuntimeErrorCode,
} from './jedit-contract-runtime-errors.js';

export function ensureWorldlineId(worldlineId: string): void {
  if (parseWorldlineId(worldlineId) == null) {
    throw new JeditContractRuntimeError(
      JeditContractRuntimeErrorCode.InvalidWorldlineId,
      `Invalid worldline identifier: ${worldlineId}.`,
    );
  }
}

export function ensureSessionBasis(
  worldline: BufferWorldline,
  state: HotTextBufferState,
): void {
  ensureProjectionRootId(state.currentRoot.id);
  if (state.authorityBasis == null) {
    ensureLegacySessionBasis(worldline, state.currentRoot.id);
    return;
  }
  ensureAuthorityBasis(worldline, state.authorityBasis);
}

export function worldlineIdForState(
  state: HotTextBufferState,
  projectionPath: string,
): string {
  return state.authorityBasis?.worldlineId ?? toWorldlineId(projectionPath);
}

export function canonicalHeadIdForState(state: HotTextBufferState): string {
  return state.authorityBasis?.headId ?? toHeadId(state.currentRoot.id);
}

export function authorityHeadRecord(
  basis: HotTextAuthorityBasis,
  text: string,
  hash: HashPort,
): RopeHead {
  return {
    headId: basis.headId,
    worldlineId: basis.worldlineId,
    rootNodeId: basis.rootNodeId,
    byteLength: basis.byteLength,
    lineCount: basis.lineCount,
    utf16Length: text.length,
    equivalenceDigest: digest(text, hash),
  };
}

function ensureProjectionRootId(rootId: number): void {
  if (!Number.isFinite(rootId) || !Number.isInteger(rootId)) {
    throw new JeditContractRuntimeError(
      JeditContractRuntimeErrorCode.InvalidRootId,
      `Invalid root identifier: ${rootId}.`,
    );
  }
}

function ensureLegacySessionBasis(
  worldline: BufferWorldline,
  rootId: number,
): void {
  if (parseHeadId(worldline.canonicalHeadId) == null) {
    throw new JeditContractRuntimeError(
      JeditContractRuntimeErrorCode.InvalidHeadId,
      `Invalid head identifier: ${worldline.canonicalHeadId}.`,
    );
  }
  if (toHeadId(rootId) !== worldline.canonicalHeadId) {
    throw new JeditContractRuntimeError(
      JeditContractRuntimeErrorCode.BaseHeadMismatch,
      `Canonical head mismatch: expected ${toHeadId(rootId)}, received ${worldline.canonicalHeadId}.`,
    );
  }
}

function ensureAuthorityBasis(
  worldline: BufferWorldline,
  basis: HotTextAuthorityBasis,
): void {
  if (basis.worldlineId.length === 0 || basis.headId.length === 0) {
    throw new JeditContractRuntimeError(
      JeditContractRuntimeErrorCode.InvalidHeadId,
      'Authority basis requires non-empty opaque worldline and head identifiers.',
    );
  }
  if (worldline.worldlineId !== basis.worldlineId) {
    throw new JeditContractRuntimeError(
      JeditContractRuntimeErrorCode.WorldlineMismatch,
      `Authority worldline mismatch: expected ${basis.worldlineId}, received ${worldline.worldlineId}.`,
    );
  }
  if (worldline.canonicalHeadId !== basis.headId) {
    throw new JeditContractRuntimeError(
      JeditContractRuntimeErrorCode.BaseHeadMismatch,
      `Canonical head mismatch: expected ${basis.headId}, received ${worldline.canonicalHeadId}.`,
    );
  }
}
