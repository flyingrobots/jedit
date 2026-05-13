import { quit, type Cmd, type KeyMsg } from '@flyingrobots/bijou-tui';
import { JEDIT_MARKDOWN_PREVIEW_TOGGLE_KEY, JEDIT_THEME_TOGGLE_KEY } from '../keybindings.js';
import { beginEditorProjectionRefresh, beginGraftRefresh, saveEditor, toggleMarkdownPreview } from './editor-session.js';
import { closeDrawer, toggleDrawer } from './drawer.js';
import { focusCycleState } from './focus.js';
import { cycleFocusPane, FocusPanes, hasFocusablePeers } from '../../ui/panel-focus.js';
import { isFooterToggleKey } from '../../ui/feedback.js';
import { nextJeditTheme } from '../../ui/jedit-themes.js';
import { DrawerKinds } from '../../ui/drawer-layout.js';
import { EditorModes } from './editor/mode.js';
import type { WorkspaceKeyBindingContext } from './key-binding-context.js';
import type { WorkspaceModel } from './model.js';
import { WorkspaceMessageTypes, type WorkspaceMsg } from './msg.js';
import { ViewModes } from './view-mode.js';
import { WorkspaceKeys } from './workspace-key.js';

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

function updateSaveKey(
  msg: KeyMsg,
  model: WorkspaceModel,
  context: WorkspaceKeyBindingContext,
): KeyBindingResult | undefined {
  if (!msg.ctrl || msg.alt || msg.key !== WorkspaceKeys.S || model.editor == null) {
    return undefined;
  }

  const editor = saveEditor(model.editor, context.deps.editorFile);
  return beginEditorProjectionRefresh({ ...model, editor }, shouldRefreshGraft(model, editor.path), context.deps);
}

function updateThemeKey(msg: KeyMsg, model: WorkspaceModel): KeyBindingResult | undefined {
  if (!msg.ctrl || msg.alt || msg.key !== JEDIT_THEME_TOGGLE_KEY) {
    return undefined;
  }
  return [{ ...model, jeditTheme: nextJeditTheme(model.jeditTheme) }, []];
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

function updateMarkdownPreviewKey(
  msg: KeyMsg,
  model: WorkspaceModel,
  context: WorkspaceKeyBindingContext,
): KeyBindingResult | undefined {
  return msg.key === JEDIT_MARKDOWN_PREVIEW_TOGGLE_KEY
    ? toggleMarkdownPreview(model, context.deps.sourceHighlighter)
    : undefined;
}

function toggleWorkspaceDrawer(
  model: WorkspaceModel,
  kind: typeof DrawerKinds.Files | typeof DrawerKinds.Graft,
  context: WorkspaceKeyBindingContext,
): KeyBindingResult {
  return toggleDrawer(model, kind, (nextModel, force) => (
    beginGraftRefresh(nextModel, force, context.deps.graftSession)
  ), context.createDrawerAnimationCmd);
}

function shouldRefreshGraft(model: WorkspaceModel, editorPath: string): boolean {
  return model.graftDrawerOpen || model.graftInfo?.path === editorPath;
}

function insertModeActive(model: WorkspaceModel): boolean {
  return model.focusPane === FocusPanes.Editor
    && model.viewMode === ViewModes.Source
    && model.editor?.mode === EditorModes.Insert;
}
