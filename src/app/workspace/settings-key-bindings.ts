import type { Cmd, KeyMsg } from '@flyingrobots/bijou-tui';
import { JEDIT_SETTINGS_TOGGLE_KEY } from '../keybindings.js';
import { updateJeditSettingsFromKey } from '../settings-session.js';
import { beginGraftDiagnosticsRefresh } from './graft-diagnostics.js';
import type { WorkspaceKeyBindingContext } from './key-binding-context.js';
import type { WorkspaceModel } from './model.js';
import type { WorkspaceMsg } from './msg.js';
import { WorkspaceKeys } from './workspace-key.js';
import { settingsRows, workspaceSettingsHandlers } from './settings.js';

type KeyBindingResult = [WorkspaceModel, Cmd<WorkspaceMsg>[]];
const SPACE_KEY = ' ';

export function updateSettingsKey(
  msg: KeyMsg,
  model: WorkspaceModel,
  context: WorkspaceKeyBindingContext,
): KeyBindingResult | undefined {
  if (msg.key === JEDIT_SETTINGS_TOGGLE_KEY) {
    return [{
      ...model,
      settingsOpen: !model.settingsOpen,
      settingsFocusIndex: 0,
      settingsDiagnosticsOpen: false,
    }, []];
  }

  if (model.settingsOpen) {
    if (model.settingsDiagnosticsOpen) {
      return updateDiagnosticsPanelKey(msg, model, context);
    }
    return updateJeditSettingsFromKey(
      msg,
      model,
      settingsRows(model),
      workspaceSettingsHandlers({
        graftDiagnostics: context.deps.graftDiagnostics,
      }),
    );
  }

  return undefined;
}

function updateDiagnosticsPanelKey(
  msg: KeyMsg,
  model: WorkspaceModel,
  context: WorkspaceKeyBindingContext,
): KeyBindingResult {
  if (msg.key === WorkspaceKeys.Escape) {
    return [{ ...model, settingsDiagnosticsOpen: false }, []];
  }
  return isDiagnosticsRefreshKey(msg)
    ? beginGraftDiagnosticsRefresh(model, context.deps.graftDiagnostics)
    : [model, []];
}

function isDiagnosticsRefreshKey(msg: KeyMsg): boolean {
  return (
    msg.key === WorkspaceKeys.Enter ||
    msg.key === WorkspaceKeys.Return ||
    msg.key === WorkspaceKeys.Space ||
    msg.key === SPACE_KEY
  );
}
