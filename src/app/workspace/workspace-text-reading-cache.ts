import type { EditorState } from './editor/model.js';
import type { HotTextWindowProjection } from '../../ports/text-window-projection.js';
import type { TextWindowBasis } from '../../ports/text-authority-evidence.js';
import type { JeditTextWindowMaterializationProvenance } from '../../ports/jedit-text-window-materialization.js';
import { EditorModes } from './editor/mode.js';
import type { WorkspaceModel } from './model.js';
import type { WorkspaceTextAuthorityOpened } from './workspace-text-authority.js';

const FIRST_LINE = 0;
const FIRST_COLUMN = 0;
const EMPTY_LINE = '';
const POSTURE_NO_TEXT = 'no-text';
const POSTURE_PENDING_OPEN = 'pending-open';
const POSTURE_OPEN_NO_READING = 'open-no-reading';
const POSTURE_CLEAN = 'clean';
const POSTURE_DIRTY = 'dirty';
const POSTURE_CHECKPOINTED = 'checkpointed';
const POSTURE_EXPORTED = 'exported';
const POSTURE_OBSTRUCTED = 'obstructed';
const COVERAGE_FULL = 'full';
const COVERAGE_WINDOW = 'window';
const FULL_READING_START_LINE = 0;

export const WorkspaceTextReadingPostures = Object.freeze({
  NoText: POSTURE_NO_TEXT,
  PendingOpen: POSTURE_PENDING_OPEN,
  OpenNoReading: POSTURE_OPEN_NO_READING,
  Clean: POSTURE_CLEAN,
  Dirty: POSTURE_DIRTY,
  Checkpointed: POSTURE_CHECKPOINTED,
  Exported: POSTURE_EXPORTED,
  Obstructed: POSTURE_OBSTRUCTED,
} as const);

export const WorkspaceTextReadingCoverages = Object.freeze({
  Full: COVERAGE_FULL,
  Window: COVERAGE_WINDOW,
} as const);

export type WorkspaceTextReadingPosture =
  typeof WorkspaceTextReadingPostures[keyof typeof WorkspaceTextReadingPostures];
export type WorkspaceTextReadingCoverage =
  typeof WorkspaceTextReadingCoverages[keyof typeof WorkspaceTextReadingCoverages];

export interface WorkspaceTextReadingCacheBase {
  readonly bufferId: string;
  readonly readingId: string;
  readonly textBasis: TextWindowBasis;
  readonly projection?: HotTextWindowProjection;
  readonly materialization: JeditTextWindowMaterializationProvenance;
  readonly lines: readonly string[];
  readonly coverage: WorkspaceTextReadingCoverage;
  readonly lineCount: number;
  readonly startLine: number;
  readonly returnedLineCount: number;
  readonly totalLineCount: number;
  readonly hasMoreBefore: boolean;
  readonly hasMoreAfter: boolean;
  readonly cursorLine: number;
  readonly viewportLineCount: number;
  readonly truncated: boolean;
}

export interface WorkspaceTextFullReadingCache extends WorkspaceTextReadingCacheBase {
  readonly coverage: typeof COVERAGE_FULL;
}

export interface WorkspaceTextWindowReadingCache extends WorkspaceTextReadingCacheBase {
  readonly coverage: typeof COVERAGE_WINDOW;
}

export type WorkspaceTextReadingCache =
  | WorkspaceTextFullReadingCache
  | WorkspaceTextWindowReadingCache;

export interface WorkspaceTextReadingProjection {
  readonly filePath: string;
  readonly readOnly: boolean;
  readonly dirty: boolean;
  readonly lines: readonly string[];
  readonly existing?: EditorState;
}

export interface WorkspaceTextReadingCachePostureOptions {
  readonly kind: typeof POSTURE_NO_TEXT | typeof POSTURE_PENDING_OPEN | 'opened' | typeof POSTURE_OBSTRUCTED;
  readonly dirty?: boolean;
  readonly cache?: WorkspaceTextReadingCache;
  readonly lastCheckpointId?: string;
  readonly lastExportReadingId?: string;
}

export interface WorkspaceTextReadingCoverageOptions {
  readonly startLine: number;
  readonly returnedLineCount: number;
  readonly totalLineCount: number;
  readonly hasMoreBefore: boolean;
  readonly hasMoreAfter: boolean;
  readonly truncated: boolean;
}

export function editorFromWorkspaceTextLines(
  projection: WorkspaceTextReadingProjection,
): EditorState {
  const lines = projection.lines.length === 0 ? [EMPTY_LINE] : projection.lines;
  return {
    path: projection.filePath,
    lines,
    cursorRow: editorCursorRow(projection, lines),
    cursorCol: projection.existing?.cursorCol ?? FIRST_COLUMN,
    scrollRow: projection.existing?.scrollRow ?? FIRST_LINE,
    scrollCol: projection.existing?.scrollCol ?? FIRST_COLUMN,
    dirty: projection.dirty,
    readOnly: projection.readOnly,
    mode: projection.existing?.mode ?? EditorModes.Normal,
    pendingNormal: projection.existing?.pendingNormal,
    pendingVimKeys: undefined,
    register: projection.existing?.register,
    registers: projection.existing?.registers,
    lastVimEdit: projection.existing?.lastVimEdit,
    marks: projection.existing?.marks,
    lastSearch: projection.existing?.lastSearch,
  };
}

export function editorFromFullWorkspaceTextReadingCache(
  projection: Omit<WorkspaceTextReadingProjection, 'lines'> & {
    readonly cache: WorkspaceTextFullReadingCache;
  },
): EditorState {
  return editorFromWorkspaceTextLines({
    ...projection,
    lines: projection.cache.lines,
  });
}

export function materializeWorkspaceTextReadingCache(
  cache: WorkspaceTextFullReadingCache,
): string {
  return cache.lines.join('\n');
}

export function canReadingReplaceWholeEditor(
  cache: WorkspaceTextReadingCache | undefined,
): cache is WorkspaceTextFullReadingCache {
  return cache?.coverage === COVERAGE_FULL;
}

export function workspaceModelWithTextAuthorityEditor(
  model: WorkspaceModel,
  textAuthority: WorkspaceTextAuthorityOpened,
): WorkspaceModel {
  return {
    ...model,
    textAuthority,
    editor: editorForTextAuthority(model, textAuthority),
  };
}

export function workspaceTextReadingCoverage(
  options: WorkspaceTextReadingCoverageOptions,
): WorkspaceTextReadingCoverage {
  return isFullCoverage(options) ? COVERAGE_FULL : COVERAGE_WINDOW;
}

export function workspaceTextReadingCachePosture(
  options: WorkspaceTextReadingCachePostureOptions,
): WorkspaceTextReadingPosture {
  if (options.kind === POSTURE_NO_TEXT) {
    return POSTURE_NO_TEXT;
  }
  if (options.kind === POSTURE_PENDING_OPEN) {
    return POSTURE_PENDING_OPEN;
  }
  if (options.kind === POSTURE_OBSTRUCTED) {
    return POSTURE_OBSTRUCTED;
  }
  if (options.cache == null) {
    return POSTURE_OPEN_NO_READING;
  }
  if (options.dirty === true) {
    return POSTURE_DIRTY;
  }
  if (options.lastCheckpointId != null) {
    return POSTURE_CHECKPOINTED;
  }
  return options.lastExportReadingId != null ? POSTURE_EXPORTED : POSTURE_CLEAN;
}

function editorCursorRow(
  projection: WorkspaceTextReadingProjection,
  lines: readonly string[],
): number {
  return clampLine(projection.existing?.cursorRow ?? FIRST_LINE, lines);
}

function editorForTextAuthority(
  model: WorkspaceModel,
  authority: WorkspaceTextAuthorityOpened,
): EditorState | undefined {
  if (canReadingReplaceWholeEditor(authority.cache)) {
    return editorFromFullWorkspaceTextReadingCache({ ...authority, cache: authority.cache, existing: model.editor });
  }
  if (model.editor == null) {
    return undefined;
  }
  return {
    ...model.editor,
    path: authority.filePath,
    dirty: authority.dirty,
    readOnly: authority.readOnly,
  };
}

function clampLine(row: number, lines: readonly string[]): number {
  return Math.max(FIRST_LINE, Math.min(row, Math.max(FIRST_LINE, lines.length - 1)));
}

function isFullCoverage(
  options: WorkspaceTextReadingCoverageOptions,
): boolean {
  return options.startLine === FULL_READING_START_LINE
    && options.hasMoreBefore !== true
    && options.hasMoreAfter !== true
    && options.truncated !== true
    && options.returnedLineCount === options.totalLineCount;
}
