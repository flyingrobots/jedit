import type { Cmd, KeyMsg } from '@flyingrobots/bijou-tui';
import { updateCommandLineKey } from './command-line-key-bindings.js';
import { updateFocusedPaneKey } from './focused-pane-key-bindings.js';
import {
  updateGlobalWorkspaceKey,
  updateHardGlobalWorkspaceKey,
  updateQuitConfirmationKey,
} from './global-key-bindings.js';
import type { WorkspaceKeyBindingContext } from './key-binding-context.js';
import type { WorkspaceModel } from './model.js';
import type { WorkspaceMsg } from './msg.js';
import { clearWorkspaceInlinePanelAfterKey } from './workspace-inline-panel.js';
import { updateScenePickerKey } from './scene-picker-key-bindings.js';
import { updateSettingsKey } from './settings-key-bindings.js';
import { updateStartupFileModalKey } from './startup-file-modal-key-bindings.js';
import { updateTitleScreenKey } from './title-screen-key-bindings.js';

export type { UpdateFromKeyDeps } from './key-binding-context.js';

type KeyBindingResult = [WorkspaceModel, Cmd<WorkspaceMsg>[]];

export function updateFromKey(
  msg: KeyMsg,
  model: WorkspaceModel,
  context: WorkspaceKeyBindingContext,
): KeyBindingResult {
  const result = updateQuitConfirmationKey(msg, model)
    ?? updateHardGlobalWorkspaceKey(msg, model)
    ?? updateWorkspaceOverlayKey(msg, model, context)
    ?? updateGlobalWorkspaceKey(msg, model, context)
    ?? updateFocusedPaneKey(msg, model, context);
  return [
    clearWorkspaceInlinePanelAfterKey(msg, result[0]),
    result[1],
  ];
}

function updateWorkspaceOverlayKey(
  msg: KeyMsg,
  model: WorkspaceModel,
  context: WorkspaceKeyBindingContext,
) {
  return updateStartupFileModalKey(msg, model, context)
    ?? updateSettingsKey(msg, model, context)
    ?? updateScenePickerKey(msg, model, context)
    ?? updateCommandLineKey(msg, model, context)
    ?? updateTitleScreenKey(msg, model, context);
}
