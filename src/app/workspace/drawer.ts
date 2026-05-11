import { animate, type Cmd } from '@flyingrobots/bijou-tui';
import { defaultFocusPane, type DrawerKind } from '../../ui/panel-focus.js';
import type { FocusCycleState } from '../../ui/panel-focus.js';
import { withFocusPane } from './focus.js';
import type { WorkspaceModel } from './model.js';
import type { WorkspaceMsg } from './msg.js';

const DRAWER_DURATION_MS = 160;

export function openDrawer(
  model: WorkspaceModel,
  kind: DrawerKind,
  beginGraftRefresh: (model: WorkspaceModel, force: boolean) => [WorkspaceModel, Cmd<WorkspaceMsg>[]],
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
      [...drawerAnimation('graft', model.graftDrawerProgress, 1), ...cmds],
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
    drawerAnimation('files', model.fileDrawerProgress, 1),
  ];
}

export function toggleDrawer(
  model: WorkspaceModel,
  kind: DrawerKind,
  beginGraftRefresh: (model: WorkspaceModel, force: boolean) => [WorkspaceModel, Cmd<WorkspaceMsg>[]],
): [WorkspaceModel, Cmd<WorkspaceMsg>[]] {
  if ((kind === 'files' && model.fileDrawerOpen) || (kind === 'graft' && model.graftDrawerOpen)) {
    return closeDrawer(model, kind);
  }

  return openDrawer(model, kind, beginGraftRefresh);
}

export function closeDrawer(model: WorkspaceModel, kind: DrawerKind): [WorkspaceModel, Cmd<WorkspaceMsg>[]] {
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
    drawerAnimation(kind, kind === 'files' ? model.fileDrawerProgress : model.graftDrawerProgress, 0),
  ];
}

function drawerAnimation(kind: DrawerKind, from: number, to: number): Cmd<WorkspaceMsg>[] {
  return [
    animate<WorkspaceMsg>({
      type: 'tween',
      from,
      to,
      duration: DRAWER_DURATION_MS,
      onFrame: (value) => ({ type: 'drawer-progress', kind, value }),
    }),
  ];
}
