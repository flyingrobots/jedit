import { DrawerKinds } from '../../ui/drawer-layout.js';
import type { GraftInfo } from '../../ports/graft-session.js';
import type { DrawerKind } from '../../ui/drawer-layout.js';
import type { WorkspaceModel } from './model.js';
import { clamp01, clampIndex } from './viewport.js';
import { graftProjectionPanelLanes } from '../../ports/graft-projection-lanes.js';

class UnsupportedDrawerKindError extends Error {
  constructor(kind: never) {
    super(`unsupported drawer kind: ${String(kind)}`);
    this.name = 'UnsupportedDrawerKindError';
  }
}

export function applyDrawerProgress(model: WorkspaceModel, kind: DrawerKind, value: number): WorkspaceModel {
  switch (kind) {
    case DrawerKinds.Files:
      return { ...model, fileDrawerProgress: clamp01(value) };
    case DrawerKinds.Graft:
      return { ...model, graftDrawerProgress: clamp01(value) };
    case DrawerKinds.History:
      return { ...model, historyDrawerProgress: clamp01(value) };
  }
  return unreachableDrawerKind(kind);
}

export function applyStartupFileDrawerProgress(
  model: WorkspaceModel,
  value: number,
): WorkspaceModel {
  return { ...model, startupFileDrawerProgress: clamp01(value) };
}

function unreachableDrawerKind(kind: never): never {
  throw new UnsupportedDrawerKindError(kind);
}

export function applyGraftInfo(model: WorkspaceModel, info: GraftInfo): WorkspaceModel {
  return {
    ...model,
    graftInfo: info,
    graftLoading: false,
    graftSelectedIndex: clampIndex(model.graftSelectedIndex, info.outlineItems.length),
    expandedProjectionLaneIndex: refreshedProjectionLaneIndex(info, model.expandedProjectionLaneIndex),
  };
}

function refreshedProjectionLaneIndex(info: GraftInfo, currentIndex: number | undefined): number | undefined {
  if (currentIndex == null) {
    return undefined;
  }
  return graftProjectionPanelLanes(info)[currentIndex]?.reviewPayload == null
    ? undefined
    : currentIndex;
}
