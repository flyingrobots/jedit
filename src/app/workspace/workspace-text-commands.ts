import type { Cmd, RuntimeIssue } from '@flyingrobots/bijou-tui';
import type { EditorFilePort } from '../../ports/editor-file.js';
import { joinLines } from '../editor-lines.js';
import type {
  ProductionTextSession,
  ProductionTextViewportAperture,
} from './production-text-session.js';
import { ProductionTextSessionOutcomeKinds } from './production-text-session.js';
import { RuntimeIssueLevels, RuntimeIssueSources } from './runtime-issue.js';
import { WorkspaceMessageTypes, type WorkspaceMsg } from './msg.js';
import type { WorkspaceTextReadingCache } from './workspace-text-authority.js';
import {
  WorkspaceTextResultKinds,
  type WorkspaceTextOpenResult,
} from './workspace-text-results.js';

const ISSUE_LEVEL_ERROR = RuntimeIssueLevels.Error;
const ISSUE_SOURCE_COMMAND = RuntimeIssueSources.Command;
const OPEN_FAILURE_PREFIX = 'Text open failed';
const INITIAL_CURSOR_LINE = 0;
const DEFAULT_VIEWPORT_LINE_COUNT = 24;
const DEFAULT_BEFORE_LINES = 0;
const DEFAULT_AFTER_LINES = 0;
const DEFAULT_MAX_BYTES = 1048576;

export interface WorkspaceTextOpenCommandRequest {
  readonly requestId: number;
  readonly filePath: string;
  readonly editorFile: EditorFilePort;
  readonly productionTextSession: ProductionTextSession;
  readonly atMs: number;
  readonly aperture?: ProductionTextViewportAperture;
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

async function openWorkspaceText(
  request: WorkspaceTextOpenCommandRequest,
): Promise<WorkspaceTextOpenResult> {
  try {
    const loaded = request.editorFile.loadEditorFile(request.filePath);
    const opened = await request.productionTextSession.openBuffer({
      bufferKey: request.filePath,
      initialText: joinLines(loaded.lines),
      projectionPath: request.filePath,
      atMs: request.atMs,
    });
    if (opened.kind === ProductionTextSessionOutcomeKinds.Obstructed) {
      return obstructedOpen(request.filePath, opened.obstruction.issue);
    }
    const observed = await request.productionTextSession.observeWindow({
      bufferId: opened.optic.buffer.bufferId,
      aperture: request.aperture ?? defaultWorkspaceTextAperture(),
      atMs: request.atMs,
    });
    if (observed.kind === ProductionTextSessionOutcomeKinds.Obstructed) {
      return obstructedOpen(request.filePath, observed.obstruction.issue);
    }
    return {
      kind: WorkspaceTextResultKinds.Opened,
      filePath: request.filePath,
      bufferId: opened.optic.buffer.bufferId,
      readOnly: loaded.readOnly,
      cache: readingCache(opened.optic.buffer.bufferId, observed.observed.value),
    };
  } catch (cause) {
    return obstructedOpen(
      request.filePath,
      runtimeIssue(`${OPEN_FAILURE_PREFIX}: ${cause instanceof Error ? cause.message : String(cause)}`, request.atMs),
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

export function readingCache(
  bufferId: string,
  reading: {
    readonly readingId: string;
    readonly lines: readonly { readonly text: string }[];
    readonly lineCount: number;
    readonly cursorLine: number;
    readonly viewportLineCount: number;
    readonly truncated: boolean;
  },
): WorkspaceTextReadingCache {
  return {
    bufferId,
    readingId: reading.readingId,
    lines: reading.lines.map((line) => line.text),
    lineCount: reading.lineCount,
    cursorLine: reading.cursorLine,
    viewportLineCount: reading.viewportLineCount,
    truncated: reading.truncated,
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
