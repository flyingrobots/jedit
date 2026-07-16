import { workspaceTextAuthorityPosture } from './workspace-text-authority.js';
import { WorkspaceTextAuthorityKinds } from './workspace-text-authority.js';
import {
  workspaceBufferFileDirtyReading,
  WorkspaceBufferCausalDurabilityKinds,
  WorkspaceBufferFileDirtyKinds,
  WorkspaceBufferFileDurabilityKinds,
  WorkspaceBufferIntentDurabilityKinds,
  type WorkspaceBufferDurability,
  type WorkspaceBufferFileDurability,
  type WorkspaceBufferIntentDurability,
} from './workspace-buffer-durability.js';
import {
  workspaceWorldlineContextLabel,
  workspaceWorldlineMaterialization,
  worldlineGraphContextLine,
  WorkspaceHistoryDrawerViews,
} from './worldline-state.js';
import type { WorkspaceModel } from './model.js';
import { jeditCommandFooterSummary } from './command-provenance-summaries.js';

export function workspaceFooterTextPosture(model: WorkspaceModel): string {
  return [
    workspaceFooterAuthorityPosture(model),
    workspaceWorldlineContextLabel({
      worldline: model.worldline,
      materialization: workspaceFooterMaterialization(model),
    }),
  ].join(' | ');
}

export function workspaceBufferDurabilityFooterPosture(
  durability: WorkspaceBufferDurability,
): string {
  return [
    footerIntentPosture(durability.intent),
    footerCausalPosture(durability),
    footerFilePosture(durability.file),
    `git:${durability.localGit.kind}`,
    `remote:${durability.remoteGit.kind}`,
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

function workspaceFooterAuthorityPosture(model: WorkspaceModel): string {
  return model.textAuthority.kind === WorkspaceTextAuthorityKinds.Opened
    ? workspaceBufferDurabilityFooterPosture(model.textAuthority.durability)
    : workspaceTextAuthorityPosture(model.textAuthority);
}

function footerIntentPosture(intent: WorkspaceBufferIntentDurability): string {
  return intent.kind === WorkspaceBufferIntentDurabilityKinds.Idle
    ? 'intent:idle'
    : `intent:pending:${intent.status}`;
}

function footerCausalPosture(durability: WorkspaceBufferDurability): string {
  if (durability.causal.kind !== WorkspaceBufferCausalDurabilityKinds.Admitted) {
    return 'causal:unavailable';
  }
  return workspaceBufferFileDirtyReading(durability).kind === WorkspaceBufferFileDirtyKinds.Dirty
    ? 'causal:unsaved'
    : 'causal:admitted';
}

function footerFilePosture(file: WorkspaceBufferFileDurability): string {
  return file.kind === WorkspaceBufferFileDurabilityKinds.Saved && file.exportReadingId != null
    ? 'file:exported'
    : `file:${file.kind}`;
}
