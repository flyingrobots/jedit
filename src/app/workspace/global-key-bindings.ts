import {
  isShellQuitConfirmAccept,
  isShellQuitConfirmDismiss,
  isShellQuitRequest,
  quit,
  type Cmd,
  type KeyMsg,
} from '@flyingrobots/bijou-tui';
import { beginGraftRefresh } from './editor-session.js';
import { closeDrawer, toggleDrawer } from './drawer.js';
import { focusCycleState } from './focus.js';
import { cycleFocusPane, FocusPanes, hasFocusablePeers } from '../../ui/panel-focus.js';
import { isFooterToggleKey } from '../../ui/feedback.js';
import { DrawerKinds, type DrawerKind } from '../../ui/drawer-layout.js';
import { insertModeActive } from './editor-state.js';
import type { WorkspaceKeyBindingContext } from './key-binding-context.js';
import type { WorkspaceModel } from './model.js';
import { WorkspaceMessageTypes, type WorkspaceMsg } from './msg.js';
import { WorkspaceKeys } from './workspace-key.js';
import { updateSaveKey } from './workspace-save-key.js';
import { updateMarkdownPreviewKey, updateThemeKey } from './workspace-view-mode-keys.js';

type KeyBindingResult = [WorkspaceModel, Cmd<WorkspaceMsg>[]];

export function updateQuitConfirmationKey(msg: KeyMsg, model: WorkspaceModel): KeyBindingResult | undefined {
  if (!model.quitConfirmOpen) {
    return undefined;
  }
  if (isShellQuitConfirmAccept(msg)) {
    return [{ ...model, quitConfirmOpen: false }, [quit<WorkspaceMsg>()]];
  }
  if (isShellQuitConfirmDismiss(msg)) {
    return [{ ...model, quitConfirmOpen: false }, []];
  }
  return [model, []];
}

export function updateGlobalWorkspaceKey(
  msg: KeyMsg,
  model: WorkspaceModel,
  context: WorkspaceKeyBindingContext,
): KeyBindingResult | undefined {
  return updatePerfWorkspaceKey(msg, model)
    ?? updateQuitKey(msg, model)
    ?? updateFooterKey(msg, model)
    ?? updateSaveKey(msg, model, context)
    ?? updateThemeKey(msg, model)
    ?? updateFocusKey(msg, model)
    ?? updateDrawerKey(msg, model, context)
    ?? updateMarkdownPreviewKey(msg, model, context);
}

export function updatePerfWorkspaceKey(msg: KeyMsg, model: WorkspaceModel): KeyBindingResult | undefined {
  if (msg.key !== WorkspaceKeys.Backtick) {
    return undefined;
  }
  return [model, [() => ({ type: WorkspaceMessageTypes.TogglePerf })]];
}

export function updateHardGlobalWorkspaceKey(msg: KeyMsg, model: WorkspaceModel): KeyBindingResult | undefined {
  return updateForceQuitWorkspaceKey(msg, model)
    ?? updatePerfWorkspaceKey(msg, model);
}

export function updateForceQuitWorkspaceKey(msg: KeyMsg, model: WorkspaceModel): KeyBindingResult | undefined {
  return msg.ctrl && msg.key === WorkspaceKeys.C
    ? [model, [quit<WorkspaceMsg>()]]
    : undefined;
}

function updateQuitKey(msg: KeyMsg, model: WorkspaceModel): KeyBindingResult | undefined {
  return updateForceQuitWorkspaceKey(msg, model)
    ?? (!insertModeActive(model) && isPlainShellQuitRequest(msg)
    ? [{ ...model, quitConfirmOpen: true }, []]
    : undefined);
}

function isPlainShellQuitRequest(msg: KeyMsg): boolean {
  return isShellQuitRequest(msg) && msg.key === WorkspaceKeys.Q;
}

function updateFooterKey(msg: KeyMsg, model: WorkspaceModel): KeyBindingResult | undefined {
  if (insertModeActive(model) || !isFooterToggleKey(msg)) {
    return undefined;
  }
  return [{ ...model, footerVisible: !model.footerVisible }, []];
}

function updateFocusKey(msg: KeyMsg, model: WorkspaceModel): KeyBindingResult | undefined {
  const focusState = focusCycleState(model);
  if (msg.key !== WorkspaceKeys.Tab || !hasFocusablePeers(focusState)) {
    return undefined;
  }
  return [{ ...model, focusPane: cycleFocusPane(focusState) }, []];
}

function updateDrawerKey(
  msg: KeyMsg,
  model: WorkspaceModel,
  context: WorkspaceKeyBindingContext,
): KeyBindingResult | undefined {
  const kind = drawerKindFromToggleKey(msg);
  if (kind != null) {
    return toggleWorkspaceDrawer(model, kind, context);
  }
  return updateEscapeKey(msg, model, context);
}

function drawerKindFromToggleKey(msg: KeyMsg): DrawerKind | undefined {
  if (isCtrlWorkspaceKey(msg, WorkspaceKeys.B)) {
    return DrawerKinds.Files;
  }
  if (isCtrlWorkspaceKey(msg, WorkspaceKeys.G)) {
    return DrawerKinds.Graft;
  }
  return isCtrlWorkspaceKey(msg, WorkspaceKeys.H) ? DrawerKinds.History : undefined;
}

function isCtrlWorkspaceKey(msg: KeyMsg, key: string): boolean {
  return msg.ctrl === true && msg.alt !== true && msg.key === key;
}

function updateEscapeKey(
  msg: KeyMsg,
  model: WorkspaceModel,
  context: WorkspaceKeyBindingContext,
): KeyBindingResult | undefined {
  if (msg.key !== WorkspaceKeys.Escape) {
    return undefined;
  }
  if (model.focusPane === FocusPanes.Files && model.fileDrawerOpen) {
    return closeDrawer(model, DrawerKinds.Files, context.createDrawerAnimationCmd);
  }
  if (model.focusPane === FocusPanes.Graft && model.graftDrawerOpen) {
    return closeDrawer(model, DrawerKinds.Graft, context.createDrawerAnimationCmd);
  }
  return model.focusPane === FocusPanes.History && model.historyDrawerOpen
    ? closeDrawer(model, DrawerKinds.History, context.createDrawerAnimationCmd)
    : undefined;
}

function toggleWorkspaceDrawer(
  model: WorkspaceModel,
  kind: DrawerKind,
  context: WorkspaceKeyBindingContext,
): KeyBindingResult {
  return toggleDrawer(model, kind, (nextModel, options) => (
    beginGraftRefresh(nextModel, options, context.deps.graftSession)
  ), context.createDrawerAnimationCmd);
}
