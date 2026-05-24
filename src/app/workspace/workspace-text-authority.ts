import type { RuntimeIssue } from '@flyingrobots/bijou-tui';
import type { TextRuntimeProfile } from '../text-runtime-profile.js';
import type { EditorState } from './editor/model.js';
import { EditorModes } from './editor/mode.js';

const AUTHORITY_NONE = 'none';
const AUTHORITY_PENDING_OPEN = 'pending-open';
const AUTHORITY_OPENED = 'opened';
const AUTHORITY_OBSTRUCTED = 'obstructed';
const FIRST_LINE = 0;
const FIRST_COLUMN = 0;
const EMPTY_LINE = '';
const EMPTY_STACK = Object.freeze([]);

export const WorkspaceTextAuthorityKinds = Object.freeze({
  None: AUTHORITY_NONE,
  PendingOpen: AUTHORITY_PENDING_OPEN,
  Opened: AUTHORITY_OPENED,
  Obstructed: AUTHORITY_OBSTRUCTED,
} as const);

export type WorkspaceTextAuthorityKind =
  typeof WorkspaceTextAuthorityKinds[keyof typeof WorkspaceTextAuthorityKinds];

export interface WorkspaceTextReadingCache {
  readonly bufferId: string;
  readonly readingId: string;
  readonly lines: readonly string[];
  readonly lineCount: number;
  readonly cursorLine: number;
  readonly viewportLineCount: number;
  readonly truncated: boolean;
}

export interface WorkspaceTextAuthorityNone {
  readonly kind: typeof AUTHORITY_NONE;
  readonly profile: TextRuntimeProfile;
}

export interface WorkspaceTextAuthorityPendingOpen {
  readonly kind: typeof AUTHORITY_PENDING_OPEN;
  readonly profile: TextRuntimeProfile;
  readonly requestId: number;
  readonly filePath: string;
  readonly atMs: number;
}

export interface WorkspaceTextAuthorityOpened {
  readonly kind: typeof AUTHORITY_OPENED;
  readonly profile: TextRuntimeProfile;
  readonly filePath: string;
  readonly bufferId: string;
  readonly readOnly: boolean;
  readonly dirty: boolean;
  readonly cache?: WorkspaceTextReadingCache;
  readonly lastReceiptId?: string;
  readonly lastCheckpointId?: string;
  readonly lastExportReadingId?: string;
}

export interface WorkspaceTextAuthorityObstructed {
  readonly kind: typeof AUTHORITY_OBSTRUCTED;
  readonly profile: TextRuntimeProfile;
  readonly filePath: string;
  readonly requestId: number;
  readonly issue: RuntimeIssue;
}

export interface OpenedWorkspaceTextAuthorityOptions {
  readonly profile: TextRuntimeProfile;
  readonly filePath: string;
  readonly bufferId: string;
  readonly readOnly: boolean;
  readonly dirty: boolean;
  readonly cache?: WorkspaceTextReadingCache;
  readonly lastReceiptId?: string;
  readonly lastCheckpointId?: string;
  readonly lastExportReadingId?: string;
}

export type WorkspaceTextAuthority =
  | WorkspaceTextAuthorityNone
  | WorkspaceTextAuthorityPendingOpen
  | WorkspaceTextAuthorityOpened
  | WorkspaceTextAuthorityObstructed;

export function createWorkspaceTextAuthority(profile: TextRuntimeProfile): WorkspaceTextAuthorityNone {
  return {
    kind: AUTHORITY_NONE,
    profile,
  };
}

export function pendingWorkspaceTextOpen(
  profile: TextRuntimeProfile,
  filePath: string,
  requestId: number,
  atMs: number,
): WorkspaceTextAuthorityPendingOpen {
  return {
    kind: AUTHORITY_PENDING_OPEN,
    profile,
    requestId,
    filePath,
    atMs,
  };
}

export function openedWorkspaceTextAuthority(
  options: OpenedWorkspaceTextAuthorityOptions,
): WorkspaceTextAuthorityOpened {
  return {
    kind: AUTHORITY_OPENED,
    profile: options.profile,
    filePath: options.filePath,
    bufferId: options.bufferId,
    readOnly: options.readOnly,
    dirty: options.dirty,
    cache: options.cache,
    lastReceiptId: options.lastReceiptId,
    lastCheckpointId: options.lastCheckpointId,
    lastExportReadingId: options.lastExportReadingId,
  };
}

export function obstructedWorkspaceTextAuthority(
  profile: TextRuntimeProfile,
  filePath: string,
  requestId: number,
  issue: RuntimeIssue,
): WorkspaceTextAuthorityObstructed {
  return {
    kind: AUTHORITY_OBSTRUCTED,
    profile,
    filePath,
    requestId,
    issue,
  };
}

export function workspaceTextAuthorityWithCache(
  authority: WorkspaceTextAuthorityOpened,
  cache: WorkspaceTextReadingCache,
): WorkspaceTextAuthorityOpened {
  return {
    ...authority,
    cache,
  };
}

export function workspaceTextAuthorityWithReceipt(
  authority: WorkspaceTextAuthorityOpened,
  receiptId: string,
): WorkspaceTextAuthorityOpened {
  return {
    ...authority,
    dirty: true,
    lastReceiptId: receiptId,
  };
}

export function workspaceTextAuthorityWithCheckpoint(
  authority: WorkspaceTextAuthorityOpened,
  checkpointId: string,
): WorkspaceTextAuthorityOpened {
  return {
    ...authority,
    dirty: false,
    lastCheckpointId: checkpointId,
  };
}

export function workspaceTextAuthorityWithExport(
  authority: WorkspaceTextAuthorityOpened,
  readingId: string,
): WorkspaceTextAuthorityOpened {
  return {
    ...authority,
    dirty: false,
    lastExportReadingId: readingId,
  };
}

export function isWorkspaceTextAuthorityOpened(
  authority: WorkspaceTextAuthority,
): authority is WorkspaceTextAuthorityOpened {
  return authority.kind === AUTHORITY_OPENED;
}

export function editorFromWorkspaceTextCache(
  authority: WorkspaceTextAuthorityOpened,
  existing: EditorState | undefined,
): EditorState {
  const lines = authority.cache?.lines ?? [EMPTY_LINE];
  return {
    path: authority.filePath,
    lines,
    cursorRow: editorCursorRow(authority, existing, lines),
    cursorCol: existing?.cursorCol ?? FIRST_COLUMN,
    scrollRow: existing?.scrollRow ?? FIRST_LINE,
    scrollCol: existing?.scrollCol ?? FIRST_COLUMN,
    dirty: authority.dirty,
    readOnly: authority.readOnly,
    mode: existing?.mode ?? EditorModes.Normal,
    pendingNormal: existing?.pendingNormal,
    register: existing?.register,
    undoStack: existing?.undoStack ?? EMPTY_STACK,
    redoStack: existing?.redoStack ?? EMPTY_STACK,
  };
}

function editorCursorRow(
  authority: WorkspaceTextAuthorityOpened,
  existing: EditorState | undefined,
  lines: readonly string[],
): number {
  return clampLine(existing?.cursorRow ?? authority.cache?.cursorLine ?? FIRST_LINE, lines);
}

function clampLine(row: number, lines: readonly string[]): number {
  return Math.max(FIRST_LINE, Math.min(row, Math.max(FIRST_LINE, lines.length - 1)));
}
