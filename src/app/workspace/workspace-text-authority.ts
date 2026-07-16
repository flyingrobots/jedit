import type { RuntimeIssue } from '@flyingrobots/bijou-tui';
import type { EditorFileFingerprint } from '../../ports/editor-file.js';
import type { TextBufferCausalTransition } from '../../ports/text-buffer-session.js';
import type { TextRuntimeProfile } from '../text-runtime-profile.js';
import type { EditorState } from './editor/model.js';
import type {
  JeditCommandEvent,
  JeditPlannedCommandEvent,
} from './command-provenance.js';
import {
  openedWorkspaceBufferDurability,
  workspaceBufferDurabilityWithAdmittedTransition,
  workspaceBufferDurabilityWithCheckpoint,
  workspaceBufferDurabilityWithExport,
  workspaceBufferDurabilityWithPendingIntent,
  workspaceBufferDurabilityWithPendingStatus,
  workspaceBufferFileDirty,
  WorkspaceTextIntentStatuses,
  type WorkspaceBufferDurability,
  type WorkspaceTextIntentStatus,
  type WorkspaceTextPendingCommandKind,
} from './workspace-buffer-durability.js';
import {
  WorkspaceWorldlineMaterializationKinds,
  type WorkspaceWorldlineMaterializationKind,
} from './worldline-types.js';
import {
  editorFromFullWorkspaceTextReadingCache,
  WorkspaceTextReadingPostures,
  workspaceTextReadingCachePosture,
  type WorkspaceTextFullReadingCache,
  type WorkspaceTextReadingCache,
  type WorkspaceTextReadingPosture,
} from './workspace-text-reading-cache.js';
import { workspaceTextProjectionMatchesLines } from './workspace-text-observed-reading.js';

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

export {
  WorkspaceTextIntentStatuses,
  WorkspaceTextPendingCommandKinds,
} from './workspace-buffer-durability.js';
export type {
  WorkspaceTextIntentStatus,
  WorkspaceTextPendingCommandKind,
} from './workspace-buffer-durability.js';

export type { WorkspaceTextReadingCache } from './workspace-text-reading-cache.js';
export { canReadingReplaceWholeEditor } from './workspace-text-reading-cache.js';

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
  readonly durability: WorkspaceBufferDurability;
  readonly materialization: WorkspaceWorldlineMaterializationKind;
  readonly hostBasis: WorkspaceTextHostBasisKind;
  readonly hostFingerprint?: EditorFileFingerprint;
  readonly cache?: WorkspaceTextReadingCache;
  readonly pendingClientSeq?: number;
  readonly pendingCommandKind?: WorkspaceTextPendingCommandKind;
  readonly pendingCommandEvent?: JeditPlannedCommandEvent;
  readonly pendingReceiptId?: string;
  readonly pendingIntentStatus?: WorkspaceTextIntentStatus;
  readonly blockedByClientSeq?: number;
  readonly lastObstruction?: RuntimeIssue;
  readonly lastCommandEvent?: JeditCommandEvent;
  readonly lastReceiptId?: string;
  readonly lastCausalTransition?: TextBufferCausalTransition;
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
  readonly durability?: WorkspaceBufferDurability;
  readonly materialization?: WorkspaceWorldlineMaterializationKind;
  readonly hostBasis?: WorkspaceTextHostBasisKind;
  readonly hostAbsenceBasisHeadId?: string;
  readonly hostFingerprint?: EditorFileFingerprint;
  readonly cache?: WorkspaceTextReadingCache;
  readonly pendingClientSeq?: number;
  readonly pendingCommandKind?: WorkspaceTextPendingCommandKind;
  readonly pendingCommandEvent?: JeditPlannedCommandEvent;
  readonly pendingReceiptId?: string;
  readonly pendingIntentStatus?: WorkspaceTextIntentStatus;
  readonly blockedByClientSeq?: number;
  readonly lastObstruction?: RuntimeIssue;
  readonly lastCommandEvent?: JeditCommandEvent;
  readonly lastReceiptId?: string;
  readonly lastCausalTransition?: TextBufferCausalTransition;
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
  const materialization = options.materialization ?? materializationFromOptions(options);
  const hostBasis = options.hostBasis ?? WorkspaceTextHostBasisKinds.File;
  const durability = options.durability ?? openedWorkspaceBufferDurability({
    basisHeadId: options.cache?.textBasis?.basisHeadId,
    hostAbsenceBasisHeadId: options.hostAbsenceBasisHeadId,
    hostBasis,
    materialization,
    hostFingerprint: options.hostFingerprint,
  });
  return {
    kind: AUTHORITY_OPENED,
    profile: options.profile,
    filePath: options.filePath,
    bufferId: options.bufferId,
    readOnly: options.readOnly,
    dirty: workspaceBufferFileDirty(durability) ?? options.dirty,
    durability,
    materialization,
    hostBasis,
    hostFingerprint: options.hostFingerprint,
    cache: options.cache,
    pendingClientSeq: options.pendingClientSeq,
    pendingCommandKind: options.pendingCommandKind,
    pendingCommandEvent: options.pendingCommandEvent,
    pendingReceiptId: options.pendingReceiptId,
    pendingIntentStatus: options.pendingIntentStatus,
    blockedByClientSeq: options.blockedByClientSeq,
    lastObstruction: options.lastObstruction,
    lastCommandEvent: options.lastCommandEvent,
    lastReceiptId: options.lastReceiptId,
    lastCausalTransition: options.lastCausalTransition,
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

export function projectedSourceWindow(authority: WorkspaceTextAuthorityOpened) {
  const cache = authority.cache;
  if (cache?.projection == null || !projectionMatchesAuthority(authority, cache)) {
    return undefined;
  }
  return {
    startLine: cache.startLine,
    lineCount: cache.returnedLineCount,
    totalLineCount: cache.totalLineCount,
    hasMoreBefore: cache.hasMoreBefore,
    hasMoreAfter: cache.hasMoreAfter,
    lines: cache.lines.map((text, index) => ({ lineNumber: cache.startLine + index, text })),
  };
}

export function hasVisibleOptimisticText(authority: WorkspaceTextAuthorityOpened): boolean {
  const status = authority.pendingIntentStatus;
  return status != null && (
    status !== WorkspaceTextIntentStatuses.Admitted || projectedSourceWindow(authority) == null
  );
}

function projectionMatchesAuthority(
  authority: WorkspaceTextAuthorityOpened,
  cache: WorkspaceTextReadingCache,
): boolean {
  const latestHeadId = authority.lastCausalTransition?.nextHeadId;
  return cache.bufferId === authority.bufferId
    && cache.projection != null
    && cache.materialization != null
    && cache.materialization.key.basis.headId === cache.projection.basisHeadId
    && workspaceTextProjectionMatchesLines(cache.projection, cache.lines)
    && (latestHeadId == null || cache.projection.basisHeadId === latestHeadId);
}

export function workspaceTextAuthorityWithReceipt(
  authority: WorkspaceTextAuthorityOpened,
  receiptId: string,
  causalTransition?: TextBufferCausalTransition,
): WorkspaceTextAuthorityOpened {
  const durability = workspaceBufferDurabilityWithAdmittedTransition(
    authority.durability,
    causalTransition == null
      ? undefined
      : {
        receiptId,
        admittedTickId: causalTransition.admittedTickId,
        nextHeadId: causalTransition.nextHeadId,
      },
  );
  return {
    ...authority,
    dirty: workspaceBufferFileDirty(durability) ?? authority.dirty,
    durability,
    materialization: WorkspaceWorldlineMaterializationKinds.Unmaterialized,
    pendingCommandEvent: undefined,
    pendingReceiptId: receiptId,
    pendingIntentStatus: WorkspaceTextIntentStatuses.Admitted,
    lastReceiptId: receiptId,
    ...(causalTransition == null ? {} : { lastCausalTransition: causalTransition }),
  };
}

export function workspaceTextAuthorityWithPendingEdit(
  authority: WorkspaceTextAuthorityOpened,
  pendingClientSeq: number,
  pendingCommandKind?: WorkspaceTextPendingCommandKind,
  pendingCommandEvent?: JeditPlannedCommandEvent,
): WorkspaceTextAuthorityOpened {
  const durability = workspaceBufferDurabilityWithPendingIntent(
    authority.durability,
    pendingClientSeq,
    WorkspaceTextIntentStatuses.Predicted,
    pendingCommandKind,
  );
  return {
    ...authority,
    dirty: workspaceBufferFileDirty(durability) ?? authority.dirty,
    durability,
    materialization: WorkspaceWorldlineMaterializationKinds.Unmaterialized,
    pendingClientSeq,
    pendingCommandKind,
    pendingCommandEvent,
    pendingIntentStatus: WorkspaceTextIntentStatuses.Predicted,
    lastObstruction: undefined,
    lastCommandEvent: pendingCommandEvent?.event ?? authority.lastCommandEvent,
  };
}

export function workspaceTextAuthorityWithLastCommandEvent(
  authority: WorkspaceTextAuthorityOpened,
  lastCommandEvent: JeditCommandEvent,
): WorkspaceTextAuthorityOpened {
  return {
    ...authority,
    pendingCommandEvent: undefined,
    lastCommandEvent,
  };
}

export function workspaceTextAuthorityWithObstruction(
  authority: WorkspaceTextAuthorityOpened,
  pendingClientSeq: number,
  issue: RuntimeIssue,
): WorkspaceTextAuthorityOpened {
  const durability = workspaceBufferDurabilityWithPendingStatus(
    authority.durability,
    authority.pendingClientSeq ?? pendingClientSeq,
    WorkspaceTextIntentStatuses.Obstructed,
  );
  return {
    ...authority,
    dirty: workspaceBufferFileDirty(durability) ?? authority.dirty,
    durability,
    materialization: WorkspaceWorldlineMaterializationKinds.Unmaterialized,
    pendingClientSeq: authority.pendingClientSeq ?? pendingClientSeq,
    pendingIntentStatus: WorkspaceTextIntentStatuses.Obstructed,
    blockedByClientSeq: pendingClientSeq,
    lastObstruction: issue,
  };
}

export function workspaceTextAuthorityWithBlockedIntent(
  authority: WorkspaceTextAuthorityOpened,
): WorkspaceTextAuthorityOpened {
  const durability = workspaceBufferDurabilityWithPendingStatus(
    authority.durability,
    authority.pendingClientSeq,
    WorkspaceTextIntentStatuses.Blocked,
  );
  return {
    ...authority,
    dirty: workspaceBufferFileDirty(durability) ?? authority.dirty,
    durability,
    materialization: WorkspaceWorldlineMaterializationKinds.Unmaterialized,
    pendingIntentStatus: WorkspaceTextIntentStatuses.Blocked,
  };
}

export function workspaceTextAuthorityWithCheckpoint(
  authority: WorkspaceTextAuthorityOpened,
  checkpointId: string,
  basisHeadId?: string,
): WorkspaceTextAuthorityOpened {
  const durability = workspaceBufferDurabilityWithCheckpoint(
    authority.durability,
    checkpointId,
    basisHeadId,
  );
  return {
    ...authority,
    dirty: workspaceBufferFileDirty(durability) ?? authority.dirty,
    durability,
    pendingClientSeq: undefined,
    pendingCommandKind: undefined,
    pendingCommandEvent: undefined,
    pendingReceiptId: undefined,
    pendingIntentStatus: undefined,
    blockedByClientSeq: undefined,
    lastObstruction: undefined,
    lastCheckpointId: checkpointId,
  };
}

export function workspaceTextAuthorityWithExport(
  authority: WorkspaceTextAuthorityOpened,
  readingId: string,
  basisHeadId: string,
  hostFingerprint: EditorFileFingerprint,
): WorkspaceTextAuthorityOpened {
  const durability = workspaceBufferDurabilityWithExport(
    authority.durability,
    readingId,
    basisHeadId,
    hostFingerprint,
  );
  return {
    ...authority,
    dirty: workspaceBufferFileDirty(durability) ?? authority.dirty,
    durability,
    hostBasis: WorkspaceTextHostBasisKinds.File,
    hostFingerprint,
    materialization: WorkspaceWorldlineMaterializationKinds.Materialized,
    pendingClientSeq: undefined,
    pendingCommandKind: undefined,
    pendingCommandEvent: undefined,
    pendingReceiptId: undefined,
    pendingIntentStatus: undefined,
    blockedByClientSeq: undefined,
    lastObstruction: undefined,
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

export function editorFromFullWorkspaceTextCache(
  authority: WorkspaceTextAuthorityOpened & { readonly cache: WorkspaceTextFullReadingCache },
  existing: EditorState | undefined,
): EditorState {
  return editorFromFullWorkspaceTextReadingCache({
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
