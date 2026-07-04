import type { Cmd, KeyMsg } from '@flyingrobots/bijou-tui';
import { JEDIT_SETTINGS_CLOSE_KEY, JEDIT_SETTINGS_TOGGLE_KEY } from '../keybindings.js';
import {
  updateJeditSettingsFromKey,
  type JeditSettingsRow,
} from '../settings-session.js';
import { beginGraftDiagnosticsRefresh } from './graft-diagnostics.js';
import type { WorkspaceKeyBindingContext } from './key-binding-context.js';
import type { WorkspaceModel } from './model.js';
import type { WorkspaceMsg } from './msg.js';
import { WorkspaceKeys } from './workspace-key.js';
import { settingsRows, workspaceSettingsHandlers } from './settings.js';
import {
  NotificationPlacements,
  NotificationTones,
  NotificationVariants,
  pushNotificationToast,
} from '../../ui/feedback.js';

type KeyBindingResult = [WorkspaceModel, Cmd<WorkspaceMsg>[]];

const SETTINGS_TOAST_TITLE = 'Settings changed';
const SETTINGS_TOAST_SEPARATOR = ' -> ';

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
    const rows = settingsRows(model);
    return withSettingsChangeToast(
      model,
      rows,
      updateJeditSettingsFromKey(
        msg,
        model,
        rows,
        workspaceSettingsHandlers({
          graftDiagnostics: context.deps.graftDiagnostics,
        }),
      ),
      context,
    );
  }

  return undefined;
}

function withSettingsChangeToast(
  before: WorkspaceModel,
  rows: readonly JeditSettingsRow[],
  result: KeyBindingResult,
  context: WorkspaceKeyBindingContext,
): KeyBindingResult {
  const [after, commands] = result;
  const message = settingsChangeMessage(before, after, rows);
  if (message == null) {
    return result;
  }
  const [notified, toastCommands] = pushNotificationToast(
    after,
    {
      title: SETTINGS_TOAST_TITLE,
      message,
      variant: NotificationVariants.Toast,
      tone: NotificationTones.Info,
      placement: NotificationPlacements.LowerRight,
    },
    context.nowMs(),
    context.createNotificationTickCmd,
  );
  return [notified, [...commands, ...toastCommands]];
}

function settingsChangeMessage(
  before: WorkspaceModel,
  after: WorkspaceModel,
  beforeRows: readonly JeditSettingsRow[],
): string | undefined {
  const beforeRow = beforeRows[before.settingsFocusIndex];
  if (beforeRow == null) {
    return undefined;
  }
  const afterRow = settingsRows(after).find((row) => row.id === beforeRow.id);
  const beforeValue = settingRowValue(beforeRow);
  const afterValue = afterRow == null ? beforeValue : settingRowValue(afterRow);
  return beforeValue === afterValue
    ? undefined
    : `${beforeRow.label}: ${beforeValue}${SETTINGS_TOAST_SEPARATOR}${afterValue}`;
}

function settingRowValue(row: JeditSettingsRow): string {
  if (row.valueLabel.length > 0) {
    return row.valueLabel;
  }
  return row.checked === true ? 'On' : 'Off';
}

function updateDiagnosticsPanelKey(
  msg: KeyMsg,
  model: WorkspaceModel,
  context: WorkspaceKeyBindingContext,
): KeyBindingResult {
  if (msg.key === WorkspaceKeys.Escape) {
    return [{ ...model, settingsDiagnosticsOpen: false }, []];
  }
  if (msg.key === JEDIT_SETTINGS_CLOSE_KEY) {
    return [{ ...model, settingsOpen: false, settingsDiagnosticsOpen: false }, []];
  }
  return isDiagnosticsRefreshKey(msg)
    ? beginGraftDiagnosticsRefresh(model, context.deps.graftDiagnostics)
    : [model, []];
}

function isDiagnosticsRefreshKey(msg: KeyMsg): boolean {
  return (
    msg.key === WorkspaceKeys.Enter ||
    msg.key === WorkspaceKeys.Return ||
    msg.key === WorkspaceKeys.Space
  );
}
