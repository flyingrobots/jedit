import type { Cmd, KeyMsg } from '@flyingrobots/bijou-tui';
import { JEDIT_SETTINGS_TOGGLE_KEY } from '../keybindings.js';
import { updateJeditSettingsFromKey } from '../settings-session.js';
import type { WorkspaceModel } from './model.js';
import type { WorkspaceMsg } from './msg.js';
import { settingsRows, workspaceSettingsHandlers } from './settings.js';

type KeyBindingResult = [WorkspaceModel, Cmd<WorkspaceMsg>[]];

export function updateSettingsKey(
  msg: KeyMsg,
  model: WorkspaceModel,
): KeyBindingResult | undefined {
  if (msg.key === JEDIT_SETTINGS_TOGGLE_KEY) {
    return [{ ...model, settingsOpen: !model.settingsOpen, settingsFocusIndex: 0 }, []];
  }

  if (model.settingsOpen) {
    return updateJeditSettingsFromKey(msg, model, settingsRows(model), workspaceSettingsHandlers);
  }

  return undefined;
}
