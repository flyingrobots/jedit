import type { Cmd, RuntimeIssue } from '@flyingrobots/bijou-tui';
import type { ByteOffset } from '../../domain/graph-rope-types.js';
import type { TextWindowBasis } from '../../ports/text-buffer-session.js';
import type { EditorFileFingerprint, EditorFilePort } from '../../ports/editor-file.js';
import { editorFileFingerprintFromText } from '../../ports/editor-file-fingerprint.js';
import { joinLines, normalizeLines } from '../editor-lines.js';
import {
  ProductionTextSessionOutcomeKinds,
  type ProductionTextSession,
  type ProductionTextViewportAperture,
} from './production-text-session.js';
import { RuntimeIssueLevels, RuntimeIssueSources } from './runtime-issue.js';
import { WorkspaceMessageTypes, type WorkspaceMsg } from './msg.js';
import type { EditorState } from './editor/model.js';
import type { TextPosition } from './workspace-text-position.js';
import {
  WorkspaceTextResultKinds,
  type WorkspaceTextCheckpointResult,
  type WorkspaceTextEditResult,
  type WorkspaceTextExportResult,
  type WorkspaceTextOpenResult,
  type WorkspaceTextReadCommandResult,
} from './workspace-text-results.js';
import type {
  WorkspaceTextHostBasisKind,
  WorkspaceTextPendingCommandKind,
} from './workspace-text-authority.js';
import { materializationPreflightIssue } from './workspace-text-materialization-preflight.js';
import {
  WorkspaceTextOpenBasisResultKinds,
  workspaceTextOpenBasis,
} from './workspace-text-open-basis.js';
import { workspaceTextEditResultWithSettlement } from './workspace-text-wsc-settlement.js';
import { readingCache } from './workspace-text-observed-reading.js';
import { openedWorkspaceTextResult } from './workspace-text-open-result.js';
import type {
  WorkspaceTextOperationSequencer,
  WorkspaceTextOperationTarget,
} from './workspace-text-operation-sequencer.js';
const ISSUE_LEVEL_ERROR = RuntimeIssueLevels.Error;
const ISSUE_SOURCE_COMMAND = RuntimeIssueSources.Command;
const OPEN_FAILURE_PREFIX = 'Text open failed';
const EDIT_FAILURE_PREFIX = 'Text edit failed';
const CHECKPOINT_FAILURE_PREFIX = 'Text checkpoint failed';
const EXPORT_FAILURE_PREFIX = 'Text export failed';
const READ_FAILURE_PREFIX = 'Text read failed';
const CHECKPOINT_LABEL = 'interactive workspace save';
const EDIT_COMMAND_INSERT = 'insert';
const EDIT_COMMAND_REPLACE = 'replace';
const EDIT_COMMAND_DELETE = 'delete';
const INITIAL_CURSOR_LINE = 0;
const DEFAULT_VIEWPORT_LINE_COUNT = 24;
const DEFAULT_BEFORE_LINES = 0;
const DEFAULT_AFTER_LINES = 0;
const DEFAULT_MAX_BYTES = 1048576;
export const WorkspaceTextEditCommandKinds = Object.freeze({
  Insert: EDIT_COMMAND_INSERT,
  Replace: EDIT_COMMAND_REPLACE,
  Delete: EDIT_COMMAND_DELETE,
} as const);

export interface WorkspaceTextOpenCommandRequest {
  readonly requestId: number;
  readonly filePath: string;
  readonly editorFile: EditorFilePort;
  readonly productionTextSession: ProductionTextSession;
  readonly atMs: number;
  readonly aperture?: ProductionTextViewportAperture;
}

export interface WorkspaceTextCommandBase {
  readonly requestId: number;
  readonly filePath: string;
  readonly bufferId: string;
  readonly productionTextSession: ProductionTextSession;
  readonly textOperationSequencer: WorkspaceTextOperationSequencer;
  readonly atMs: number;
  readonly aperture: ProductionTextViewportAperture;
  readonly cursorAfter?: TextPosition;
  readonly provenanceKind?: WorkspaceTextPendingCommandKind;
  readonly reversedRequestId?: number;
  readonly reversedReceiptId?: string;
  readonly reachableHistoryRequestIds?: readonly number[];
}

export interface WorkspaceTextInsertCommandRequest extends WorkspaceTextCommandBase {
  readonly kind: typeof EDIT_COMMAND_INSERT;
  readonly startByte: ByteOffset;
  readonly insertText: string;
}

export interface WorkspaceTextReplaceCommandRequest extends WorkspaceTextCommandBase {
  readonly kind: typeof EDIT_COMMAND_REPLACE;
  readonly startByte: ByteOffset;
  readonly endByte: ByteOffset;
  readonly insertText: string;
}

export interface WorkspaceTextDeleteCommandRequest extends WorkspaceTextCommandBase {
  readonly kind: typeof EDIT_COMMAND_DELETE;
  readonly startByte: ByteOffset;
  readonly endByte: ByteOffset;
}

export type WorkspaceTextEditCommandRequest =
  | WorkspaceTextInsertCommandRequest
  | WorkspaceTextReplaceCommandRequest
  | WorkspaceTextDeleteCommandRequest;

interface WorkspaceTextSaveCommandRequest {
  readonly requestId: number;
  readonly filePath: string;
  readonly bufferId: string;
  readonly productionTextSession: ProductionTextSession;
  readonly textOperationSequencer: WorkspaceTextOperationSequencer;
  readonly atMs: number;
}

export interface WorkspaceTextCheckpointCommandRequest extends WorkspaceTextSaveCommandRequest {
  readonly basisHeadId: string;
}

export interface WorkspaceTextExportCommandRequest extends WorkspaceTextSaveCommandRequest, TextWindowBasis {
  readonly hostBasis: WorkspaceTextHostBasisKind;
  readonly hostFingerprint?: EditorFileFingerprint;
  readonly editorFile: EditorFilePort;
}

export interface WorkspaceTextReadCommandRequest extends TextWindowBasis {
  readonly requestId: number;
  readonly filePath: string;
  readonly bufferId: string;
  readonly productionTextSession: ProductionTextSession;
  readonly atMs: number;
  readonly aperture: ProductionTextViewportAperture;
}

export function createWorkspaceTextOpenCmd(
  request: WorkspaceTextOpenCommandRequest,
): Cmd<WorkspaceMsg> {
  return async () => ({
    type: WorkspaceMessageTypes.TextOpenResult,
    requestId: request.requestId,
    result: await openWorkspaceText(request),
  });
}

export function defaultWorkspaceTextAperture(): ProductionTextViewportAperture {
  return {
    cursorLine: INITIAL_CURSOR_LINE,
    viewportLineCount: DEFAULT_VIEWPORT_LINE_COUNT,
    beforeLines: DEFAULT_BEFORE_LINES,
    afterLines: DEFAULT_AFTER_LINES,
    maxBytes: DEFAULT_MAX_BYTES,
  };
}

export function workspaceTextApertureFromEditor(
  editor: Pick<EditorState, 'scrollRow'>,
  viewportLineCount: number,
): ProductionTextViewportAperture {
  return {
    ...defaultWorkspaceTextAperture(),
    cursorLine: Math.max(INITIAL_CURSOR_LINE, editor.scrollRow),
    viewportLineCount: Math.max(1, viewportLineCount),
  };
}

export function createWorkspaceTextEditCmd(
  request: WorkspaceTextEditCommandRequest,
): Cmd<WorkspaceMsg> {
  return async () => {
    const sequenced = await request.textOperationSequencer.sequenceEdit(
      request.productionTextSession,
      workspaceTextOperationTarget(request),
      () => editWorkspaceText(request),
    );
    const result = workspaceTextEditResultWithSettlement(request, sequenced);
    return {
      type: WorkspaceMessageTypes.TextEditResult,
      requestId: request.requestId,
      result,
    };
  };
}

export function createWorkspaceTextCheckpointCmd(
  request: WorkspaceTextCheckpointCommandRequest,
): Cmd<WorkspaceMsg> {
  return async () => {
    const result = await request.textOperationSequencer.sequenceCheckpoint(
      request.productionTextSession,
      workspaceTextOperationTarget(request),
      () => checkpointWorkspaceText(request),
    );
    return {
      type: WorkspaceMessageTypes.TextCheckpointResult,
      requestId: request.requestId,
      result,
    };
  };
}

export function createWorkspaceTextExportCmd(
  request: WorkspaceTextExportCommandRequest,
): Cmd<WorkspaceMsg> {
  return async () => {
    const result = await request.textOperationSequencer.sequenceExport(
      request.productionTextSession,
      workspaceTextOperationTarget(request),
      () => exportWorkspaceText(request),
    );
    return {
      type: WorkspaceMessageTypes.TextExportResult,
      requestId: request.requestId,
      result,
    };
  };
}

function workspaceTextOperationTarget(
  request: WorkspaceTextOperationTarget,
): WorkspaceTextOperationTarget {
  return {
    filePath: request.filePath,
    bufferId: request.bufferId,
    requestId: request.requestId,
    ...(request.reversedRequestId == null ? {} : { reversedRequestId: request.reversedRequestId }),
    ...(request.reachableHistoryRequestIds == null
      ? {}
      : { reachableHistoryRequestIds: request.reachableHistoryRequestIds }),
  };
}

export function createWorkspaceTextReadCmd(
  request: WorkspaceTextReadCommandRequest,
): Cmd<WorkspaceMsg> {
  return async () => ({
    type: WorkspaceMessageTypes.TextReadResult,
    requestId: request.requestId,
    result: await readWorkspaceText(request),
  });
}

async function openWorkspaceText(
  request: WorkspaceTextOpenCommandRequest,
): Promise<WorkspaceTextOpenResult> {
  try {
    const basisResult = workspaceTextOpenBasis(request);
    if (basisResult.kind === WorkspaceTextOpenBasisResultKinds.Obstructed) {
      return obstructedOpen(request.filePath, basisResult.issue);
    }
    const basis = basisResult.basis;
    const opened = await request.productionTextSession.openBuffer({
      bufferKey: request.filePath,
      initialText: basis.initialText,
      projectionPath: request.filePath,
      atMs: request.atMs,
    });
    if (opened.kind === ProductionTextSessionOutcomeKinds.Obstructed) {
      return obstructedOpen(request.filePath, opened.obstruction.issue);
    }
    const observed = await request.productionTextSession.observeWindow({
      bufferId: opened.optic.buffer.bufferId, ...opened.textBasis,
      aperture: request.aperture ?? defaultWorkspaceTextAperture(),
      atMs: request.atMs,
    });
    if (observed.kind === ProductionTextSessionOutcomeKinds.Obstructed) {
      return obstructedOpen(request.filePath, observed.obstruction.issue);
    }
    return openedWorkspaceTextResult(
      request,
      basis,
      opened.optic.buffer.bufferId,
      observed.observed.value,
    );
  } catch (cause) {
    return obstructedOpen(
      request.filePath,
      runtimeIssue(`${OPEN_FAILURE_PREFIX}: ${cause instanceof Error ? cause.message : String(cause)}`, request.atMs),
    );
  }
}

async function editWorkspaceText(
  request: WorkspaceTextEditCommandRequest,
): Promise<WorkspaceTextEditResult> {
  try {
    const edited = await applyWorkspaceTextEdit(request);
    if (edited.kind === ProductionTextSessionOutcomeKinds.Obstructed) {
      return obstructedEdit(request.filePath, edited.obstruction.issue);
    }
    const observed = await request.productionTextSession.observeWindow({
      bufferId: request.bufferId, ...edited.result.textBasis,
      aperture: request.aperture,
      atMs: request.atMs,
    });
    if (observed.kind === ProductionTextSessionOutcomeKinds.Obstructed) {
      return obstructedEdit(request.filePath, observed.obstruction.issue);
    }
    const cache = readingCache(request.bufferId, observed.observed.value);
    return {
      kind: WorkspaceTextResultKinds.Applied,
      filePath: request.filePath,
      bufferId: request.bufferId,
      receiptId: edited.result.receiptId,
      causalTransition: edited.result.causalTransition,
      cache,
      cursorAfter: request.cursorAfter,
    };
  } catch (cause) {
    return obstructedEdit(
      request.filePath,
      runtimeIssue(`${EDIT_FAILURE_PREFIX}: ${cause instanceof Error ? cause.message : String(cause)}`, request.atMs),
    );
  }
}

function applyWorkspaceTextEdit(request: WorkspaceTextEditCommandRequest) {
  if (request.kind === EDIT_COMMAND_INSERT) {
    return request.productionTextSession.insertText({
      bufferId: request.bufferId,
      startByte: request.startByte,
      insertText: request.insertText,
      atMs: request.atMs,
    });
  }
  if (request.kind === EDIT_COMMAND_REPLACE) {
    return request.productionTextSession.replaceRange({
      bufferId: request.bufferId,
      startByte: request.startByte,
      endByte: request.endByte,
      insertText: request.insertText,
      atMs: request.atMs,
    });
  }
  return request.productionTextSession.deleteRange({
    bufferId: request.bufferId,
    startByte: request.startByte,
    endByte: request.endByte,
    atMs: request.atMs,
  });
}

async function checkpointWorkspaceText(
  request: WorkspaceTextCheckpointCommandRequest,
): Promise<WorkspaceTextCheckpointResult> {
  try {
    const checkpointed = await request.productionTextSession.checkpointBuffer({
      bufferId: request.bufferId,
      basisHeadId: request.basisHeadId,
      label: CHECKPOINT_LABEL,
      atMs: request.atMs,
    });
    if (checkpointed.kind === ProductionTextSessionOutcomeKinds.Obstructed) {
      return obstructedCheckpoint(request.filePath, checkpointed.obstruction.issue);
    }
    return {
      kind: WorkspaceTextResultKinds.Checkpointed,
      filePath: request.filePath,
      bufferId: request.bufferId,
      checkpointId: checkpointed.result.checkpointId,
      basisHeadId: checkpointed.result.textBasis.basisHeadId,
    };
  } catch (cause) {
    return obstructedCheckpoint(
      request.filePath,
      runtimeIssue(`${CHECKPOINT_FAILURE_PREFIX}: ${cause instanceof Error ? cause.message : String(cause)}`, request.atMs),
    );
  }
}

async function exportWorkspaceText(
  request: WorkspaceTextExportCommandRequest,
): Promise<WorkspaceTextExportResult> {
  try {
    const exported = await request.productionTextSession.exportSnapshot({
      bufferId: request.bufferId,
      basisHeadId: request.basisHeadId,
      byteRange: request.byteRange,
      atMs: request.atMs,
    });
    if (exported.kind === ProductionTextSessionOutcomeKinds.Obstructed) {
      return obstructedExport(request.filePath, exported.obstruction.issue);
    }
    const preflightIssue = materializationPreflightIssue(request);
    if (preflightIssue != null) {
      return obstructedExport(request.filePath, preflightIssue);
    }
    const savedLines = normalizeLines(exported.text);
    request.editorFile.saveEditorFile(request.filePath, savedLines);
    return {
      kind: WorkspaceTextResultKinds.Exported,
      filePath: request.filePath,
      bufferId: request.bufferId,
      readingId: exported.readingId,
      basisHeadId: exported.basisHeadId,
      hostFingerprint: editorFileFingerprintFromText(joinLines(savedLines)),
    };
  } catch (cause) {
    return obstructedExport(
      request.filePath,
      runtimeIssue(`${EXPORT_FAILURE_PREFIX}: ${cause instanceof Error ? cause.message : String(cause)}`, request.atMs),
    );
  }
}

async function readWorkspaceText(
  request: WorkspaceTextReadCommandRequest,
): Promise<WorkspaceTextReadCommandResult> {
  try {
    const observed = await request.productionTextSession.observeWindow({
      bufferId: request.bufferId,
      basisHeadId: request.basisHeadId,
      byteRange: request.byteRange,
      aperture: request.aperture,
      atMs: request.atMs,
    });
    if (observed.kind === ProductionTextSessionOutcomeKinds.Obstructed) {
      return obstructedRead(request.filePath, observed.obstruction.issue);
    }
    return {
      kind: WorkspaceTextResultKinds.Read,
      filePath: request.filePath,
      bufferId: request.bufferId,
      cache: readingCache(request.bufferId, observed.observed.value),
    };
  } catch (cause) {
    return obstructedRead(
      request.filePath,
      runtimeIssue(`${READ_FAILURE_PREFIX}: ${cause instanceof Error ? cause.message : String(cause)}`, request.atMs),
    );
  }
}

function obstructedOpen(filePath: string, issue: RuntimeIssue): WorkspaceTextOpenResult {
  return {
    kind: WorkspaceTextResultKinds.Obstructed,
    filePath,
    issue,
  };
}

function obstructedEdit(filePath: string, issue: RuntimeIssue): WorkspaceTextEditResult {
  return {
    kind: WorkspaceTextResultKinds.Obstructed,
    filePath,
    issue,
  };
}

function obstructedCheckpoint(filePath: string, issue: RuntimeIssue): WorkspaceTextCheckpointResult {
  return {
    kind: WorkspaceTextResultKinds.Obstructed,
    filePath,
    issue,
  };
}

function obstructedExport(filePath: string, issue: RuntimeIssue): WorkspaceTextExportResult {
  return {
    kind: WorkspaceTextResultKinds.Obstructed,
    filePath,
    issue,
  };
}

function obstructedRead(filePath: string, issue: RuntimeIssue): WorkspaceTextReadCommandResult {
  return {
    kind: WorkspaceTextResultKinds.Obstructed,
    filePath,
    issue,
  };
}

function runtimeIssue(message: string, atMs: number): RuntimeIssue {
  return {
    message,
    level: ISSUE_LEVEL_ERROR,
    source: ISSUE_SOURCE_COMMAND,
    atMs,
  };
}
