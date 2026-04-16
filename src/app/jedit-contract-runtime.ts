import { createHash } from 'node:crypto';

import { createTextRange, materializeRoot } from '../domain/text-edit-contract.js';
import type { SaveCheckpointReceipt } from '../domain/save-checkpoint-contract.js';
import type { TickAdmissionReceipt } from '../domain/tick-admission-contract.js';
import type { HotTextBufferState, HotTextRuntimePort } from '../ports/hot-text-runtime.js';

const JEDIT_CONTRACT_RUNTIME_ERROR_WORLDLINE_MISMATCH = 1;
const JEDIT_CONTRACT_RUNTIME_ERROR_BASE_HEAD_MISMATCH = 2;

const WORLDLINE_ID_PREFIX = 'wl:';
const HEAD_ID_PREFIX = 'head:';
const ROOT_NODE_ID_PREFIX = 'root:';
const CHECKPOINT_ID_PREFIX = 'checkpoint:';
const TICK_ID_PREFIX = 'tick:';
const RECEIPT_ID_PREFIX = 'receipt:';
const TICK_KIND_TEXT_REWRITE = 'TEXT_REWRITE';
const INITIAL_CHECKPOINT_KIND = 'INITIAL';
const EMPTY_LINE_COUNT = 1;

const UTF8_ENCODER = new TextEncoder();

export interface BufferWorldlineRecord {
  readonly worldlineId: string;
  readonly bufferKey: string;
  readonly canonicalHeadId: string;
  readonly createdAtTickId?: string;
  readonly projectionPath?: string;
}

export interface RopeHeadRecord {
  readonly headId: string;
  readonly worldlineId: string;
  readonly rootNodeId: string;
  readonly byteLength: number;
  readonly lineCount: number;
  readonly utf16Length: number;
  readonly equivalenceDigest: string;
}

export interface TickRecord {
  readonly tickId: string;
  readonly worldlineId: string;
  readonly kind: string;
  readonly sequenceNumber: number;
  readonly author?: string;
}

export interface TickReceiptRecord {
  readonly receiptId: string;
  readonly tickId: string;
  readonly baseHeadId: string;
  readonly nextHeadId: string;
  readonly rewriteKind: string;
  readonly startByte?: number;
  readonly endByte?: number;
  readonly insertedByteLength: number;
  readonly deletedByteLength: number;
  readonly inverseFragmentDigest?: string;
  readonly summary?: string;
}

export interface CheckpointRecord {
  readonly checkpointId: string;
  readonly worldlineId: string;
  readonly headId: string;
  readonly kind: string;
  readonly label?: string;
  readonly createdByTickId?: string;
}

export interface JeditWorldlineSession {
  readonly worldline: BufferWorldlineRecord;
  readonly state: HotTextBufferState;
  readonly tickMetadata: readonly TickMetadata[];
  readonly checkpointMetadata: readonly CheckpointMetadata[];
}

export interface CreateBufferWorldlineInput {
  readonly bufferKey: string;
  readonly initialText: string;
  readonly projectionPath?: string;
  readonly createInitialCheckpoint: boolean;
}

export interface CreateBufferWorldlineResult {
  readonly worldline: BufferWorldlineRecord;
  readonly head: RopeHeadRecord;
  readonly checkpoint?: CheckpointRecord;
}

export interface CreateBufferWorldlineExecution {
  readonly nextSession: JeditWorldlineSession;
  readonly result: CreateBufferWorldlineResult;
}

export interface ReplaceRangeAsTickInput {
  readonly worldlineId: string;
  readonly baseHeadId: string;
  readonly startByte: number;
  readonly endByte: number;
  readonly insertText: string;
  readonly author?: string;
}

export interface ReplaceRangeAsTickResult {
  readonly worldline: BufferWorldlineRecord;
  readonly nextHead: RopeHeadRecord;
  readonly tick: TickRecord;
  readonly receipt: TickReceiptRecord;
}

export interface ReplaceRangeAsTickExecution {
  readonly nextSession: JeditWorldlineSession;
  readonly result?: ReplaceRangeAsTickResult;
}

export interface CreateCheckpointInput {
  readonly worldlineId: string;
  readonly kind: string;
  readonly label?: string;
}

export interface CreateCheckpointResult {
  readonly worldline: BufferWorldlineRecord;
  readonly head: RopeHeadRecord;
  readonly checkpoint: CheckpointRecord;
}

export interface CreateCheckpointExecution {
  readonly nextSession: JeditWorldlineSession;
  readonly result?: CreateCheckpointResult;
}

interface TickMetadata {
  readonly tickId: number;
  readonly kind: string;
  readonly author?: string;
}

interface CheckpointMetadata {
  readonly checkpointId: number;
  readonly kind: string;
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
  const projectionPath = input.projectionPath ?? input.bufferKey;
  const initialState = runtime.createBuffer(projectionPath, input.initialText);
  const initialSession = createSession(input.bufferKey, projectionPath, initialState, [], []);

  if (!input.createInitialCheckpoint) {
    return {
      nextSession: initialSession,
      result: {
        worldline: initialSession.worldline,
        head: toHeadRecord(initialSession),
      },
    };
  }

  const saved = runtime.saveCheckpoint(initialState);
  const metadata = saved.receipt == null
    ? []
    : [createCheckpointMetadata(saved.receipt, INITIAL_CHECKPOINT_KIND, undefined)];
  const nextSession = createSession(input.bufferKey, projectionPath, saved.nextState, [], metadata);
  const checkpoint = metadata[0] == null ? undefined : toCheckpointRecord(nextSession, metadata[0]);

  return {
    nextSession,
    result: {
      worldline: nextSession.worldline,
      head: toHeadRecord(nextSession),
      checkpoint,
    },
  };
}

export function materializeWorldline(
  runtime: HotTextRuntimePort,
  session: JeditWorldlineSession,
): string {
  return runtime.materialize(session.state);
}

export function replaceRangeAsTick(
  runtime: HotTextRuntimePort,
  session: JeditWorldlineSession,
  input: ReplaceRangeAsTickInput,
): ReplaceRangeAsTickExecution {
  ensureMatchingWorldline(session, input.worldlineId);
  ensureMatchingBaseHead(session, input.baseHeadId);

  const baseHeadId = input.baseHeadId;
  const admission = runtime.admitReplaceRangeTick(
    session.state,
    createTextRange(input.startByte, input.endByte),
    input.insertText,
  );

  if (admission.receipt == null) {
    return {
      nextSession: createSessionFromExisting(session, admission.nextState, session.tickMetadata, session.checkpointMetadata),
    };
  }

  const tickMetadata = createTickMetadata(admission.receipt, input.author);
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

  return {
    nextSession,
    result: {
      worldline: nextSession.worldline,
      nextHead: toHeadRecord(nextSession),
      tick,
      receipt: toTickReceiptRecord(admission.receipt, baseHeadId, nextSession.worldline.canonicalHeadId, input.insertText),
    },
  };
}

export function createCheckpoint(
  runtime: HotTextRuntimePort,
  session: JeditWorldlineSession,
  input: CreateCheckpointInput,
): CreateCheckpointExecution {
  ensureMatchingWorldline(session, input.worldlineId);

  const saved = runtime.saveCheckpoint(session.state);
  if (saved.receipt == null) {
    return {
      nextSession: createSessionFromExisting(session, saved.nextState, session.tickMetadata, session.checkpointMetadata),
    };
  }

  const checkpointMetadata = createCheckpointMetadata(saved.receipt, input.kind, input.label);
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

  return {
    nextSession,
    result: {
      worldline: nextSession.worldline,
      head: toHeadRecord(nextSession),
      checkpoint,
    },
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
  const worldline: BufferWorldlineRecord = {
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
  kind: string,
  label: string | undefined,
): CheckpointMetadata {
  return {
    checkpointId: receipt.checkpointId,
    kind,
    label,
  };
}

function toHeadRecord(session: JeditWorldlineSession): RopeHeadRecord {
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

function toTickRecord(session: JeditWorldlineSession, metadata: TickMetadata): TickRecord {
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
): TickReceiptRecord {
  const deletedByteLength = receipt.replaceReceipt.replaced.end.byte - receipt.replaceReceipt.replaced.start.byte;

  return {
    receiptId: toReceiptId(receipt.tickId),
    tickId: toTickId(receipt.tickId),
    baseHeadId,
    nextHeadId,
    rewriteKind: 'replaceRangeAsTick',
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
): CheckpointRecord {
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
