import { createTextRange, materializeRoot } from '../domain/text-edit-contract.js';
import type { SaveCheckpointReceipt } from '../domain/save-checkpoint-contract.js';
import type { TickAdmissionReceipt } from '../domain/tick-admission-contract.js';
import type {
  CheckpointKind,
  BufferWorldline,
  Checkpoint,
  MutationOperationMap,
  QueryOperationMap,
  RopeHead,
  RopeRewrite,
  RewriteKind,
  RopeDiff,
} from '../generated/jedit/rope.types.generated.js';
import { MutationOperationSchemas, QueryOperationSchemas } from '../generated/jedit/rope.zod.generated.js';
import type { HotTextBufferState, HotTextRuntimePort } from '../ports/hot-text-runtime.js';
import type { HashPort } from '../ports/hash.js';
import {
  byteLength,
  digest,
  lineCount,
  parseHeadId,
  parseWorldlineId,
  toCheckpointId,
  toHeadId,
  toReceiptId,
  toRootNodeId,
  toTickId,
  toWorldlineId,
} from './jedit-contract-runtime-id.js';

export const JeditContractRuntimeErrorCode = Object.freeze({
  WorldlineMismatch: 'WORLDLINE_MISMATCH',
  BaseHeadMismatch: 'BASE_HEAD_MISMATCH',
  InvalidRootId: 'INVALID_ROOT_ID',
  InvalidWorldlineId: 'INVALID_WORLDLINE_ID',
  InvalidHeadId: 'INVALID_HEAD_ID',
} as const);

export type JeditContractRuntimeErrorCode = typeof JeditContractRuntimeErrorCode[keyof typeof JeditContractRuntimeErrorCode];

const REWRITE_KIND_REPLACE_RANGE_AS_TICK: RewriteKind = 'REPLACE_RANGE_AS_TICK';
const INITIAL_CHECKPOINT_KIND: CheckpointKind = 'INITIAL';
const REPLACE_SUMMARY_PREFIX = 'replace';
const REPLACE_SUMMARY_RANGE_SEPARATOR = '..';

type CreateBufferWorldlineInput = MutationOperationMap['createBufferWorldline']['input'];
type CreateBufferWorldlineResult = ReturnType<typeof MutationOperationSchemas.createBufferWorldline.result.parse>;
type ReplaceRangeAsTickInput = MutationOperationMap['replaceRangeAsTick']['input'];
type ReplaceRangeAsTickResult = ReturnType<typeof MutationOperationSchemas.replaceRangeAsTick.result.parse>;
type CreateCheckpointInput = MutationOperationMap['createCheckpoint']['input'];
type CreateCheckpointResult = ReturnType<typeof MutationOperationSchemas.createCheckpoint.result.parse>;
type WorldlineSnapshotInput = QueryOperationMap['worldlineSnapshot']['input'];
type WorldlineSnapshotResult = ReturnType<typeof QueryOperationSchemas.worldlineSnapshot.result.parse>;

type JeditWorldlineSessionRecord = {
  readonly worldline: BufferWorldline;
  readonly state: HotTextBufferState;
  readonly tickMetadata: readonly TickMetadata[];
  readonly checkpointMetadata: readonly CheckpointMetadata[];
};

export class JeditWorldlineSession {
  public readonly worldline: BufferWorldline;
  public readonly state: HotTextBufferState;
  public readonly tickMetadata: readonly TickMetadata[];
  public readonly checkpointMetadata: readonly CheckpointMetadata[];

  public constructor(
    worldline: BufferWorldline,
    state: HotTextBufferState,
    tickMetadata: readonly TickMetadata[],
    checkpointMetadata: readonly CheckpointMetadata[],
  ) {
    ensureWorldlineId(worldline.worldlineId);
    ensureHeadId(worldline.canonicalHeadId);
    ensureStateRootId(worldline.canonicalHeadId, state.currentRoot.id);
    this.worldline = worldline;
    this.state = state;
    this.tickMetadata = [...tickMetadata];
    this.checkpointMetadata = [...checkpointMetadata];
  }

  public static from(record: JeditWorldlineSessionRecord): JeditWorldlineSession {
    return new JeditWorldlineSession(record.worldline, record.state, record.tickMetadata, record.checkpointMetadata);
  }
}

export interface CreateBufferWorldlineExecution {
  readonly nextSession: JeditWorldlineSession;
  readonly result: CreateBufferWorldlineResult;
}

export interface ReplaceRangeAsTickExecution {
  readonly nextSession: JeditWorldlineSession;
  readonly result?: ReplaceRangeAsTickResult;
}

export interface CreateCheckpointExecution {
  readonly nextSession: JeditWorldlineSession;
  readonly result?: CreateCheckpointResult;
}

export interface TickMetadata {
  readonly tickId: number;
  readonly kind: RewriteKind;
  readonly author?: string;
  readonly baseHeadId?: string;
  readonly nextHeadId?: string;
  readonly startByte?: number;
  readonly endByte?: number;
  readonly insertedByteLength?: number;
  readonly deletedByteLength?: number;
}

interface CheckpointMetadata {
  readonly checkpointId: number;
  readonly kind: CreateCheckpointInput['kind'];
  readonly label?: string;
  readonly createdByRopeRewriteId?: number;
}

export class JeditContractRuntimeError extends Error {
  public readonly code: JeditContractRuntimeErrorCode;

  public constructor(code: JeditContractRuntimeErrorCode, message: string) {
    super(message);
    this.name = 'JeditContractRuntimeError';
    this.code = code;
  }
}

export function createBufferWorldline(
  runtime: HotTextRuntimePort,
  input: CreateBufferWorldlineInput,
  hash: HashPort,
): CreateBufferWorldlineExecution {
  const parsedInput = MutationOperationSchemas.createBufferWorldline.input.parse(input);
  const initialText = parsedInput.initialText ?? '';
  const projectionPath = parsedInput.projectionPath ?? parsedInput.bufferKey;
  const initialState = runtime.createBuffer(projectionPath, initialText);
  const initialSession = createSession(parsedInput.bufferKey, projectionPath, initialState, [], []);

  if (!(parsedInput.createInitialCheckpoint ?? false)) {
    const result = MutationOperationSchemas.createBufferWorldline.result.parse({
      worldline: initialSession.worldline,
      head: toHeadRecord(initialSession, hash),
    });
    return {
      nextSession: initialSession,
      result,
    };
  }

  const saved = runtime.saveCheckpoint(initialState);
  const metadata = saved.receipt == null
    ? []
    : [createCheckpointMetadata(saved.receipt, INITIAL_CHECKPOINT_KIND, undefined)];
  const nextSession = createSession(parsedInput.bufferKey, projectionPath, saved.nextState, [], metadata);
  const checkpoint = metadata[0] == null ? undefined : toCheckpointRecord(nextSession, metadata[0]);
  const result = MutationOperationSchemas.createBufferWorldline.result.parse({
    worldline: nextSession.worldline,
    head: toHeadRecord(nextSession, hash),
    checkpoint,
  });

  return {
    nextSession: nextSession,
    result,
  };
}

export function materializeWorldline(
  runtime: HotTextRuntimePort,
  session: JeditWorldlineSession,
): string {
  return runtime.materialize(session.state);
}

export function readWorldlineSnapshot(
  runtime: HotTextRuntimePort,
  session: JeditWorldlineSession,
  input: WorldlineSnapshotInput,
  hash: HashPort,
): WorldlineSnapshotResult {
  const parsedInput = QueryOperationSchemas.worldlineSnapshot.input.parse(input);
  ensureMatchingWorldline(session, parsedInput.worldlineId);

  return QueryOperationSchemas.worldlineSnapshot.result.parse({
    worldline: session.worldline,
    head: toHeadRecord(session, hash),
    checkpoints: toCheckpointRecords(session),
    text: materializeWorldline(runtime, session),
  });
}

export function replaceRangeAsTick(
  runtime: HotTextRuntimePort,
  session: JeditWorldlineSession,
  input: ReplaceRangeAsTickInput,
  hash: HashPort,
): ReplaceRangeAsTickExecution {
  const parsedInput = MutationOperationSchemas.replaceRangeAsTick.input.parse(input);
  ensureMatchingWorldline(session, parsedInput.worldlineId);
  ensureMatchingBaseHead(session, parsedInput.baseHeadId);

  const baseHeadId = parsedInput.baseHeadId;
  const admission = runtime.admitReplaceRangeTick(
    session.state,
    createTextRange(parsedInput.startByte, parsedInput.endByte),
    parsedInput.insertText,
  );

  if (admission.receipt == null) {
    return noReplaceRangeAsTickExecution(session, admission.nextState);
  }

  const nextHeadId = toHeadId(admission.nextState.currentRoot.id);
  const tickMetadata = createTickMetadata(admission.receipt, baseHeadId, nextHeadId, parsedInput.insertText, parsedInput.author ?? undefined);
  const nextSession = createSessionFromExisting(
    session,
    admission.nextState,
    [...session.tickMetadata, tickMetadata],
    session.checkpointMetadata,
  );
  return {
    nextSession: nextSession,
    result: replaceRangeAsTickResult({ nextSession, tickMetadata, receipt: admission.receipt, baseHeadId, insertText: parsedInput.insertText, hash }),
  };
}

export function createCheckpoint(
  runtime: HotTextRuntimePort,
  session: JeditWorldlineSession,
  input: CreateCheckpointInput,
  hash: HashPort,
): CreateCheckpointExecution {
  const parsedInput = MutationOperationSchemas.createCheckpoint.input.parse(input);
  ensureMatchingWorldline(session, parsedInput.worldlineId);

  const saved = runtime.saveCheckpoint(session.state);
  if (saved.receipt == null) {
    return noCheckpointExecution(session, saved.nextState);
  }

  const checkpointMetadata = createCheckpointMetadata(
    saved.receipt,
    parsedInput.kind,
    parsedInput.label ?? undefined,
  );
  const nextCheckpointMetadata = [...session.checkpointMetadata, checkpointMetadata];
  const nextSession = createSessionFromExisting(
    session,
    saved.nextState,
    session.tickMetadata,
    nextCheckpointMetadata,
  );
  const checkpoint = toCheckpointRecord(nextSession, checkpointMetadata);
  const result = MutationOperationSchemas.createCheckpoint.result.parse({
    worldline: nextSession.worldline,
    head: toHeadRecord(nextSession, hash),
    checkpoint,
  });

  return {
    nextSession: nextSession,
    result,
  };
}

function noReplaceRangeAsTickExecution(
  session: JeditWorldlineSession,
  nextState: HotTextBufferState,
): ReplaceRangeAsTickExecution {
  return {
    nextSession: createSessionFromExisting(session, nextState, session.tickMetadata, session.checkpointMetadata),
    result: undefined,
  };
}

function noCheckpointExecution(
  session: JeditWorldlineSession,
  nextState: HotTextBufferState,
): CreateCheckpointExecution {
  return {
    nextSession: createSessionFromExisting(session, nextState, session.tickMetadata, session.checkpointMetadata),
    result: undefined,
  };
}

type ReplaceRangeAsTickResultInput = {
  readonly nextSession: JeditWorldlineSession; readonly tickMetadata: TickMetadata; readonly receipt: TickAdmissionReceipt;
  readonly baseHeadId: string; readonly insertText: string; readonly hash: HashPort;
};
function replaceRangeAsTickResult(input: ReplaceRangeAsTickResultInput): ReplaceRangeAsTickResult {
  return MutationOperationSchemas.replaceRangeAsTick.result.parse({
    worldline: input.nextSession.worldline,
    nextHead: toHeadRecord(input.nextSession, input.hash),
    ropeRewrite: toRopeRewriteRecord(input.nextSession, input.tickMetadata),
    ropeDiff: toRopeDiffRecord(input.receipt, input.baseHeadId, input.nextSession.worldline.canonicalHeadId, input.insertText),
  });
}

function createSession(
  bufferKey: string,
  projectionPath: string,
  state: HotTextBufferState,
  tickMetadata: readonly TickMetadata[],
  checkpointMetadata: readonly CheckpointMetadata[],
): JeditWorldlineSession {
  const worldlineId = toWorldlineId(projectionPath);
  const worldline: BufferWorldline = {
    worldlineId,
    bufferKey,
    canonicalHeadId: toHeadId(state.currentRoot.id),
    projectionPath,
  };

  return new JeditWorldlineSession(worldline, state, tickMetadata, checkpointMetadata);
}

function createSessionFromExisting(
  session: JeditWorldlineSession,
  state: HotTextBufferState,
  tickMetadata: readonly TickMetadata[],
  checkpointMetadata: readonly CheckpointMetadata[],
): JeditWorldlineSession {
  return createSession(
    session.worldline.bufferKey,
    session.worldline.projectionPath ?? session.worldline.bufferKey,
    state,
    tickMetadata,
    checkpointMetadata,
  );
}

function createTickMetadata(
  receipt: TickAdmissionReceipt, baseHeadId: string, nextHeadId: string, insertText: string, author: string | undefined,
): TickMetadata {
  const startByte = receipt.replaceReceipt.replaced.start.byte;
  const endByte = receipt.replaceReceipt.replaced.end.byte;
  return {
    tickId: receipt.tickId,
    kind: REWRITE_KIND_REPLACE_RANGE_AS_TICK,
    author,
    baseHeadId,
    nextHeadId,
    startByte,
    endByte,
    insertedByteLength: byteLength(insertText),
    deletedByteLength: endByte - startByte,
  };
}

function createCheckpointMetadata(
  receipt: SaveCheckpointReceipt,
  kind: CreateCheckpointInput['kind'],
  label: string | undefined,
): CheckpointMetadata {
  return {
    checkpointId: receipt.checkpointId,
    kind,
    label,
  };
}

function toCheckpointRecords(session: JeditWorldlineSession): Checkpoint[] {
  return session.checkpointMetadata.map((metadata) => toCheckpointRecord(session, metadata));
}

function toHeadRecord(session: JeditWorldlineSession, hash: HashPort): RopeHead {
  const text = materializeRoot(session.state.currentRoot);

  return {
    headId: toHeadId(session.state.currentRoot.id),
    worldlineId: session.worldline.worldlineId,
    rootNodeId: toRootNodeId(session.state.currentRoot.id),
    byteLength: byteLength(text),
    lineCount: lineCount(text),
    utf16Length: text.length,
    equivalenceDigest: digest(text, hash),
  };
}

function toRopeRewriteRecord(session: JeditWorldlineSession, metadata: TickMetadata): RopeRewrite {
  return {
    ropeRewriteId: toTickId(metadata.tickId),
    worldlineId: session.worldline.worldlineId,
    kind: metadata.kind,
    sequenceNumber: metadata.tickId,
    author: metadata.author,
  };
}

function toRopeDiffRecord(
  receipt: TickAdmissionReceipt,
  baseHeadId: string,
  nextHeadId: string,
  insertText: string,
): RopeDiff {
  const deletedByteLength = receipt.replaceReceipt.replaced.end.byte - receipt.replaceReceipt.replaced.start.byte;

  return {
    ropeDiffId: toReceiptId(receipt.tickId),
    ropeRewriteId: toTickId(receipt.tickId),
    baseHeadId,
    nextHeadId,
    rewriteKind: REWRITE_KIND_REPLACE_RANGE_AS_TICK,
    startByte: receipt.replaceReceipt.replaced.start.byte,
    endByte: receipt.replaceReceipt.replaced.end.byte,
    insertedByteLength: byteLength(insertText),
    deletedByteLength,
    summary: formatReplaceSummary(receipt.replaceReceipt.replaced.start.byte, receipt.replaceReceipt.replaced.end.byte),
  };
}

function formatReplaceSummary(startByte: number, endByte: number): string {
  return `${REPLACE_SUMMARY_PREFIX} ${startByte}${REPLACE_SUMMARY_RANGE_SEPARATOR}${endByte}`;
}

function toCheckpointRecord(
  session: JeditWorldlineSession,
  metadata: CheckpointMetadata,
): Checkpoint {
  const checkpoint = session.state.checkpoints.find((entry) => entry.id === metadata.checkpointId);
  const headId = checkpoint == null
    ? session.worldline.canonicalHeadId
    : toHeadId(checkpoint.rootId);

  return {
    checkpointId: toCheckpointId(metadata.checkpointId),
    worldlineId: session.worldline.worldlineId,
    headId,
    kind: metadata.kind,
    label: metadata.label,
    createdByRopeRewriteId: metadata.createdByRopeRewriteId == null ? undefined : toTickId(metadata.createdByRopeRewriteId),
  };
}

function ensureMatchingWorldline(session: JeditWorldlineSession, worldlineId: string): void {
  if (session.worldline.worldlineId !== worldlineId) {
    throw new JeditContractRuntimeError(
      JeditContractRuntimeErrorCode.WorldlineMismatch,
      `Worldline mismatch: expected ${session.worldline.worldlineId}, received ${worldlineId}.`,
    );
  }
}

function ensureMatchingBaseHead(session: JeditWorldlineSession, baseHeadId: string): void {
  if (session.worldline.canonicalHeadId !== baseHeadId) {
    throw new JeditContractRuntimeError(
      JeditContractRuntimeErrorCode.BaseHeadMismatch,
      `Base head mismatch: expected ${session.worldline.canonicalHeadId}, received ${baseHeadId}.`,
    );
  }
}

function ensureStateRootId(headId: string, rootId: number): void {
  if (!Number.isFinite(rootId) || !Number.isInteger(rootId)) {
    throw new JeditContractRuntimeError(
      JeditContractRuntimeErrorCode.InvalidRootId,
      `Invalid root identifier: ${rootId}.`,
    );
  }

  if (toHeadId(rootId) !== headId) {
    throw new JeditContractRuntimeError(
      JeditContractRuntimeErrorCode.BaseHeadMismatch,
      `Canonical head mismatch: expected ${toHeadId(rootId)}, received ${headId}.`,
    );
  }
}

function ensureWorldlineId(worldlineId: string): void {
  if (parseWorldlineId(worldlineId) == null) {
    throw new JeditContractRuntimeError(
      JeditContractRuntimeErrorCode.InvalidWorldlineId,
      `Invalid worldline identifier: ${worldlineId}.`,
    );
  }
}

function ensureHeadId(headId: string): void {
  if (parseHeadId(headId) == null) {
    throw new JeditContractRuntimeError(
      JeditContractRuntimeErrorCode.InvalidHeadId,
      `Invalid head identifier: ${headId}.`,
    );
  }
}
