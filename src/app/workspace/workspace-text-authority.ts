import type { RuntimeIssue } from '@flyingrobots/bijou-tui';
import type { EditorFileFingerprint } from '../../ports/editor-file.js';
import type { TextRuntimeProfile } from '../text-runtime-profile.js';
import type { EditorState } from './editor/model.js';
import {
  WorkspaceWorldlineMaterializationKinds,
  type WorkspaceWorldlineMaterializationKind,
} from './worldline-types.js';
import {
  editorFromWorkspaceTextReadingCache,
  WorkspaceTextReadingPostures,
  workspaceTextReadingCachePosture,
  type WorkspaceTextReadingCache,
  type WorkspaceTextReadingPosture,
} from './workspace-text-reading-cache.js';

const AUTHORITY_NONE = 'none';
const AUTHORITY_PENDING_OPEN = 'pending-open';
const AUTHORITY_OPENED = 'opened';
const AUTHORITY_OBSTRUCTED = 'obstructed';
const HOST_BASIS_FILE = 'file';
const HOST_BASIS_MISSING = 'missing';

export const WorkspaceTextAuthorityKinds = Object.freeze({
  None: AUTHORITY_NONE,
  PendingOpen: AUTHORITY_PENDING_OPEN,
  Opened: AUTHORITY_OPENED,
  Obstructed: AUTHORITY_OBSTRUCTED,
} as const);

export const WorkspaceTextHostBasisKinds = Object.freeze({
  File: HOST_BASIS_FILE,
  Missing: HOST_BASIS_MISSING,
} as const);

export type WorkspaceTextAuthorityKind =
  typeof WorkspaceTextAuthorityKinds[keyof typeof WorkspaceTextAuthorityKinds];
export type WorkspaceTextHostBasisKind =
  typeof WorkspaceTextHostBasisKinds[keyof typeof WorkspaceTextHostBasisKinds];

export type { WorkspaceTextReadingCache } from './workspace-text-reading-cache.js';

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
  readonly materialization: WorkspaceWorldlineMaterializationKind;
  readonly hostBasis: WorkspaceTextHostBasisKind;
  readonly hostFingerprint?: EditorFileFingerprint;
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
  readonly materialization?: WorkspaceWorldlineMaterializationKind;
  readonly hostBasis?: WorkspaceTextHostBasisKind;
  readonly hostFingerprint?: EditorFileFingerprint;
  readonly cache?: WorkspaceTextReadingCache;
  readonly lastReceiptId?: string;
  readonly lastCheckpointId?: string;
  readonly lastExportReadingId?: string;
}

interface WorkspaceTextMaterializationOptions {
  readonly dirty: boolean;
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
    materialization: options.materialization ?? materializationFromOptions(options),
    hostBasis: options.hostBasis ?? WorkspaceTextHostBasisKinds.File,
    hostFingerprint: options.hostFingerprint,
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
    materialization: WorkspaceWorldlineMaterializationKinds.Unmaterialized,
    lastReceiptId: receiptId,
  };
}

export function workspaceTextAuthorityWithPendingEdit(
  authority: WorkspaceTextAuthorityOpened,
): WorkspaceTextAuthorityOpened {
  return {
    ...authority,
    dirty: true,
    materialization: WorkspaceWorldlineMaterializationKinds.Unmaterialized,
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
  hostFingerprint: EditorFileFingerprint,
): WorkspaceTextAuthorityOpened {
  return {
    ...authority,
    dirty: false,
    hostBasis: WorkspaceTextHostBasisKinds.File,
    hostFingerprint,
    materialization: WorkspaceWorldlineMaterializationKinds.Materialized,
    lastExportReadingId: readingId,
  };
}

export function isWorkspaceTextAuthorityOpened(
  authority: WorkspaceTextAuthority,
): authority is WorkspaceTextAuthorityOpened {
  return authority.kind === AUTHORITY_OPENED;
}

function materializationFromOptions(
  options: WorkspaceTextMaterializationOptions,
): WorkspaceWorldlineMaterializationKind {
  return options.dirty
    ? WorkspaceWorldlineMaterializationKinds.Unmaterialized
    : WorkspaceWorldlineMaterializationKinds.Materialized;
}

export function editorFromWorkspaceTextCache(
  authority: WorkspaceTextAuthorityOpened,
  existing: EditorState | undefined,
): EditorState {
  return editorFromWorkspaceTextReadingCache({
    filePath: authority.filePath,
    dirty: authority.dirty,
    readOnly: authority.readOnly,
    cache: authority.cache,
    existing,
  });
}

export function workspaceTextAuthorityPosture(
  authority: WorkspaceTextAuthority,
): WorkspaceTextReadingPosture {
  if (authority.kind === AUTHORITY_OPENED) {
    return workspaceTextReadingCachePosture({
      kind: authority.kind,
      dirty: authority.dirty,
      cache: authority.cache,
      lastCheckpointId: authority.lastCheckpointId,
      lastExportReadingId: authority.lastExportReadingId,
    });
  }
  return workspaceTextReadingCachePosture({
    kind: authority.kind === AUTHORITY_NONE
      ? WorkspaceTextReadingPostures.NoText
      : authority.kind,
  });
}
