import type { RuntimeIssue } from '@flyingrobots/bijou-tui';
import {
  byteOffsetFromUtf16Offset,
  makeUtf16Offset,
} from '../../domain/graph-rope-coordinates.js';
import type { ByteOffset, CoordinateResult } from '../../domain/graph-rope-types.js';
import type {
  ProductionTextSession,
  ProductionTextViewportAperture,
} from './production-text-session.js';
import { ProductionTextSessionOutcomeKinds } from './production-text-session.js';

const DEFAULT_BUFFER_KEY = 'agent-production-text.md';
const DEFAULT_INITIAL_TEXT = '';
const DEFAULT_INSERT_TEXT = 'hello Echo';
const DEFAULT_PROJECTION_PATH = 'agent-production-text.md';
const DEFAULT_AT_MS = 0;
const DEFAULT_CURSOR_LINE = 0;
const DEFAULT_VIEWPORT_LINE_COUNT = 8;
const DEFAULT_BEFORE_LINES = 0;
const DEFAULT_AFTER_LINES = 0;
const DEFAULT_MAX_BYTES = 4096;
const WITNESS_STATUS_APPLIED = 'applied';
const WITNESS_STATUS_OBSTRUCTED = 'obstructed';
const WITNESS_STAGE_OPEN = 'open';
const WITNESS_STAGE_EDIT = 'edit';
const WITNESS_STAGE_CHECKPOINT = 'checkpoint';
const WITNESS_STAGE_READING = 'reading';
const WITNESS_STAGE_EXPORT = 'export';
const WITNESS_OPEN_RESULT_OPENED = 'opened';
const RETENTION_ROLE_RECEIPT = 'receipt';
const RETENTION_ROLE_CHECKPOINT = 'checkpoint';
const RETENTION_ROLE_READING = 'reading';
const RETENTION_ROLE_EXPORT = 'export';
const APP_FACING_SESSION_PORT = 'TextBufferSessionPort';
const APP_FACING_BUFFER_CAPABILITY = 'TextBufferOptic';

export interface ProductionTextSessionWitnessOptions {
  readonly session: ProductionTextSession;
  readonly bufferKey?: string;
  readonly initialText?: string;
  readonly insertText?: string;
  readonly projectionPath?: string | null;
  readonly atMs?: number;
  readonly aperture?: ProductionTextViewportAperture;
}

export interface ProductionTextSessionWitnessFactory {
  createSession(): ProductionTextSession;
}

export interface ProductionTextWitnessAuthority {
  readonly appFacingSessionPort: typeof APP_FACING_SESSION_PORT;
  readonly appFacingBufferCapability: typeof APP_FACING_BUFFER_CAPABILITY;
  readonly exposesTrustedLifecycle: false;
  readonly exposesTickAuthority: false;
}

export interface ProductionTextRetentionRef {
  readonly role: string;
  readonly id: string;
}

export interface ProductionTextWitnessApplied {
  readonly status: typeof WITNESS_STATUS_APPLIED;
  readonly authority: ProductionTextWitnessAuthority;
  readonly bufferId: string;
  readonly receiptId: string;
  readonly checkpointId: string;
  readonly readingId: string;
  readonly exportedText: string;
  readonly retentionRefs: readonly ProductionTextRetentionRef[];
  readonly durableRetentionClaim: false;
}

export interface ProductionTextWitnessObstructed {
  readonly status: typeof WITNESS_STATUS_OBSTRUCTED;
  readonly stage: ProductionTextWitnessStage;
  readonly authority: ProductionTextWitnessAuthority;
  readonly issue: RuntimeIssue;
}

export type ProductionTextWitnessStage =
  | typeof WITNESS_STAGE_OPEN
  | typeof WITNESS_STAGE_EDIT
  | typeof WITNESS_STAGE_CHECKPOINT
  | typeof WITNESS_STAGE_READING
  | typeof WITNESS_STAGE_EXPORT;

export type ProductionTextSessionWitnessReport =
  | ProductionTextWitnessApplied
  | ProductionTextWitnessObstructed;

export interface ProductionTextReplayReport {
  readonly first: ProductionTextSessionWitnessReport;
  readonly second: ProductionTextSessionWitnessReport;
  readonly sameSemanticIdentity: boolean;
  readonly durableReplayClaim: false;
}

interface NormalizedProductionTextSessionWitnessOptions extends Required<ProductionTextSessionWitnessOptions> {}

interface ProductionTextWitnessOpenApplied {
  readonly kind: typeof WITNESS_OPEN_RESULT_OPENED;
  readonly bufferId: string;
}

type ProductionTextWitnessOpenResult =
  | ProductionTextWitnessOpenApplied
  | ProductionTextWitnessObstructed;

export async function runProductionTextSessionWitness(
  options: ProductionTextSessionWitnessOptions,
): Promise<ProductionTextSessionWitnessReport> {
  const request = normalizeWitnessOptions(options);
  const opened = await openWitnessBuffer(request);
  return isWitnessOpenApplied(opened)
    ? completeWitness(request, opened.bufferId)
    : opened;
}

function isWitnessOpenApplied(
  result: ProductionTextWitnessOpenResult,
): result is ProductionTextWitnessOpenApplied {
  return 'kind' in result && result.kind === WITNESS_OPEN_RESULT_OPENED;
}

async function openWitnessBuffer(
  request: NormalizedProductionTextSessionWitnessOptions,
): Promise<ProductionTextWitnessOpenResult> {
  const opened = await request.session.openBuffer({
    bufferKey: request.bufferKey,
    initialText: request.initialText,
    projectionPath: request.projectionPath,
    atMs: request.atMs,
  });
  if (opened.kind === ProductionTextSessionOutcomeKinds.Obstructed) {
    return obstructed(WITNESS_STAGE_OPEN, opened.obstruction.issue);
  }
  return {
    kind: WITNESS_OPEN_RESULT_OPENED,
    bufferId: opened.optic.buffer.bufferId,
  };
}

async function completeWitness(
  request: NormalizedProductionTextSessionWitnessOptions,
  bufferId: string,
): Promise<ProductionTextSessionWitnessReport> {
  const edited = await request.session.insertText({
    bufferId,
    startByte: byteOffsetAtEnd(request.initialText),
    insertText: request.insertText,
    atMs: request.atMs,
  });
  if (edited.kind === ProductionTextSessionOutcomeKinds.Obstructed) {
    return obstructed(WITNESS_STAGE_EDIT, edited.obstruction.issue);
  }
  const observed = await request.session.observeWindow({ bufferId, aperture: request.aperture, atMs: request.atMs });
  if (observed.kind === ProductionTextSessionOutcomeKinds.Obstructed) {
    return obstructed(WITNESS_STAGE_READING, observed.obstruction.issue);
  }
  const exported = await request.session.exportSnapshot({ bufferId, atMs: request.atMs });
  if (exported.kind === ProductionTextSessionOutcomeKinds.Obstructed) {
    return obstructed(WITNESS_STAGE_EXPORT, exported.obstruction.issue);
  }
  const checkpointed = await request.session.checkpointBuffer({
    bufferId,
    basisHeadId: exported.basisHeadId,
    atMs: request.atMs,
  });
  if (checkpointed.kind === ProductionTextSessionOutcomeKinds.Obstructed) {
    return obstructed(WITNESS_STAGE_CHECKPOINT, checkpointed.obstruction.issue);
  }
  return appliedWitnessReport(bufferId, edited.result.receiptId, checkpointed.result.checkpointId, observed.observed.evidence.readingId, exported.text);
}

function byteOffsetAtEnd(text: string): ByteOffset {
  const utf16Offset = requiredCoordinate(makeUtf16Offset(text.length));
  return requiredCoordinate(byteOffsetFromUtf16Offset(text, utf16Offset));
}

function requiredCoordinate<TValue>(result: CoordinateResult<TValue>): TValue {
  if (!result.ok) {
    throw new ProductionTextWitnessCoordinateError(result.code);
  }
  return result.value;
}

class ProductionTextWitnessCoordinateError extends Error {
  public constructor(code: string) {
    super(`Invalid production text witness coordinate: ${code}.`);
    this.name = 'ProductionTextWitnessCoordinateError';
  }
}

function appliedWitnessReport(
  bufferId: string,
  receiptId: string,
  checkpointId: string,
  readingId: string,
  exportedText: string,
): ProductionTextWitnessApplied {
  return {
    status: WITNESS_STATUS_APPLIED,
    authority: witnessAuthority(),
    bufferId,
    receiptId,
    checkpointId,
    readingId,
    exportedText,
    retentionRefs: retentionRefs(receiptId, checkpointId, readingId),
    durableRetentionClaim: false,
  };
}

export async function compareProductionTextSessionReplay(
  factory: ProductionTextSessionWitnessFactory,
  options: Omit<ProductionTextSessionWitnessOptions, 'session'> = {},
): Promise<ProductionTextReplayReport> {
  const first = await runProductionTextSessionWitness({ ...options, session: factory.createSession() });
  const second = await runProductionTextSessionWitness({ ...options, session: factory.createSession() });
  return {
    first,
    second,
    sameSemanticIdentity: semanticIdentity(first) === semanticIdentity(second),
    durableReplayClaim: false,
  };
}

function normalizeWitnessOptions(
  options: ProductionTextSessionWitnessOptions,
): NormalizedProductionTextSessionWitnessOptions {
  return {
    session: options.session,
    bufferKey: options.bufferKey ?? DEFAULT_BUFFER_KEY,
    initialText: options.initialText ?? DEFAULT_INITIAL_TEXT,
    insertText: options.insertText ?? DEFAULT_INSERT_TEXT,
    projectionPath: options.projectionPath ?? DEFAULT_PROJECTION_PATH,
    atMs: options.atMs ?? DEFAULT_AT_MS,
    aperture: options.aperture ?? defaultAperture(),
  };
}

function defaultAperture(): ProductionTextViewportAperture {
  return {
    cursorLine: DEFAULT_CURSOR_LINE,
    viewportLineCount: DEFAULT_VIEWPORT_LINE_COUNT,
    beforeLines: DEFAULT_BEFORE_LINES,
    afterLines: DEFAULT_AFTER_LINES,
    maxBytes: DEFAULT_MAX_BYTES,
  };
}

function obstructed(
  stage: ProductionTextWitnessStage,
  issue: RuntimeIssue,
): ProductionTextWitnessObstructed {
  return {
    status: WITNESS_STATUS_OBSTRUCTED,
    stage,
    authority: witnessAuthority(),
    issue,
  };
}

function retentionRefs(
  receiptId: string,
  checkpointId: string,
  readingId: string,
): readonly ProductionTextRetentionRef[] {
  return [
    { role: RETENTION_ROLE_RECEIPT, id: receiptId },
    { role: RETENTION_ROLE_CHECKPOINT, id: checkpointId },
    { role: RETENTION_ROLE_READING, id: readingId },
    { role: RETENTION_ROLE_EXPORT, id: readingId },
  ];
}

function semanticIdentity(report: ProductionTextSessionWitnessReport): string {
  return report.status === WITNESS_STATUS_APPLIED
    ? `${report.receiptId}|${report.checkpointId}|${report.exportedText}`
    : `${report.stage}|${report.issue.message}`;
}

function witnessAuthority(): ProductionTextWitnessAuthority {
  return {
    appFacingSessionPort: APP_FACING_SESSION_PORT,
    appFacingBufferCapability: APP_FACING_BUFFER_CAPABILITY,
    exposesTrustedLifecycle: false,
    exposesTickAuthority: false,
  };
}
