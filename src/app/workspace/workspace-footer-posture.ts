import { workspaceTextAuthorityPosture } from './workspace-text-authority.js';
import { WorkspaceTextAuthorityKinds } from './workspace-text-authority.js';
import {
  workspaceBufferFileDirtyReading,
  WorkspaceBufferCausalLineChangeKinds,
  WorkspaceBufferCausalDurabilityKinds,
  WorkspaceBufferFileDirtyKinds,
  WorkspaceBufferFileDurabilityKinds,
  WorkspaceBufferIntentDurabilityKinds,
  type WorkspaceBufferDurability,
  type WorkspaceBufferFileDurability,
  type WorkspaceBufferIntentDurability,
  type WorkspaceBufferCausalLineChanges,
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
      causalLineDelta: workspaceFooterCausalLineDelta(model),
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
  if (model.historyDrawerView !== WorkspaceHistoryDrawerViews.Worldlines) {
    return undefined;
  }
  const lineChanges = model.textAuthority.kind === WorkspaceTextAuthorityKinds.Opened
    ? model.textAuthority.durability.lineChanges
    : undefined;
  return [
    worldlineGraphContextLine(model.worldline),
    lineChanges == null ? undefined : causalLineChangesDebugLabel(lineChanges),
  ].filter((part): part is string => part != null).join(' | ');
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

function workspaceFooterCausalLineDelta(
  model: WorkspaceModel,
): { readonly insertedLineCount: number | null; readonly deletedLineCount: number | null } | undefined {
  if (model.textAuthority.kind !== WorkspaceTextAuthorityKinds.Opened) {
    return undefined;
  }
  const lineChanges = model.textAuthority.durability.lineChanges;
  return lineChanges.kind === WorkspaceBufferCausalLineChangeKinds.Available
    ? {
      insertedLineCount: lineChanges.insertedLineCount,
      deletedLineCount: lineChanges.deletedLineCount,
    }
    : { insertedLineCount: null, deletedLineCount: null };
}

function causalLineChangesDebugLabel(lineChanges: WorkspaceBufferCausalLineChanges): string {
  if (lineChanges.kind === WorkspaceBufferCausalLineChangeKinds.Unavailable) {
    return `Causal lines unavailable:${lineChanges.reason}`;
  }
  const rewrites = lineChanges.rewriteIds.length === 0 ? '-' : lineChanges.rewriteIds.join(',');
  const diffs = lineChanges.diffIds.length === 0 ? '-' : lineChanges.diffIds.join(',');
  return [
    `Causal lines ${lineChanges.basisHeadId}->${lineChanges.nextHeadId}`,
    `+${lineChanges.insertedLineCount}/-${lineChanges.deletedLineCount}`,
    `rewrites:${rewrites}`,
    `diffs:${diffs}`,
  ].join(' ');
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
