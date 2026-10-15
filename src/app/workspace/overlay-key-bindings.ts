import type { KeyMsg } from '@flyingrobots/bijou-tui';
import { updateCommandLineKey } from './command-line-key-bindings.js';
import { updateSettingsKey } from './settings-key-bindings.js';
import { updateStartupFileModalKey } from './startup-file-modal-key-bindings.js';
import { updateTitleScreenKey } from './title-screen-key-bindings.js';
import type { WorkspaceKeyBindingContext } from './key-binding-context.js';
import type { WorkspaceModel } from './model.js';

export function updateWorkspaceOverlayKey(
  msg: KeyMsg,
  model: WorkspaceModel,
  context: WorkspaceKeyBindingContext,
) {
  return updateStartupFileModalKey(msg, model, context)
    ?? updateSettingsKey(msg, model, context)
    ?? updateCommandLineKey(msg, model, context)
    ?? updateTitleScreenKey(msg, model);
}
