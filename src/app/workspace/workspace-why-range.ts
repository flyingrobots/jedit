import type { Cmd } from '@flyingrobots/bijou-tui';
import type { JeditWhyByteRange } from '../../ports/jedit-why-range.js';
import { RESULT_PRODUCED } from '../../ports/jedit-why-range.js';
import type { JeditWhyReport } from './command-provenance.js';
import type { EditorState } from './editor/model.js';
import type { WorkspaceModel } from './model.js';
import {
  WorkspaceMessageTypes,
  WorkspaceWhyRangeOutcomeKinds,
  type WorkspaceMsg,
  type WorkspaceWhyRangeOutcome,
} from './msg.js';
import type { ProductionTextSession, ProductionTextWhyRangeOutcome } from './production-text-session.js';
import { ProductionTextSessionOutcomeKinds } from './production-text-session.js';
import type { WorkspaceRuntimeResult } from './workspace-runtime-dependencies.js';
import { byteOffsetForTextPosition } from './workspace-text-position.js';
import {
  anchoredWorkspaceInlinePanel,
  WORKSPACE_INLINE_PANEL_TONE,
  type WorkspaceInlinePanel,
  type WorkspaceInlinePanelAnchor,
  type WorkspaceInlinePanelTone,
  workspaceInlinePanelAtAnchor,
} from './workspace-inline-panel.js';
import { WorkspaceTextAuthorityKinds } from './workspace-text-authority.js';

export {
  WORKSPACE_INLINE_PANEL_TONE,
  workspaceInlinePanelAnchorFromEditor,
} from './workspace-inline-panel.js';

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
  readonly anchor: WorkspaceInlinePanelAnchor;
  readonly atMs: number;
}

export interface WorkspaceInlinePanelReport {
  readonly title: string;
  readonly message: string;
  readonly tone: WorkspaceInlinePanelTone;
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
    const explainOutcome = await request.productionTextSession.explainRange({
      bufferId: request.bufferId,
      range: request.range,
      atMs: request.atMs,
    });
    return {
      type: WorkspaceMessageTypes.WhyRangeResult,
      bufferId: request.bufferId,
      outcome: workspaceWhyRangeOutcomeFromProduction(explainOutcome),
      fallbackReport: request.fallbackReport,
      anchor: request.anchor,
      atMs: request.atMs,
    };
  };
}

export function applyWorkspaceWhyRangeResult(
  msg: Extract<WorkspaceMsg, { type: typeof WorkspaceMessageTypes.WhyRangeResult }>,
  model: WorkspaceModel,
): WorkspaceRuntimeResult {
  if (!whyRangeResultMatchesActiveBuffer(model, msg.bufferId)) {
    return [model, []];
  }
  const report = whyInlinePanelReportFromRange(msg.outcome, msg.fallbackReport);
  return [modelWithWorkspaceInlinePanelAtAnchor(model, report, msg.anchor), []];
}

function workspaceWhyRangeOutcomeFromProduction(
  explainOutcome: ProductionTextWhyRangeOutcome,
): WorkspaceWhyRangeOutcome {
  return explainOutcome.kind === ProductionTextSessionOutcomeKinds.RangeExplained
    ? {
        kind: WorkspaceWhyRangeOutcomeKinds.Range,
        report: explainOutcome.report,
      }
    : {
        kind: WorkspaceWhyRangeOutcomeKinds.Obstructed,
        obstruction: explainOutcome.obstruction,
      };
}

function whyRangeResultMatchesActiveBuffer(model: WorkspaceModel, bufferId: string): boolean {
  return model.textAuthority.kind === WorkspaceTextAuthorityKinds.Opened &&
    model.textAuthority.bufferId === bufferId;
}

export function modelWithWorkspaceInlinePanel(
  model: WorkspaceModel,
  report: WorkspaceInlinePanelReport,
): WorkspaceModel {
  return model.editor == null
    ? model
    : {
        ...model,
        inlinePanel: anchoredWorkspaceInlinePanel(
          model.editor,
          workspaceInlinePanelReportForModel(model, report),
        ),
      };
}

function modelWithWorkspaceInlinePanelAtAnchor(
  model: WorkspaceModel,
  report: WorkspaceInlinePanelReport,
  anchor: WorkspaceInlinePanelAnchor,
): WorkspaceModel {
  return model.editor == null ||
    model.editor.cursorRow !== anchor.row ||
    model.editor.cursorCol !== anchor.column
    ? model
    : {
        ...model,
        inlinePanel: workspaceInlinePanelAtAnchor(
          workspaceInlinePanelReportForModel(model, report),
          anchor,
        ),
      };
}

function workspaceInlinePanelReportForModel(
  model: WorkspaceModel,
  report: WorkspaceInlinePanelReport,
): Pick<WorkspaceInlinePanel, "title" | "message" | "tone" | "bufferId"> {
  return model.textAuthority.kind === WorkspaceTextAuthorityKinds.Opened
    ? { ...report, bufferId: model.textAuthority.bufferId }
    : report;
}

function whyInlinePanelReportFromRange(
  outcome: WorkspaceWhyRangeOutcome,
  fallbackReport: JeditWhyReport,
): WorkspaceInlinePanelReport {
  if (outcome.kind === WorkspaceWhyRangeOutcomeKinds.Range) {
    return {
      title: outcome.report.title,
      message: outcome.report.message,
      tone: outcome.report.witness.result.kind === RESULT_PRODUCED
        ? WORKSPACE_INLINE_PANEL_TONE.Info
        : WORKSPACE_INLINE_PANEL_TONE.Warning,
    };
  }
  if (outcome.kind === WorkspaceWhyRangeOutcomeKinds.Obstructed) {
    return {
      title: 'Why range obstructed',
      message: `${outcome.obstruction.code}: ${outcome.obstruction.issue.message}`,
      tone: WORKSPACE_INLINE_PANEL_TONE.Warning,
    };
  }
  return {
    title: fallbackReport.title,
    message: fallbackReport.message,
    tone: fallbackReport.kind === WHY_REPORT_OBSTRUCTION_KIND
      ? WORKSPACE_INLINE_PANEL_TONE.Warning
      : WORKSPACE_INLINE_PANEL_TONE.Info,
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
