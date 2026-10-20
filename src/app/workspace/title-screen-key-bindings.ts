import type { Cmd, KeyMsg } from '@flyingrobots/bijou-tui';
import { workspaceDrawerHasFocus } from './focused-pane-key-bindings.js';
import type { WorkspaceModel } from './model.js';
import type { WorkspaceMsg } from './msg.js';
import { WorkspaceKeys } from './workspace-key.js';

type KeyBindingResult = [WorkspaceModel, Cmd<WorkspaceMsg>[]];

export function updateTitleScreenKey(msg: KeyMsg, model: WorkspaceModel): KeyBindingResult | undefined {
  if (model.editor != null || workspaceDrawerHasFocus(model)) {
    return undefined;
  }
  return msg.key === WorkspaceKeys.Escape
    ? [{ ...model, quitConfirmOpen: true }, []]
    : undefined;
}
