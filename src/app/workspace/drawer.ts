import type { Cmd } from '@flyingrobots/bijou-tui';
import { defaultFocusPane, FocusPanes } from '../../ui/panel-focus.js';
import { DrawerKinds, type DrawerKind } from '../../ui/drawer-layout.js';
import type { FocusCycleState } from '../../ui/panel-focus.js';
import { withFocusPane } from './focus.js';
import type { WorkspaceModel } from './model.js';
import type { WorkspaceMsg } from './msg.js';
import type { GraftRefreshOptions } from './editor-session.js';

export type CreateDrawerAnimationCmd = (kind: DrawerKind, from: number, to: number) => Cmd<WorkspaceMsg>[];

export function openDrawer(
  model: WorkspaceModel,
  kind: DrawerKind,
  beginGraftRefresh: (model: WorkspaceModel, options: GraftRefreshOptions) => [WorkspaceModel, Cmd<WorkspaceMsg>[]],
  createDrawerAnimationCmd: CreateDrawerAnimationCmd,
): [WorkspaceModel, Cmd<WorkspaceMsg>[]] {
  if (kind === DrawerKinds.Graft) {
    return openGraftDrawer(model, beginGraftRefresh, createDrawerAnimationCmd);
  }

  return openFileDrawer(model, createDrawerAnimationCmd);
}

function openGraftDrawer(
  model: WorkspaceModel,
  beginGraftRefresh: (model: WorkspaceModel, options: GraftRefreshOptions) => [WorkspaceModel, Cmd<WorkspaceMsg>[]],
  createDrawerAnimationCmd: CreateDrawerAnimationCmd,
): [WorkspaceModel, Cmd<WorkspaceMsg>[]] {
  const [next, cmds] = beginGraftRefresh({
    ...withFocusPane({ ...model, graftDrawerOpen: true }, FocusPanes.Graft),
  }, { force: false });
  if (model.graftDrawerOpen) {
    return [next, cmds];
  }
  return [
    next,
    [...drawerAnimation(DrawerKinds.Graft, model.graftDrawerProgress, 1, createDrawerAnimationCmd), ...cmds],
  ];
}

function openFileDrawer(
  model: WorkspaceModel,
  createDrawerAnimationCmd: CreateDrawerAnimationCmd,
): [WorkspaceModel, Cmd<WorkspaceMsg>[]] {
  const next = withFocusPane({
    ...model,
    fileDrawerOpen: true,
  }, FocusPanes.Files);

  if (model.fileDrawerOpen) {
    return [next, []];
  }

  return [
    next,
    drawerAnimation(DrawerKinds.Files, model.fileDrawerProgress, 1, createDrawerAnimationCmd),
  ];
}

export function toggleDrawer(
  model: WorkspaceModel,
  kind: DrawerKind,
  beginGraftRefresh: (model: WorkspaceModel, options: GraftRefreshOptions) => [WorkspaceModel, Cmd<WorkspaceMsg>[]],
  createDrawerAnimationCmd: CreateDrawerAnimationCmd,
): [WorkspaceModel, Cmd<WorkspaceMsg>[]] {
  if ((kind === DrawerKinds.Files && model.fileDrawerOpen) || (kind === DrawerKinds.Graft && model.graftDrawerOpen)) {
    return closeDrawer(model, kind, createDrawerAnimationCmd);
  }

  return openDrawer(model, kind, beginGraftRefresh, createDrawerAnimationCmd);
}

export function closeDrawer(
  model: WorkspaceModel,
  kind: DrawerKind,
  createDrawerAnimationCmd: CreateDrawerAnimationCmd,
): [WorkspaceModel, Cmd<WorkspaceMsg>[]] {
  const next = kind === DrawerKinds.Files
    ? { ...model, fileDrawerOpen: false }
    : { ...model, graftDrawerOpen: false };

  const focusState: Omit<FocusCycleState, 'focusPane'> = {
    fileDrawerOpen: kind === DrawerKinds.Files ? false : next.fileDrawerOpen,
    graftDrawerOpen: kind === DrawerKinds.Graft ? false : next.graftDrawerOpen,
    hasEditor: next.editor != null,
  };

  return [
    withFocusPane(next, defaultFocusPane(focusState)),
    drawerAnimation(
      kind,
      drawerProgress(model, kind),
      0,
      createDrawerAnimationCmd,
    ),
  ];
}

function drawerProgress(model: WorkspaceModel, kind: DrawerKind): number {
  return kind === DrawerKinds.Files ? model.fileDrawerProgress : model.graftDrawerProgress;
}

function drawerAnimation(
  kind: DrawerKind,
  from: number,
  to: number,
  createDrawerAnimationCmd: CreateDrawerAnimationCmd,
): Cmd<WorkspaceMsg>[] {
  return createDrawerAnimationCmd(kind, from, to);
}
