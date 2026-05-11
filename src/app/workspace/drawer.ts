import type { Cmd } from '@flyingrobots/bijou-tui';
import { defaultFocusPane } from '../../ui/panel-focus.js';
import type { DrawerKind } from '../../ui/drawer-layout.js';
import type { FocusCycleState } from '../../ui/panel-focus.js';
import { withFocusPane } from './focus.js';
import type { WorkspaceModel } from './model.js';
import type { WorkspaceMsg } from './msg.js';

export type CreateDrawerAnimationCmd = (kind: DrawerKind, from: number, to: number) => Cmd<WorkspaceMsg>[];

export function openDrawer(
  model: WorkspaceModel,
  kind: DrawerKind,
  beginGraftRefresh: (model: WorkspaceModel, force: boolean) => [WorkspaceModel, Cmd<WorkspaceMsg>[]],
  createDrawerAnimationCmd: CreateDrawerAnimationCmd,
): [WorkspaceModel, Cmd<WorkspaceMsg>[]] {
  if (kind === 'graft') {
    const [next, cmds] = beginGraftRefresh({
      ...withFocusPane({
        ...model,
        graftDrawerOpen: true,
      }, 'graft'),
    }, false);

    if (model.graftDrawerOpen) {
      return [next, cmds];
    }

    return [
      next,
      [...drawerAnimation('graft', model.graftDrawerProgress, 1, createDrawerAnimationCmd), ...cmds],
    ];
  }

  const next = withFocusPane({
    ...model,
    fileDrawerOpen: true,
  }, 'files');

  if (model.fileDrawerOpen) {
    return [next, []];
  }

  return [
    next,
    drawerAnimation('files', model.fileDrawerProgress, 1, createDrawerAnimationCmd),
  ];
}

export function toggleDrawer(
  model: WorkspaceModel,
  kind: DrawerKind,
  beginGraftRefresh: (model: WorkspaceModel, force: boolean) => [WorkspaceModel, Cmd<WorkspaceMsg>[]],
  createDrawerAnimationCmd: CreateDrawerAnimationCmd,
): [WorkspaceModel, Cmd<WorkspaceMsg>[]] {
  if ((kind === 'files' && model.fileDrawerOpen) || (kind === 'graft' && model.graftDrawerOpen)) {
    return closeDrawer(model, kind, createDrawerAnimationCmd);
  }

  return openDrawer(model, kind, beginGraftRefresh, createDrawerAnimationCmd);
}

export function closeDrawer(
  model: WorkspaceModel,
  kind: DrawerKind,
  createDrawerAnimationCmd: CreateDrawerAnimationCmd,
): [WorkspaceModel, Cmd<WorkspaceMsg>[]] {
  const next = kind === 'files'
    ? {
      ...model,
      fileDrawerOpen: false,
    }
    : {
      ...model,
      graftDrawerOpen: false,
    };

  const focusState: Omit<FocusCycleState, 'focusPane'> = {
    fileDrawerOpen: kind === 'files' ? false : next.fileDrawerOpen,
    graftDrawerOpen: kind === 'graft' ? false : next.graftDrawerOpen,
    hasEditor: next.editor != null,
  };

  return [
    withFocusPane(next, defaultFocusPane(focusState)),
    drawerAnimation(
      kind,
      kind === 'files' ? model.fileDrawerProgress : model.graftDrawerProgress,
      0,
      createDrawerAnimationCmd,
    ),
  ];
}

function drawerAnimation(
  kind: DrawerKind,
  from: number,
  to: number,
  createDrawerAnimationCmd: CreateDrawerAnimationCmd,
): Cmd<WorkspaceMsg>[] {
  return createDrawerAnimationCmd(kind, from, to);
}
