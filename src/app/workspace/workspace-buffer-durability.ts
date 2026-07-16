import type { EditorFileFingerprint } from '../../ports/editor-file.js';
import {
  WorkspaceWorldlineMaterializationKinds,
  type WorkspaceWorldlineMaterializationKind,
} from './worldline-types.js';
import {
  initialWorkspaceBufferCausalLineChanges,
  workspaceBufferCausalLineChangesForTransition,
  type WorkspaceBufferCausalLineChanges,
} from './workspace-causal-line-changes.js';
export {
  unavailableWorkspaceBufferCausalLineChanges,
  workspaceBufferCausalLineChangesFromReading,
  WorkspaceBufferCausalLineChangeKinds,
  WorkspaceBufferCausalLineChangeSources,
  WorkspaceBufferCausalLineChangeUnavailableReasons,
} from './workspace-causal-line-changes.js';
export type {
  WorkspaceBufferCausalLineChanges,
  WorkspaceBufferCausalLineChangesAvailable,
  WorkspaceBufferCausalLineChangesUnavailable,
  WorkspaceBufferCausalLineChangeUnavailableReason,
} from './workspace-causal-line-changes.js';

const INTENT_IDLE = 'idle';
const INTENT_PENDING = 'pending';
const CAUSAL_UNAVAILABLE = 'unavailable';
const CAUSAL_ADMITTED = 'admitted';
const FILE_UNKNOWN = 'unknown';
const FILE_MISSING = 'missing';
const FILE_SAVED = 'saved';
const FILE_DIRTY_CLEAN = 'clean';
const FILE_DIRTY_DIRTY = 'dirty';
const FILE_DIRTY_UNAVAILABLE = 'unavailable';
const FILE_DIRTY_REASON_CAUSAL_HEAD_UNAVAILABLE = 'causal-head-unavailable';
const FILE_DIRTY_REASON_FILE_BASIS_UNAVAILABLE = 'file-basis-unavailable';
const LOCAL_GIT_UNKNOWN = 'unknown';
const LOCAL_GIT_UNCOMMITTED = 'uncommitted';
const LOCAL_GIT_COMMITTED = 'committed';
const REMOTE_GIT_UNKNOWN = 'unknown';
const REMOTE_GIT_UNPUBLISHED = 'unpublished';
const REMOTE_GIT_DURABLE = 'durable';
const HOST_BASIS_MISSING = 'missing';
const INTENT_STATUS_PREDICTED = 'predicted';
const INTENT_STATUS_SUBMITTED = 'submitted';
const INTENT_STATUS_ADMITTED = 'admitted';
const INTENT_STATUS_REBASED = 'rebased';
const INTENT_STATUS_BLOCKED = 'blocked';
const INTENT_STATUS_OBSTRUCTED = 'obstructed';
const INTENT_STATUS_SUPERSEDED = 'superseded';
const INTENT_STATUS_ABANDONED = 'abandoned';
const PENDING_COMMAND_KIND_VIM = 'vim';
const PENDING_COMMAND_KIND_UNDO = 'undo';
const PENDING_COMMAND_KIND_REDO = 'redo';

export const WorkspaceBufferIntentDurabilityKinds = Object.freeze({
  Idle: INTENT_IDLE,
  Pending: INTENT_PENDING,
} as const);

export const WorkspaceBufferCausalDurabilityKinds = Object.freeze({
  Unavailable: CAUSAL_UNAVAILABLE,
  Admitted: CAUSAL_ADMITTED,
} as const);

export const WorkspaceBufferFileDurabilityKinds = Object.freeze({
  Unknown: FILE_UNKNOWN,
  Missing: FILE_MISSING,
  Saved: FILE_SAVED,
} as const);

export const WorkspaceBufferFileDirtyKinds = Object.freeze({
  Clean: FILE_DIRTY_CLEAN,
  Dirty: FILE_DIRTY_DIRTY,
  Unavailable: FILE_DIRTY_UNAVAILABLE,
} as const);

export const WorkspaceBufferLocalGitDurabilityKinds = Object.freeze({
  Unknown: LOCAL_GIT_UNKNOWN,
  Uncommitted: LOCAL_GIT_UNCOMMITTED,
  Committed: LOCAL_GIT_COMMITTED,
} as const);

export const WorkspaceBufferRemoteGitDurabilityKinds = Object.freeze({
  Unknown: REMOTE_GIT_UNKNOWN,
  Unpublished: REMOTE_GIT_UNPUBLISHED,
  Durable: REMOTE_GIT_DURABLE,
} as const);

export const WorkspaceTextIntentStatuses = Object.freeze({
  Predicted: INTENT_STATUS_PREDICTED,
  Submitted: INTENT_STATUS_SUBMITTED,
  Admitted: INTENT_STATUS_ADMITTED,
  Rebased: INTENT_STATUS_REBASED,
  Blocked: INTENT_STATUS_BLOCKED,
  Obstructed: INTENT_STATUS_OBSTRUCTED,
  Superseded: INTENT_STATUS_SUPERSEDED,
  Abandoned: INTENT_STATUS_ABANDONED,
} as const);

export const WorkspaceTextPendingCommandKinds = Object.freeze({
  Vim: PENDING_COMMAND_KIND_VIM,
  Undo: PENDING_COMMAND_KIND_UNDO,
  Redo: PENDING_COMMAND_KIND_REDO,
} as const);

export type WorkspaceTextIntentStatus =
  typeof WorkspaceTextIntentStatuses[keyof typeof WorkspaceTextIntentStatuses];
export type WorkspaceTextPendingCommandKind =
  typeof WorkspaceTextPendingCommandKinds[keyof typeof WorkspaceTextPendingCommandKinds];

export interface WorkspaceBufferIdleIntentDurability {
  readonly kind: typeof INTENT_IDLE;
}

export interface WorkspaceBufferPendingIntentDurability {
  readonly kind: typeof INTENT_PENDING;
  readonly clientSeq: number;
  readonly status: WorkspaceTextIntentStatus;
  readonly commandKind?: WorkspaceTextPendingCommandKind;
}

export type WorkspaceBufferIntentDurability =
  | WorkspaceBufferIdleIntentDurability
  | WorkspaceBufferPendingIntentDurability;

export interface WorkspaceBufferCausalUnavailableDurability {
  readonly kind: typeof CAUSAL_UNAVAILABLE;
}

export interface WorkspaceBufferCausalAdmittedDurability {
  readonly kind: typeof CAUSAL_ADMITTED;
  readonly headId: string;
  readonly receiptId?: string;
  readonly admittedTickId?: string;
}

export type WorkspaceBufferCausalDurability =
  | WorkspaceBufferCausalUnavailableDurability
  | WorkspaceBufferCausalAdmittedDurability;

export interface WorkspaceBufferFileUnknownDurability {
  readonly kind: typeof FILE_UNKNOWN;
}

export interface WorkspaceBufferFileMissingDurability {
  readonly kind: typeof FILE_MISSING;
  readonly basisHeadId?: string;
}

export interface WorkspaceBufferFileSavedDurability {
  readonly kind: typeof FILE_SAVED;
  readonly basisHeadId: string;
  readonly hostFingerprint?: EditorFileFingerprint;
  readonly exportReadingId?: string;
  readonly checkpointId?: string;
}

export type WorkspaceBufferFileDurability =
  | WorkspaceBufferFileUnknownDurability
  | WorkspaceBufferFileMissingDurability
  | WorkspaceBufferFileSavedDurability;

export type WorkspaceBufferLocalGitDurability =
  | { readonly kind: typeof LOCAL_GIT_UNKNOWN }
  | { readonly kind: typeof LOCAL_GIT_UNCOMMITTED }
  | { readonly kind: typeof LOCAL_GIT_COMMITTED; readonly commitId: string };

export type WorkspaceBufferRemoteGitDurability =
  | { readonly kind: typeof REMOTE_GIT_UNKNOWN }
  | {
    readonly kind: typeof REMOTE_GIT_UNPUBLISHED;
    readonly commitId: string;
    readonly aheadBy: number;
  }
  | {
    readonly kind: typeof REMOTE_GIT_DURABLE;
    readonly commitId: string;
    readonly remoteRef: string;
  };

export interface WorkspaceBufferCheckpointDeclaration {
  readonly checkpointId: string;
  readonly basisHeadId: string;
}

export interface WorkspaceBufferFileDirtyKnownReading {
  readonly kind: typeof FILE_DIRTY_CLEAN | typeof FILE_DIRTY_DIRTY;
  readonly currentHeadId: string;
  readonly fileBasisHeadId: string;
  readonly fileKind: typeof FILE_MISSING | typeof FILE_SAVED;
}

export interface WorkspaceBufferFileDirtyUnavailableReading {
  readonly kind: typeof FILE_DIRTY_UNAVAILABLE;
  readonly reason:
    | typeof FILE_DIRTY_REASON_CAUSAL_HEAD_UNAVAILABLE
    | typeof FILE_DIRTY_REASON_FILE_BASIS_UNAVAILABLE;
}

export type WorkspaceBufferFileDirtyReading =
  | WorkspaceBufferFileDirtyKnownReading
  | WorkspaceBufferFileDirtyUnavailableReading;

export interface WorkspaceBufferDurability {
  readonly intent: WorkspaceBufferIntentDurability;
  readonly causal: WorkspaceBufferCausalDurability;
  readonly file: WorkspaceBufferFileDurability;
  readonly localGit: WorkspaceBufferLocalGitDurability;
  readonly remoteGit: WorkspaceBufferRemoteGitDurability;
  readonly lineChanges: WorkspaceBufferCausalLineChanges;
  readonly lastCheckpoint?: WorkspaceBufferCheckpointDeclaration;
}

export interface OpenedWorkspaceBufferDurabilityOptions {
  readonly basisHeadId?: string;
  readonly hostAbsenceBasisHeadId?: string;
  readonly hostBasis: 'file' | 'missing';
  readonly materialization: WorkspaceWorldlineMaterializationKind;
  readonly hostFingerprint?: EditorFileFingerprint;
}

export interface WorkspaceBufferAdmittedTransition {
  readonly receiptId: string;
  readonly admittedTickId: string;
  readonly nextHeadId: string;
}

export interface WorkspaceBufferGitDurabilityEvidence {
  readonly localGit: WorkspaceBufferLocalGitDurability;
  readonly remoteGit: WorkspaceBufferRemoteGitDurability;
}

export function openedWorkspaceBufferDurability(
  options: OpenedWorkspaceBufferDurabilityOptions,
): WorkspaceBufferDurability {
  const basisHeadId = nonEmptyId(options.basisHeadId);
  const file = openedFileDurability(options, basisHeadId);
  return {
    intent: idleIntent(),
    causal: basisHeadId == null
      ? { kind: CAUSAL_UNAVAILABLE }
      : { kind: CAUSAL_ADMITTED, headId: basisHeadId },
    file,
    localGit: { kind: LOCAL_GIT_UNKNOWN },
    remoteGit: { kind: REMOTE_GIT_UNKNOWN },
    lineChanges: initialWorkspaceBufferCausalLineChanges(
      basisHeadId,
      workspaceBufferFileBasisHeadId(file),
    ),
  };
}

export function workspaceBufferDurabilityWithPendingIntent(
  durability: WorkspaceBufferDurability,
  clientSeq: number,
  status: WorkspaceTextIntentStatus,
  commandKind?: WorkspaceTextPendingCommandKind,
): WorkspaceBufferDurability {
  return {
    ...durability,
    intent: {
      kind: INTENT_PENDING,
      clientSeq,
      status,
      commandKind,
    },
  };
}

export function workspaceBufferDurabilityWithAdmittedTransition(
  durability: WorkspaceBufferDurability,
  transition: WorkspaceBufferAdmittedTransition | undefined,
  lineChanges?: WorkspaceBufferCausalLineChanges,
): WorkspaceBufferDurability {
  return {
    ...durability,
    intent: idleIntent(),
    causal: transition == null
      ? durability.causal
      : {
        kind: CAUSAL_ADMITTED,
        headId: transition.nextHeadId,
        receiptId: transition.receiptId,
        admittedTickId: transition.admittedTickId,
      },
    lineChanges: transition == null
      ? durability.lineChanges
      : workspaceBufferCausalLineChangesForTransition(
        workspaceBufferFileBasisHeadId(durability.file),
        transition.nextHeadId,
        lineChanges,
      ),
  };
}

export function workspaceBufferDurabilityWithPendingStatus(
  durability: WorkspaceBufferDurability,
  clientSeq: number | undefined,
  status: WorkspaceTextIntentStatus,
): WorkspaceBufferDurability {
  const resolvedClientSeq = durability.intent.kind === INTENT_PENDING
    ? durability.intent.clientSeq
    : clientSeq;
  if (resolvedClientSeq == null) {
    return durability;
  }
  const commandKind = durability.intent.kind === INTENT_PENDING
    ? durability.intent.commandKind
    : undefined;
  return workspaceBufferDurabilityWithPendingIntent(
    durability,
    resolvedClientSeq,
    status,
    commandKind,
  );
}

export function workspaceBufferDurabilityWithCheckpoint(
  durability: WorkspaceBufferDurability,
  checkpointId: string,
  basisHeadId: string | undefined,
): WorkspaceBufferDurability {
  const validCheckpointId = nonEmptyId(checkpointId);
  const validBasisHeadId = nonEmptyId(basisHeadId);
  if (validCheckpointId == null || validBasisHeadId == null) {
    return durability;
  }
  const lastCheckpoint = {
    checkpointId: validCheckpointId,
    basisHeadId: validBasisHeadId,
  };
  return {
    ...durability,
    lastCheckpoint,
    file: durability.file.kind === FILE_SAVED
      && durability.file.basisHeadId === validBasisHeadId
      ? { ...durability.file, checkpointId: validCheckpointId }
      : durability.file,
  };
}

export function workspaceBufferDurabilityWithExport(
  durability: WorkspaceBufferDurability,
  exportReadingId: string,
  basisHeadId: string,
  hostFingerprint: EditorFileFingerprint,
): WorkspaceBufferDurability {
  const validReadingId = nonEmptyId(exportReadingId);
  const validBasisHeadId = nonEmptyId(basisHeadId);
  if (validReadingId == null || validBasisHeadId == null) {
    return durability;
  }
  const checkpointId = durability.lastCheckpoint?.basisHeadId === validBasisHeadId
    ? durability.lastCheckpoint.checkpointId
    : undefined;
  return {
    ...durability,
    file: {
      kind: FILE_SAVED,
      basisHeadId: validBasisHeadId,
      hostFingerprint,
      exportReadingId: validReadingId,
      checkpointId,
    },
    lineChanges: initialWorkspaceBufferCausalLineChanges(
      durability.causal.kind === CAUSAL_ADMITTED ? durability.causal.headId : undefined,
      validBasisHeadId,
    ),
  };
}

export function workspaceBufferDurabilityWithGitEvidence(
  durability: WorkspaceBufferDurability,
  evidence: WorkspaceBufferGitDurabilityEvidence,
): WorkspaceBufferDurability {
  return {
    ...durability,
    localGit: evidence.localGit,
    remoteGit: evidence.remoteGit,
  };
}

export function workspaceBufferFileDirtyReading(
  durability: WorkspaceBufferDurability,
): WorkspaceBufferFileDirtyReading {
  if (durability.causal.kind !== CAUSAL_ADMITTED) {
    return {
      kind: FILE_DIRTY_UNAVAILABLE,
      reason: FILE_DIRTY_REASON_CAUSAL_HEAD_UNAVAILABLE,
    };
  }
  if (durability.file.kind === FILE_UNKNOWN || durability.file.basisHeadId == null) {
    return {
      kind: FILE_DIRTY_UNAVAILABLE,
      reason: FILE_DIRTY_REASON_FILE_BASIS_UNAVAILABLE,
    };
  }
  const fileBasisHeadId = durability.file.basisHeadId;
  return {
    kind: durability.causal.headId === fileBasisHeadId
      ? FILE_DIRTY_CLEAN
      : FILE_DIRTY_DIRTY,
    currentHeadId: durability.causal.headId,
    fileBasisHeadId,
    fileKind: durability.file.kind,
  };
}

export function workspaceBufferFileDirty(
  durability: WorkspaceBufferDurability,
): boolean | undefined {
  const reading = workspaceBufferFileDirtyReading(durability);
  return reading.kind === FILE_DIRTY_UNAVAILABLE
    ? undefined
    : reading.kind === FILE_DIRTY_DIRTY;
}

function openedFileDurability(
  options: OpenedWorkspaceBufferDurabilityOptions,
  basisHeadId: string | undefined,
): WorkspaceBufferFileDurability {
  if (options.hostBasis === HOST_BASIS_MISSING) {
    return {
      kind: FILE_MISSING,
      basisHeadId: nonEmptyId(options.hostAbsenceBasisHeadId),
    };
  }
  if (
    options.materialization === WorkspaceWorldlineMaterializationKinds.Materialized
    && basisHeadId != null
  ) {
    return {
      kind: FILE_SAVED,
      basisHeadId,
      hostFingerprint: options.hostFingerprint,
    };
  }
  return { kind: FILE_UNKNOWN };
}

export function workspaceBufferFileBasisHeadId(
  file: WorkspaceBufferFileDurability,
): string | undefined {
  return file.kind === FILE_UNKNOWN ? undefined : nonEmptyId(file.basisHeadId);
}

function idleIntent(): WorkspaceBufferIdleIntentDurability {
  return { kind: INTENT_IDLE };
}

function nonEmptyId(value: string | undefined): string | undefined {
  return value == null || value.trim().length === 0 ? undefined : value;
}
