import { createTextRange } from '../domain/text-edit-contract.js';
import type { SaveCheckpointReceipt } from '../domain/save-checkpoint-contract.js';
import type { TickAdmissionReceipt } from '../domain/tick-admission-contract.js';
import type {
  BufferWorldline,
  Checkpoint,
  CheckpointKind,
  CreateBufferWorldlineInput,
  CreateBufferWorldlineResult,
  CreateCheckpointInput,
  CreateCheckpointResult,
  ReplaceRangeAsTickInput,
  ReplaceRangeAsTickResult,
  RewriteKind,
  RopeDiff,
  RopeHead,
  RopeRewrite,
  WorldlineSnapshot as WorldlineSnapshotResult,
  WorldlineSnapshotInput,
} from '../generated/jedit/rope.wesley.generated.js';
import type {
  HotTextAuthorityTransition,
  HotTextBufferState,
  HotTextRuntimePort,
} from '../ports/hot-text-runtime.js';
import type { HashPort } from '../ports/hash.js';
import {
  byteLength,
  toCheckpointId,
  toHeadId,
  toReceiptId,
  toTickId,
} from './jedit-contract-runtime-id.js';
import {
  canonicalHeadIdForState,
  ensureSessionBasis,
  ensureWorldlineId,
  projectedHeadRecord,
  worldlineIdForState,
} from './jedit-contract-runtime-authority-basis.js';
import {
  JeditContractRuntimeError,
  JeditContractRuntimeErrorCode,
} from './jedit-contract-runtime-errors.js';
import {
  CreateBufferWorldlineInputSchema,
  CreateBufferWorldlineResultSchema,
  CreateCheckpointInputSchema,
  CreateCheckpointResultSchema,
  ReplaceRangeAsTickInputSchema,
  ReplaceRangeAsTickResultSchema,
  WorldlineSnapshotInputSchema,
  WorldlineSnapshotSchema,
} from './jedit-hot-text-json-schemas.js';
export {
  JeditContractRuntimeError,
  JeditContractRuntimeErrorCode,
} from './jedit-contract-runtime-errors.js';

const REWRITE_KIND_REPLACE_RANGE_AS_TICK: RewriteKind = 'REPLACE_RANGE_AS_TICK';
const INITIAL_CHECKPOINT_KIND: CheckpointKind = 'INITIAL';
const REPLACE_SUMMARY_PREFIX = 'replace';
const REPLACE_SUMMARY_RANGE_SEPARATOR = '..';

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
    ensureSessionBasis(worldline, state);
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
  readonly authorityTickId?: string;
  readonly authorityAdmissionId?: string;
  readonly authorityRewriteId?: string;
  readonly authorityDiffId?: string;
  readonly authoritySequenceNumber?: number;
}

interface CheckpointMetadata {
  readonly checkpointId: number;
  readonly authorityCheckpointId?: string;
  readonly authorityHeadId?: string;
  readonly kind: CreateCheckpointInput['kind'];
  readonly label?: string;
  readonly createdByRopeRewriteId?: number;
}

export function createBufferWorldline(
  runtime: HotTextRuntimePort,
  input: CreateBufferWorldlineInput,
  hash: HashPort,
): CreateBufferWorldlineExecution {
  const parsedInput = CreateBufferWorldlineInputSchema.parse(input);
  const initialText = parsedInput.initialText ?? '';
  const projectionPath = parsedInput.projectionPath ?? parsedInput.bufferKey;
  const initialState = runtime.createBuffer(projectionPath, initialText);
  const initialSession = createSession(parsedInput.bufferKey, projectionPath, initialState, [], []);

  if (!(parsedInput.createInitialCheckpoint ?? false)) {
    const result = CreateBufferWorldlineResultSchema.parse({
      worldline: initialSession.worldline,
      head: toHeadRecord(runtime, initialSession, hash),
    });
    return {
      nextSession: initialSession,
      result,
    };
  }

  const saved = runtime.saveCheckpoint(initialState, { kind: INITIAL_CHECKPOINT_KIND });
  const metadata = saved.receipt == null
    ? []
    : [createCheckpointMetadata(
      saved.receipt,
      saved.checkpointDeclaration,
      INITIAL_CHECKPOINT_KIND,
      undefined,
    )];
  const nextSession = createSession(parsedInput.bufferKey, projectionPath, saved.nextState, [], metadata);
  const checkpoint = metadata[0] == null ? undefined : toCheckpointRecord(nextSession, metadata[0]);
  const result = CreateBufferWorldlineResultSchema.parse({
    worldline: nextSession.worldline,
    head: toHeadRecord(runtime, nextSession, hash),
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
  const parsedInput = WorldlineSnapshotInputSchema.parse(input);
  ensureMatchingWorldline(session, parsedInput.worldlineId);

  const text = materializeWorldline(runtime, session);
  return WorldlineSnapshotSchema.parse({
    worldline: session.worldline,
    head: projectedHeadRecord(session.state, session.worldline.worldlineId, text, hash),
    checkpoints: toCheckpointRecords(session),
    text,
  });
}

export function replaceRangeAsTick(
  runtime: HotTextRuntimePort,
  session: JeditWorldlineSession,
  input: ReplaceRangeAsTickInput,
  hash: HashPort,
): ReplaceRangeAsTickExecution {
  const parsedInput = ReplaceRangeAsTickInputSchema.parse(input);
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

  const nextHeadId = canonicalHeadIdForState(admission.nextState);
  const tickMetadata = createTickMetadata({
    receipt: admission.receipt,
    authorityTransition: admission.authorityTransition,
    baseHeadId,
    nextHeadId,
    insertText: parsedInput.insertText,
    author: parsedInput.author ?? undefined,
  });
  const nextSession = createSessionFromExisting(
    session,
    admission.nextState,
    [...session.tickMetadata, tickMetadata],
    session.checkpointMetadata,
  );
  return {
    nextSession: nextSession,
    result: replaceRangeAsTickResult({ runtime, nextSession, tickMetadata, receipt: admission.receipt, baseHeadId, insertText: parsedInput.insertText, hash }),
  };
}

export function createCheckpoint(
  runtime: HotTextRuntimePort,
  session: JeditWorldlineSession,
  input: CreateCheckpointInput,
  hash: HashPort,
): CreateCheckpointExecution {
  const parsedInput = CreateCheckpointInputSchema.parse(input);
  ensureMatchingWorldline(session, parsedInput.worldlineId);

  const saved = runtime.saveCheckpoint(session.state, { kind: parsedInput.kind });
  if (saved.receipt == null) {
    return noCheckpointExecution(session, saved.nextState);
  }

  const checkpointMetadata = createCheckpointMetadata(
    saved.receipt,
    saved.checkpointDeclaration,
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
  const result = CreateCheckpointResultSchema.parse({
    worldline: nextSession.worldline,
    head: toHeadRecord(runtime, nextSession, hash),
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
  readonly runtime: HotTextRuntimePort;
  readonly nextSession: JeditWorldlineSession; readonly tickMetadata: TickMetadata; readonly receipt: TickAdmissionReceipt;
  readonly baseHeadId: string; readonly insertText: string; readonly hash: HashPort;
};
function replaceRangeAsTickResult(input: ReplaceRangeAsTickResultInput): ReplaceRangeAsTickResult {
  return ReplaceRangeAsTickResultSchema.parse({
    worldline: input.nextSession.worldline,
    nextHead: toHeadRecord(input.runtime, input.nextSession, input.hash),
    ropeRewrite: toRopeRewriteRecord(input.nextSession, input.tickMetadata),
    ropeDiff: toRopeDiffRecord(
      input.receipt,
      input.tickMetadata,
      input.baseHeadId,
      input.nextSession.worldline.canonicalHeadId,
      input.insertText,
    ),
  });
}

function createSession(
  bufferKey: string,
  projectionPath: string,
  state: HotTextBufferState,
  tickMetadata: readonly TickMetadata[],
  checkpointMetadata: readonly CheckpointMetadata[],
): JeditWorldlineSession {
  const worldline: BufferWorldline = {
    worldlineId: worldlineIdForState(state, projectionPath),
    bufferKey,
    canonicalHeadId: canonicalHeadIdForState(state),
    createdAtRopeRewriteId: null,
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

interface CreateTickMetadataInput {
  readonly receipt: TickAdmissionReceipt;
  readonly authorityTransition?: HotTextAuthorityTransition;
  readonly baseHeadId: string;
  readonly nextHeadId: string;
  readonly insertText: string;
  readonly author?: string;
}

function createTickMetadata(input: CreateTickMetadataInput): TickMetadata {
  const startByte = input.receipt.replaceReceipt.replaced.start.byte;
  const endByte = input.receipt.replaceReceipt.replaced.end.byte;
  return {
    tickId: input.receipt.tickId,
    kind: REWRITE_KIND_REPLACE_RANGE_AS_TICK,
    author: input.author,
    baseHeadId: input.baseHeadId,
    nextHeadId: input.nextHeadId,
    startByte,
    endByte,
    insertedByteLength: byteLength(input.insertText),
    deletedByteLength: endByte - startByte,
    authorityTickId: input.authorityTransition?.tickId,
    authorityAdmissionId: input.authorityTransition?.admissionId,
    authorityRewriteId: input.authorityTransition?.rewriteId,
    authorityDiffId: input.authorityTransition?.diffId,
    authoritySequenceNumber: input.authorityTransition?.admittedAtSequence,
  };
}

function createCheckpointMetadata(
  receipt: SaveCheckpointReceipt,
  declaration: { readonly checkpointId: string; readonly headId: string } | undefined,
  kind: CreateCheckpointInput['kind'],
  label: string | undefined,
): CheckpointMetadata {
  return {
    checkpointId: receipt.checkpointId,
    authorityCheckpointId: declaration?.checkpointId ?? receipt.authorityCheckpointId,
    authorityHeadId: declaration?.headId,
    kind,
    label,
  };
}

function toCheckpointRecords(session: JeditWorldlineSession): Checkpoint[] {
  return session.checkpointMetadata.map((metadata) => toCheckpointRecord(session, metadata));
}

function toHeadRecord(
  runtime: HotTextRuntimePort,
  session: JeditWorldlineSession,
  hash: HashPort,
): RopeHead {
  return projectedHeadRecord(
    session.state,
    session.worldline.worldlineId,
    materializeWorldline(runtime, session),
    hash,
  );
}

function toRopeRewriteRecord(session: JeditWorldlineSession, metadata: TickMetadata): RopeRewrite {
  return {
    ropeRewriteId: metadata.authorityRewriteId ?? toTickId(metadata.tickId),
    worldlineId: session.worldline.worldlineId,
    kind: metadata.kind,
    sequenceNumber: metadata.authoritySequenceNumber ?? metadata.tickId,
    author: metadata.author ?? null,
  };
}

function toRopeDiffRecord(
  receipt: TickAdmissionReceipt,
  metadata: TickMetadata,
  baseHeadId: string,
  nextHeadId: string,
  insertText: string,
): RopeDiff {
  const deletedByteLength = receipt.replaceReceipt.replaced.end.byte - receipt.replaceReceipt.replaced.start.byte;

  return {
    ropeDiffId: metadata.authorityDiffId ?? toReceiptId(receipt.tickId),
    ropeRewriteId: metadata.authorityRewriteId ?? toTickId(receipt.tickId),
    baseHeadId,
    nextHeadId,
    rewriteKind: REWRITE_KIND_REPLACE_RANGE_AS_TICK,
    startByte: receipt.replaceReceipt.replaced.start.byte,
    endByte: receipt.replaceReceipt.replaced.end.byte,
    insertedByteLength: byteLength(insertText),
    deletedByteLength,
    inverseFragmentDigest: null,
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
    checkpointId: metadata.authorityCheckpointId ?? toCheckpointId(metadata.checkpointId),
    worldlineId: session.worldline.worldlineId,
    headId: metadata.authorityHeadId ?? headId,
    kind: metadata.kind,
    label: metadata.label ?? null,
    createdByRopeRewriteId: metadata.createdByRopeRewriteId == null ? null : toTickId(metadata.createdByRopeRewriteId),
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
