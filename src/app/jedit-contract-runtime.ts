import { createHash } from 'node:crypto';

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
  Tick,
  TickKind,
  TickReceiptRewriteKind,
  TickReceipt,
} from '../generated/jedit/hot-text-runtime.types.generated.js';
import {
  MutationOperationSchemas,
  QueryOperationSchemas,
} from '../generated/jedit/hot-text-runtime.zod.generated.js';
import type { HotTextBufferState, HotTextRuntimePort } from '../ports/hot-text-runtime.js';

const JEDIT_CONTRACT_RUNTIME_ERROR_WORLDLINE_MISMATCH = 1;
const JEDIT_CONTRACT_RUNTIME_ERROR_BASE_HEAD_MISMATCH = 2;

const WORLDLINE_ID_PREFIX = 'wl:';
const HEAD_ID_PREFIX = 'head:';
const ROOT_NODE_ID_PREFIX = 'root:';
const CHECKPOINT_ID_PREFIX = 'checkpoint:';
const TICK_ID_PREFIX = 'tick:';
const RECEIPT_ID_PREFIX = 'receipt:';
const TICK_KIND_TEXT_REWRITE: TickKind = 'TEXT_REWRITE';
const TICK_RECEIPT_REWRITE_KIND_REPLACE_RANGE_AS_TICK: TickReceiptRewriteKind = 'REPLACE_RANGE_AS_TICK';
const INITIAL_CHECKPOINT_KIND: CheckpointKind = 'INITIAL';
const EMPTY_LINE_COUNT = 1;

const UTF8_ENCODER = new TextEncoder();

type CreateBufferWorldlineInput = MutationOperationMap['createBufferWorldline']['input'];
type CreateBufferWorldlineResult = MutationOperationMap['createBufferWorldline']['result'];
type ReplaceRangeAsTickInput = MutationOperationMap['replaceRangeAsTick']['input'];
type ReplaceRangeAsTickResult = MutationOperationMap['replaceRangeAsTick']['result'];
type CreateCheckpointInput = MutationOperationMap['createCheckpoint']['input'];
type CreateCheckpointResult = MutationOperationMap['createCheckpoint']['result'];
type WorldlineSnapshotInput = QueryOperationMap['worldlineSnapshot']['input'];
type WorldlineSnapshotResult = QueryOperationMap['worldlineSnapshot']['result'];

export interface JeditWorldlineSession {
  readonly worldline: BufferWorldline;
  readonly state: HotTextBufferState;
  readonly tickMetadata: readonly TickMetadata[];
  readonly checkpointMetadata: readonly CheckpointMetadata[];
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

interface TickMetadata {
  readonly tickId: number;
  readonly kind: TickKind;
  readonly author?: string;
}

interface CheckpointMetadata {
  readonly checkpointId: number;
  readonly kind: CreateCheckpointInput['kind'];
  readonly label?: string;
  readonly createdByTickId?: number;
}

export class JeditContractRuntimeError extends Error {
  public readonly code: number;

  public constructor(code: number, message: string) {
    super(message);
    this.name = 'JeditContractRuntimeError';
    this.code = code;
  }
}

export function createBufferWorldline(
  runtime: HotTextRuntimePort,
  input: CreateBufferWorldlineInput,
): CreateBufferWorldlineExecution {
  const parsedInput = MutationOperationSchemas.createBufferWorldline.input.parse(input);
  const initialText = parsedInput.initialText ?? '';
  const projectionPath = parsedInput.projectionPath ?? parsedInput.bufferKey;
  const initialState = runtime.createBuffer(projectionPath, initialText);
  const initialSession = createSession(parsedInput.bufferKey, projectionPath, initialState, [], []);

  if (!(parsedInput.createInitialCheckpoint ?? false)) {
    const result = MutationOperationSchemas.createBufferWorldline.result.parse({
      worldline: initialSession.worldline,
      head: toHeadRecord(initialSession),
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
    head: toHeadRecord(nextSession),
    checkpoint,
  });

  return {
    nextSession,
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
): WorldlineSnapshotResult {
  const parsedInput = QueryOperationSchemas.worldlineSnapshot.input.parse(input);
  ensureMatchingWorldline(session, parsedInput.worldlineId);

  return QueryOperationSchemas.worldlineSnapshot.result.parse({
    worldline: session.worldline,
    head: toHeadRecord(session),
    checkpoints: toCheckpointRecords(session),
    text: materializeWorldline(runtime, session),
  });
}

export function replaceRangeAsTick(
  runtime: HotTextRuntimePort,
  session: JeditWorldlineSession,
  input: ReplaceRangeAsTickInput,
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
    return {
      nextSession: createSessionFromExisting(session, admission.nextState, session.tickMetadata, session.checkpointMetadata),
    };
  }

  const tickMetadata = createTickMetadata(admission.receipt, parsedInput.author ?? undefined);
  const nextTickMetadata = [
    ...session.tickMetadata,
    tickMetadata,
  ];
  const nextSession = createSessionFromExisting(
    session,
    admission.nextState,
    nextTickMetadata,
    session.checkpointMetadata,
  );
  const tick = toTickRecord(nextSession, tickMetadata);
  const result = MutationOperationSchemas.replaceRangeAsTick.result.parse({
    worldline: nextSession.worldline,
    nextHead: toHeadRecord(nextSession),
    tick,
    receipt: toTickReceiptRecord(
      admission.receipt,
      baseHeadId,
      nextSession.worldline.canonicalHeadId,
      parsedInput.insertText,
    ),
  });

  return {
    nextSession,
    result,
  };
}

export function createCheckpoint(
  runtime: HotTextRuntimePort,
  session: JeditWorldlineSession,
  input: CreateCheckpointInput,
): CreateCheckpointExecution {
  const parsedInput = MutationOperationSchemas.createCheckpoint.input.parse(input);
  ensureMatchingWorldline(session, parsedInput.worldlineId);

  const saved = runtime.saveCheckpoint(session.state);
  if (saved.receipt == null) {
    return {
      nextSession: createSessionFromExisting(session, saved.nextState, session.tickMetadata, session.checkpointMetadata),
    };
  }

  const checkpointMetadata = createCheckpointMetadata(
    saved.receipt,
    parsedInput.kind,
    parsedInput.label ?? undefined,
  );
  const nextCheckpointMetadata = [
    ...session.checkpointMetadata,
    checkpointMetadata,
  ];
  const nextSession = createSessionFromExisting(
    session,
    saved.nextState,
    session.tickMetadata,
    nextCheckpointMetadata,
  );
  const checkpoint = toCheckpointRecord(nextSession, checkpointMetadata);
  const result = MutationOperationSchemas.createCheckpoint.result.parse({
    worldline: nextSession.worldline,
    head: toHeadRecord(nextSession),
    checkpoint,
  });

  return {
    nextSession,
    result,
  };
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

  return {
    worldline,
    state,
    tickMetadata: [...tickMetadata],
    checkpointMetadata: [...checkpointMetadata],
  };
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

function createTickMetadata(receipt: TickAdmissionReceipt, author: string | undefined): TickMetadata {
  return {
    tickId: receipt.tickId,
    kind: TICK_KIND_TEXT_REWRITE,
    author,
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

function toHeadRecord(session: JeditWorldlineSession): RopeHead {
  const text = materializeRoot(session.state.currentRoot);

  return {
    headId: toHeadId(session.state.currentRoot.id),
    worldlineId: session.worldline.worldlineId,
    rootNodeId: toRootNodeId(session.state.currentRoot.id),
    byteLength: byteLength(text),
    lineCount: lineCount(text),
    utf16Length: text.length,
    equivalenceDigest: digest(text),
  };
}

function toTickRecord(session: JeditWorldlineSession, metadata: TickMetadata): Tick {
  return {
    tickId: toTickId(metadata.tickId),
    worldlineId: session.worldline.worldlineId,
    kind: metadata.kind,
    sequenceNumber: metadata.tickId,
    author: metadata.author,
  };
}

function toTickReceiptRecord(
  receipt: TickAdmissionReceipt,
  baseHeadId: string,
  nextHeadId: string,
  insertText: string,
): TickReceipt {
  const deletedByteLength = receipt.replaceReceipt.replaced.end.byte - receipt.replaceReceipt.replaced.start.byte;

  return {
    receiptId: toReceiptId(receipt.tickId),
    tickId: toTickId(receipt.tickId),
    baseHeadId,
    nextHeadId,
    rewriteKind: TICK_RECEIPT_REWRITE_KIND_REPLACE_RANGE_AS_TICK,
    startByte: receipt.replaceReceipt.replaced.start.byte,
    endByte: receipt.replaceReceipt.replaced.end.byte,
    insertedByteLength: byteLength(insertText),
    deletedByteLength,
    summary: `replace ${receipt.replaceReceipt.replaced.start.byte}..${receipt.replaceReceipt.replaced.end.byte}`,
  };
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
    createdByTickId: metadata.createdByTickId == null ? undefined : toTickId(metadata.createdByTickId),
  };
}

function ensureMatchingWorldline(session: JeditWorldlineSession, worldlineId: string): void {
  if (session.worldline.worldlineId !== worldlineId) {
    throw new JeditContractRuntimeError(
      JEDIT_CONTRACT_RUNTIME_ERROR_WORLDLINE_MISMATCH,
      `Worldline mismatch: expected ${session.worldline.worldlineId}, received ${worldlineId}.`,
    );
  }
}

function ensureMatchingBaseHead(session: JeditWorldlineSession, baseHeadId: string): void {
  if (session.worldline.canonicalHeadId !== baseHeadId) {
    throw new JeditContractRuntimeError(
      JEDIT_CONTRACT_RUNTIME_ERROR_BASE_HEAD_MISMATCH,
      `Base head mismatch: expected ${session.worldline.canonicalHeadId}, received ${baseHeadId}.`,
    );
  }
}

function toWorldlineId(path: string): string {
  return `${WORLDLINE_ID_PREFIX}${path}`;
}

function toHeadId(rootId: number): string {
  return `${HEAD_ID_PREFIX}${rootId}`;
}

function toRootNodeId(rootId: number): string {
  return `${ROOT_NODE_ID_PREFIX}${rootId}`;
}

function toCheckpointId(checkpointId: number): string {
  return `${CHECKPOINT_ID_PREFIX}${checkpointId}`;
}

function toTickId(tickId: number): string {
  return `${TICK_ID_PREFIX}${tickId}`;
}

function toReceiptId(tickId: number): string {
  return `${RECEIPT_ID_PREFIX}${toTickId(tickId)}`;
}

function byteLength(text: string): number {
  return UTF8_ENCODER.encode(text).length;
}

function lineCount(text: string): number {
  if (text.length === 0) {
    return EMPTY_LINE_COUNT;
  }

  return text.split('\n').length;
}

function digest(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}
