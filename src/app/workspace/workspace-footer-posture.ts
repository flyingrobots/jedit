import { workspaceTextAuthorityPosture } from './workspace-text-authority.js';
import {
  workspaceWorldlineContextLabel,
  workspaceWorldlineMaterialization,
  worldlineGraphContextLine,
  WorkspaceHistoryDrawerViews,
} from './worldline-state.js';
import type { WorkspaceModel } from './model.js';

export function workspaceFooterTextPosture(model: WorkspaceModel): string {
  return [
    workspaceTextAuthorityPosture(model.textAuthority),
    workspaceWorldlineContextLabel({
      worldline: model.worldline,
      materialization: workspaceWorldlineMaterialization(model.editor?.dirty),
    }),
  ].join(' | ');
}

export function workspaceHistoryContextLine(model: WorkspaceModel): string | undefined {
  return model.historyDrawerView === WorkspaceHistoryDrawerViews.Worldlines
    ? worldlineGraphContextLine(model.worldline)
    : undefined;
}
