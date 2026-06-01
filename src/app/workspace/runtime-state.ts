import { DrawerKinds } from '../../ui/drawer-layout.js';
import type { GraftInfo } from '../../ports/graft-session.js';
import type { DrawerKind } from '../../ui/drawer-layout.js';
import type { WorkspaceModel } from './model.js';
import { clamp01, clampIndex } from './viewport.js';

export function applyDrawerProgress(model: WorkspaceModel, kind: DrawerKind, value: number): WorkspaceModel {
  if (kind === DrawerKinds.Files) {
    return { ...model, fileDrawerProgress: clamp01(value) };
  }
  return kind === DrawerKinds.Graft
    ? { ...model, graftDrawerProgress: clamp01(value) }
    : { ...model, historyDrawerProgress: clamp01(value) };
}

export function applyGraftInfo(model: WorkspaceModel, info: GraftInfo): WorkspaceModel {
  return {
    ...model,
    graftInfo: info,
    graftLoading: false,
    graftSelectedIndex: clampIndex(model.graftSelectedIndex, info.outlineItems.length),
  };
}
