import type { EditorState } from './editor/model.js';
import { EditorModes } from './editor/mode.js';

const FIRST_LINE = 0;
const FIRST_COLUMN = 0;
const EMPTY_LINE = '';
const EMPTY_STACK = Object.freeze([]);
const POSTURE_NO_TEXT = 'no-text';
const POSTURE_PENDING_OPEN = 'pending-open';
const POSTURE_OPEN_NO_READING = 'open-no-reading';
const POSTURE_CLEAN = 'clean';
const POSTURE_DIRTY = 'dirty';
const POSTURE_CHECKPOINTED = 'checkpointed';
const POSTURE_EXPORTED = 'exported';
const POSTURE_OBSTRUCTED = 'obstructed';

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

export type WorkspaceTextReadingPosture =
  typeof WorkspaceTextReadingPostures[keyof typeof WorkspaceTextReadingPostures];

export interface WorkspaceTextReadingCache {
  readonly bufferId: string;
  readonly readingId: string;
  readonly lines: readonly string[];
  readonly lineCount: number;
  readonly cursorLine: number;
  readonly viewportLineCount: number;
  readonly truncated: boolean;
}

export interface WorkspaceTextReadingProjection {
  readonly filePath: string;
  readonly readOnly: boolean;
  readonly dirty: boolean;
  readonly cache?: WorkspaceTextReadingCache;
  readonly existing?: EditorState;
}

export interface WorkspaceTextReadingCachePostureOptions {
  readonly kind: typeof POSTURE_NO_TEXT | typeof POSTURE_PENDING_OPEN | 'opened' | typeof POSTURE_OBSTRUCTED;
  readonly dirty?: boolean;
  readonly cache?: WorkspaceTextReadingCache;
  readonly lastCheckpointId?: string;
  readonly lastExportReadingId?: string;
}

export function editorFromWorkspaceTextReadingCache(
  projection: WorkspaceTextReadingProjection,
): EditorState {
  const lines = projection.cache?.lines ?? [EMPTY_LINE];
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
    undoStack: projection.existing?.undoStack ?? EMPTY_STACK,
    redoStack: projection.existing?.redoStack ?? EMPTY_STACK,
  };
}

export function materializeWorkspaceTextReadingCache(
  cache: WorkspaceTextReadingCache,
): string {
  return cache.lines.join('\n');
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
  return clampLine(projection.existing?.cursorRow ?? projection.cache?.cursorLine ?? FIRST_LINE, lines);
}

function clampLine(row: number, lines: readonly string[]): number {
  return Math.max(FIRST_LINE, Math.min(row, Math.max(FIRST_LINE, lines.length - 1)));
}
