import type { KeyMsg } from '@flyingrobots/bijou-tui';
import { updateFocusedPaneKey } from './focused-pane-key-bindings.js';
import { updateGlobalWorkspaceKey, updatePerfWorkspaceKey, updateQuitConfirmationKey } from './global-key-bindings.js';
import type { WorkspaceKeyBindingContext } from './key-binding-context.js';
import type { WorkspaceModel } from './model.js';
import { updateScenePickerKey } from './scene-picker-key-bindings.js';
import { updateSettingsKey } from './settings-key-bindings.js';
import { updateTitleScreenKey } from './title-screen-key-bindings.js';

export type { UpdateFromKeyDeps } from './key-binding-context.js';

export function updateFromKey(
  msg: KeyMsg,
  model: WorkspaceModel,
  context: WorkspaceKeyBindingContext,
) {
  return updateQuitConfirmationKey(msg, model)
    ?? updatePerfWorkspaceKey(msg, model)
    ?? updateSettingsKey(msg, model)
    ?? updateScenePickerKey(msg, model, context)
    ?? updateTitleScreenKey(msg, model, context)
    ?? updateGlobalWorkspaceKey(msg, model, context)
    ?? updateFocusedPaneKey(msg, model, context);
}
