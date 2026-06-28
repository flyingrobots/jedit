import { workspaceTextAuthorityPosture } from './workspace-text-authority.js';
import { WorkspaceTextAuthorityKinds } from './workspace-text-authority.js';
import {
  workspaceWorldlineContextLabel,
  workspaceWorldlineMaterialization,
  worldlineGraphContextLine,
  WorkspaceHistoryDrawerViews,
} from './worldline-state.js';
import type { WorkspaceModel } from './model.js';
import { jeditCommandFooterSummary } from './command-provenance.js';

export function workspaceFooterTextPosture(model: WorkspaceModel): string {
  return [
    workspaceTextAuthorityPosture(model.textAuthority),
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
