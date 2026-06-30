import type { RuntimeIssue } from '@flyingrobots/bijou-tui';
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

const WSC_SETTLEMENT_OBSTRUCTION_PREFIX = 'WSC edit settlement failed';
const DEPENDENT_EDIT_BLOCKED_PREFIX = 'Text edit blocked by obstructed intent';
const ISSUE_LEVEL_ERROR = 'error';
const ISSUE_SOURCE_COMMAND = 'command';

export interface WorkspaceTextSettlementObstruction {
  readonly code: string;
  readonly message: string;
}

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

export function shouldRecordIntermediateTextEditResult(
  authority: WorkspaceTextAuthorityOpened,
  requestId: number,
  latestRequestId: number,
): boolean {
  return requestId < latestRequestId &&
    hasPredictedDependentEdit(authority, requestId);
}

export function settlementObstructionIssue(
  filePath: string,
  obstruction: WorkspaceTextSettlementObstruction,
  atMs: number,
): RuntimeIssue {
  return {
    message: `${WSC_SETTLEMENT_OBSTRUCTION_PREFIX}: ${filePath}: ${obstruction.message}`,
    level: ISSUE_LEVEL_ERROR,
    source: ISSUE_SOURCE_COMMAND,
    atMs,
  };
}

export function dependentEditBlockedIssue(
  filePath: string,
  blockedByClientSeq: number | undefined,
  atMs: number,
): RuntimeIssue {
  const blocker = blockedByClientSeq == null ? 'request:unknown' : `request:${blockedByClientSeq}`;

  return {
    message: `${DEPENDENT_EDIT_BLOCKED_PREFIX}: ${filePath}: ${blocker}`,
    level: ISSUE_LEVEL_ERROR,
    source: ISSUE_SOURCE_COMMAND,
    atMs,
  };
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
