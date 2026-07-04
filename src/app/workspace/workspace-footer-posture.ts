import {
  WorkspaceTextAuthorityKinds,
  type WorkspaceTextAuthority,
  type WorkspaceTextAuthorityOpened,
} from './workspace-text-authority.js';
import {
  workspaceWorldlineContextLabel,
  workspaceWorldlineMaterialization,
  worldlineGraphContextLine,
  WorkspaceHistoryDrawerViews,
} from './worldline-state.js';
import type { WorkspaceModel } from './model.js';
import { jeditCommandFooterSummary } from './command-provenance.js';

const BASIS_NONE = 'basis:none';
const BASIS_PENDING_OPEN = 'basis:pending-open';
const BASIS_OBSTRUCTED = 'basis:obstructed';
const BASIS_OPEN = 'basis:open';
const BASIS_READING = 'basis:reading';
const BASIS_CHECKPOINT = 'basis:checkpoint';
const BASIS_EXPORT = 'basis:export';
const HEAD_NONE = 'head:none';
const HEAD_PENDING_OPEN = 'head:pending-open';
const HEAD_OBSTRUCTED = 'head:obstructed';
const HEAD_BASIS = 'head:basis';
const HEAD_LOCAL = 'head:local';
const HEAD_RECEIPT = 'head:receipt';
const HEAD_CHECKPOINT = 'head:checkpoint';
const HEAD_EXPORT = 'head:export';
const HEAD_PREFIX = 'head:';

export function workspaceFooterTextPosture(model: WorkspaceModel): string {
  return [
    workspaceFooterTextAuthorityPosture(model.textAuthority),
    workspaceWorldlineContextLabel({
      worldline: model.worldline,
      materialization: workspaceFooterMaterialization(model),
    }),
  ].join(' | ');
}

export function workspaceHistoryContextLine(model: WorkspaceModel): string | undefined {
  return model.historyDrawerView === WorkspaceHistoryDrawerViews.Worldlines
    ? worldlineGraphContextLine(model.worldline)
    : undefined;
}

export function workspaceFooterCommandSummary(model: WorkspaceModel): string | undefined {
  return jeditCommandFooterSummary(model.editor, model.textAuthority);
}

function workspaceFooterMaterialization(
  model: WorkspaceModel,
) {
  return model.textAuthority.kind === WorkspaceTextAuthorityKinds.Opened
    ? model.textAuthority.materialization
    : workspaceWorldlineMaterialization(model.editor?.dirty);
}

function workspaceFooterTextAuthorityPosture(
  authority: WorkspaceTextAuthority,
): string {
  return [
    workspaceFooterTextBasis(authority),
    workspaceFooterTextHead(authority),
  ].join(' | ');
}

function workspaceFooterTextBasis(authority: WorkspaceTextAuthority): string {
  if (authority.kind === WorkspaceTextAuthorityKinds.None) return BASIS_NONE;
  if (authority.kind === WorkspaceTextAuthorityKinds.PendingOpen) return BASIS_PENDING_OPEN;
  if (authority.kind === WorkspaceTextAuthorityKinds.Obstructed) return BASIS_OBSTRUCTED;
  return openedTextBasis(authority);
}

function workspaceFooterTextHead(authority: WorkspaceTextAuthority): string {
  if (authority.kind === WorkspaceTextAuthorityKinds.None) return HEAD_NONE;
  if (authority.kind === WorkspaceTextAuthorityKinds.PendingOpen) return HEAD_PENDING_OPEN;
  if (authority.kind === WorkspaceTextAuthorityKinds.Obstructed) return HEAD_OBSTRUCTED;
  return openedTextHead(authority);
}

function openedTextBasis(authority: WorkspaceTextAuthorityOpened): string {
  if (authority.lastCheckpointId != null) return BASIS_CHECKPOINT;
  if (authority.lastExportReadingId != null) return BASIS_EXPORT;
  return authority.cache == null ? BASIS_OPEN : BASIS_READING;
}

function openedTextHead(authority: WorkspaceTextAuthorityOpened): string {
  if (authority.pendingIntentStatus != null) {
    return `${HEAD_PREFIX}${authority.pendingIntentStatus}`;
  }
  if (authority.lastCheckpointId != null) return HEAD_CHECKPOINT;
  if (authority.lastExportReadingId != null) return HEAD_EXPORT;
  if (authority.lastReceiptId != null) return HEAD_RECEIPT;
  if (authority.dirty) return HEAD_LOCAL;
  return HEAD_BASIS;
}
