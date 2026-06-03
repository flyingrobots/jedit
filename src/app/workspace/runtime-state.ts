import { DrawerKinds } from '../../ui/drawer-layout.js';
import type { GraftInfo } from '../../ports/graft-session.js';
import type { DrawerKind } from '../../ui/drawer-layout.js';
import type { WorkspaceModel } from './model.js';
import { clamp01, clampIndex } from './viewport.js';

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

function unreachableDrawerKind(kind: never): never {
  throw new UnsupportedDrawerKindError(kind);
}

export function applyGraftInfo(model: WorkspaceModel, info: GraftInfo): WorkspaceModel {
  return {
    ...model,
    graftInfo: info,
    graftLoading: false,
    graftSelectedIndex: clampIndex(model.graftSelectedIndex, info.outlineItems.length),
  };
}
