import { quit, type Cmd, type KeyMsg } from '@flyingrobots/bijou-tui';
import { beginGraftRefresh } from './editor-session.js';
import { closeDrawer, toggleDrawer } from './drawer.js';
import { focusCycleState } from './focus.js';
import { cycleFocusPane, FocusPanes, hasFocusablePeers } from '../../ui/panel-focus.js';
import { isFooterToggleKey } from '../../ui/feedback.js';
import { DrawerKinds } from '../../ui/drawer-layout.js';
import { insertModeActive } from './editor-state.js';
import type { WorkspaceKeyBindingContext } from './key-binding-context.js';
import type { WorkspaceModel } from './model.js';
import { WorkspaceMessageTypes, type WorkspaceMsg } from './msg.js';
import { WorkspaceKeys } from './workspace-key.js';
import { updateSaveKey } from './workspace-save-key.js';
import { updateMarkdownPreviewKey, updateThemeKey } from './workspace-view-mode-keys.js';

type KeyBindingResult = [WorkspaceModel, Cmd<WorkspaceMsg>[]];

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

function updateQuitKey(msg: KeyMsg, model: WorkspaceModel): KeyBindingResult | undefined {
  if (msg.ctrl && msg.key === WorkspaceKeys.C) {
    return [model, [quit<WorkspaceMsg>()]];
  }
  return !insertModeActive(model) && msg.key === WorkspaceKeys.Q ? [model, [quit<WorkspaceMsg>()]] : undefined;
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
  if (msg.ctrl && !msg.alt && msg.key === WorkspaceKeys.B) {
    return toggleWorkspaceDrawer(model, DrawerKinds.Files, context);
  }
  if (msg.ctrl && !msg.alt && msg.key === WorkspaceKeys.G) {
    return toggleWorkspaceDrawer(model, DrawerKinds.Graft, context);
  }
  return updateEscapeKey(msg, model, context);
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
  return model.focusPane === FocusPanes.Graft && model.graftDrawerOpen
    ? closeDrawer(model, DrawerKinds.Graft, context.createDrawerAnimationCmd)
    : undefined;
}

function toggleWorkspaceDrawer(
  model: WorkspaceModel,
  kind: typeof DrawerKinds.Files | typeof DrawerKinds.Graft,
  context: WorkspaceKeyBindingContext,
): KeyBindingResult {
  return toggleDrawer(model, kind, (nextModel, options) => (
    beginGraftRefresh(nextModel, options, context.deps.graftSession)
  ), context.createDrawerAnimationCmd);
}
