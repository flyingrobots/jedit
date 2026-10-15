import { updateWorkspaceOverlayKey } from './overlay-key-bindings.js';
import { updateDojoFeedKey } from './dojo-feed.js';
import type { Cmd, KeyMsg } from '@flyingrobots/bijou-tui';
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
import { updateFileSearchInputKey } from './file-search-input-key.js';

export type { UpdateFromKeyDeps } from './key-binding-context.js';

type KeyBindingResult = [WorkspaceModel, Cmd<WorkspaceMsg>[]];

export function updateFromKey(
  msg: KeyMsg,
  model: WorkspaceModel,
  context: WorkspaceKeyBindingContext,
): KeyBindingResult {
  const result = updateQuitConfirmationKey(msg, model)
    ?? updateDojoFeedKey(msg, model)
    ?? updateFileSearchInputKey(msg, model)
    ?? updateHardGlobalWorkspaceKey(msg, model)
    ?? updateWorkspaceOverlayKey(msg, model, context)
    ?? updateGlobalWorkspaceKey(msg, model, context)
    ?? updateFocusedPaneKey(msg, model, context);
  return [
    clearWorkspaceInlinePanelAfterKey(msg, result[0]),
    result[1],
  ];
}
