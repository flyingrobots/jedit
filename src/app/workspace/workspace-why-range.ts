import type { Cmd } from '@flyingrobots/bijou-tui';
import {
  NotificationPlacements,
  NotificationTones,
  NotificationVariants,
  pushNotificationToast,
} from '../../ui/feedback.js';
import type { JeditWhyByteRange, JeditWhyRangeReport } from '../../ports/jedit-why-range.js';
import { RESULT_PRODUCED } from '../../ports/jedit-why-range.js';
import type { JeditWhyReport } from './command-provenance.js';
import type { EditorState } from './editor/model.js';
import type { WorkspaceModel } from './model.js';
import { WorkspaceMessageTypes, type WorkspaceMsg } from './msg.js';
import type { ProductionTextSession } from './production-text-session.js';
import { ProductionTextSessionOutcomeKinds } from './production-text-session.js';
import type { WorkspaceRuntimeDependencies, WorkspaceRuntimeResult } from './workspace-runtime-dependencies.js';
import { byteOffsetForTextPosition } from './workspace-text-position.js';

const FIRST_ROW = 0;
const FIRST_COLUMN = 0;
const NEXT_COLUMN = 1;
const ZERO_LENGTH = 0;
const EMPTY_CHARACTER = '';
const WHY_REPORT_OBSTRUCTION_KIND = 'obstruction';

interface WorkspaceWhyRangeCommandRequest {
  readonly bufferId: string;
  readonly range: JeditWhyByteRange;
  readonly productionTextSession: ProductionTextSession;
  readonly fallbackReport: JeditWhyReport;
  readonly atMs: number;
}

interface ToastReport {
  readonly title: string;
  readonly message: string;
  readonly tone: typeof NotificationTones.Info | typeof NotificationTones.Warning;
}

export function jeditWhyRangeAtCursor(editor: EditorState | undefined): JeditWhyByteRange | undefined {
  if (editor == null) {
    return undefined;
  }
  const row = clampedRow(editor);
  const line = editor.lines[row] ?? EMPTY_CHARACTER;
  if (line.length === ZERO_LENGTH) {
    return undefined;
  }
  const anchorColumn = anchoredColumn(line, editor.cursorCol);
  if (!isWhyRangeCharacter(line[anchorColumn] ?? EMPTY_CHARACTER)) {
    return undefined;
  }
  const startColumn = scanRangeStart(line, anchorColumn);
  const endColumn = scanRangeEnd(line, anchorColumn);
  return {
    startByte: byteOffsetForTextPosition(editor.lines, { row, column: startColumn }),
    endByte: byteOffsetForTextPosition(editor.lines, { row, column: endColumn }),
  };
}

export function createWorkspaceWhyRangeCmd(
  request: WorkspaceWhyRangeCommandRequest,
): Cmd<WorkspaceMsg> {
  return async () => {
    const outcome = await request.productionTextSession.explainRange({
      bufferId: request.bufferId,
      range: request.range,
      atMs: request.atMs,
    });
    return {
      type: WorkspaceMessageTypes.WhyRangeResult,
      report: outcome.kind === ProductionTextSessionOutcomeKinds.RangeExplained ? outcome.report : undefined,
      fallbackReport: request.fallbackReport,
      atMs: request.atMs,
    };
  };
}

export function applyWorkspaceWhyRangeResult(
  deps: WorkspaceRuntimeDependencies,
  msg: Extract<WorkspaceMsg, { type: typeof WorkspaceMessageTypes.WhyRangeResult }>,
  model: WorkspaceModel,
): WorkspaceRuntimeResult {
  const report = toastReportFromWhyRange(msg.report, msg.fallbackReport);
  return pushNotificationToast(
    model,
    {
      title: report.title,
      message: report.message,
      variant: NotificationVariants.Toast,
      tone: report.tone,
      placement: NotificationPlacements.LowerRight,
    },
    msg.atMs,
    deps.createNotificationTickCmd,
  );
}

function toastReportFromWhyRange(
  rangeReport: JeditWhyRangeReport | undefined,
  fallbackReport: JeditWhyReport,
): ToastReport {
  if (rangeReport?.witness.result.kind === RESULT_PRODUCED) {
    return {
      title: rangeReport.title,
      message: rangeReport.message,
      tone: NotificationTones.Info,
    };
  }
  return {
    title: fallbackReport.title,
    message: fallbackReport.message,
    tone: fallbackReport.kind === WHY_REPORT_OBSTRUCTION_KIND ? NotificationTones.Warning : NotificationTones.Info,
  };
}

function clampedRow(editor: EditorState): number {
  return Math.max(FIRST_ROW, Math.min(editor.cursorRow, Math.max(FIRST_ROW, editor.lines.length - NEXT_COLUMN)));
}

function anchoredColumn(line: string, cursorCol: number): number {
  const clampedColumn = Math.max(FIRST_COLUMN, Math.min(cursorCol, line.length));
  return clampedColumn === line.length ? Math.max(FIRST_COLUMN, clampedColumn - NEXT_COLUMN) : clampedColumn;
}

function scanRangeStart(line: string, anchorColumn: number): number {
  let column = anchorColumn;
  while (column > FIRST_COLUMN && isWhyRangeCharacter(line[column - NEXT_COLUMN] ?? EMPTY_CHARACTER)) {
    column -= NEXT_COLUMN;
  }
  return column;
}

function scanRangeEnd(line: string, anchorColumn: number): number {
  let column = anchorColumn + NEXT_COLUMN;
  while (column < line.length && isWhyRangeCharacter(line[column] ?? EMPTY_CHARACTER)) {
    column += NEXT_COLUMN;
  }
  return column;
}

function isWhyRangeCharacter(character: string): boolean {
  return character.trim().length > ZERO_LENGTH;
}
