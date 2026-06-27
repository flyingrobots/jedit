import {
  WorkspaceTextAuthorityKinds,
  WorkspaceTextIntentStatuses,
  type WorkspaceTextAuthority,
  type WorkspaceTextAuthorityOpened,
} from './workspace-text-authority.js';
import {
  WorkspaceTextResultKinds,
  type WorkspaceTextCheckpointResult,
  type WorkspaceTextEditResult,
  type WorkspaceTextExportResult,
  type WorkspaceTextReadCommandResult,
} from './workspace-text-results.js';

export function shouldIgnoreTextEditObstruction(
  authority: WorkspaceTextAuthorityOpened,
  requestId: number,
  latestRequestId: number,
): boolean {
  if (requestId > latestRequestId) {
    return true;
  }
  if (requestId === latestRequestId) {
    return false;
  }
  return !hasPredictedDependentEdit(authority, requestId);
}

export function textEditResultBlockedByEarlierObstruction(
  authority: WorkspaceTextAuthorityOpened,
  requestId: number,
): boolean {
  return authority.blockedByClientSeq != null && requestId > authority.blockedByClientSeq;
}

export function textEditResultTargetsAuthority(
  authority: WorkspaceTextAuthority,
  result: WorkspaceTextEditResult,
): authority is WorkspaceTextAuthorityOpened {
  return isOpenedAuthority(authority) && (
    result.kind === WorkspaceTextResultKinds.Obstructed
      ? result.filePath === authority.filePath
      : textResultBufferMatchesAuthority(authority, result)
  );
}

export function textCheckpointResultTargetsAuthority(
  authority: WorkspaceTextAuthority,
  result: WorkspaceTextCheckpointResult,
): authority is WorkspaceTextAuthorityOpened {
  return isOpenedAuthority(authority) && (
    result.kind === WorkspaceTextResultKinds.Obstructed
      ? result.filePath === authority.filePath
      : textResultBufferMatchesAuthority(authority, result)
  );
}

export function textExportResultTargetsAuthority(
  authority: WorkspaceTextAuthority,
  result: WorkspaceTextExportResult,
): authority is WorkspaceTextAuthorityOpened {
  return isOpenedAuthority(authority) && (
    result.kind === WorkspaceTextResultKinds.Obstructed
      ? result.filePath === authority.filePath
      : textResultBufferMatchesAuthority(authority, result)
  );
}

export function textReadResultTargetsAuthority(
  authority: WorkspaceTextAuthority,
  result: WorkspaceTextReadCommandResult,
): authority is WorkspaceTextAuthorityOpened {
  return isOpenedAuthority(authority) && (
    result.kind === WorkspaceTextResultKinds.Obstructed
      ? result.filePath === authority.filePath
      : textResultBufferMatchesAuthority(authority, result)
  );
}

function hasPredictedDependentEdit(
  authority: WorkspaceTextAuthorityOpened,
  requestId: number,
): boolean {
  return (
    authority.pendingClientSeq != null &&
    requestId <= authority.pendingClientSeq &&
    (
      authority.pendingIntentStatus === WorkspaceTextIntentStatuses.Predicted ||
      authority.pendingIntentStatus === WorkspaceTextIntentStatuses.Submitted
    )
  );
}

function isOpenedAuthority(authority: WorkspaceTextAuthority): authority is WorkspaceTextAuthorityOpened {
  return authority.kind === WorkspaceTextAuthorityKinds.Opened;
}

function textResultBufferMatchesAuthority(
  authority: WorkspaceTextAuthorityOpened,
  result: { readonly filePath: string; readonly bufferId: string },
): boolean {
  return result.filePath === authority.filePath && result.bufferId === authority.bufferId;
}
