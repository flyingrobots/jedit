import type { Cmd, KeyMsg } from '@flyingrobots/bijou-tui';
import { LeaderKey, LEADER_INPUT_KEYS } from '../leader-key.js';
import { JEDIT_SETTINGS_TOGGLE_KEY } from '../keybindings.js';
import { JimSettingsIssueKinds } from '../../ports/jim-settings.js';
import type { WorkspaceKeyBindingContext } from './key-binding-context.js';
import type { WorkspaceModel } from './model.js';
import type { WorkspaceMsg } from './msg.js';

type KeyBindingResult = [WorkspaceModel, Cmd<WorkspaceMsg>[]];
const FORCE_QUIT_KEY = 'c';

export function updateLeaderKeyCapture(
  msg: KeyMsg,
  model: WorkspaceModel,
  context: WorkspaceKeyBindingContext,
): KeyBindingResult | undefined {
  if (!captureHasFocus(model) || isForceQuit(msg)) {
    return undefined;
  }
  if (msg.key === LEADER_INPUT_KEYS.Escape || msg.key === JEDIT_SETTINGS_TOGGLE_KEY) {
    return [cancelLeaderCapture(msg, model), []];
  }
  const value = msg.key === LEADER_INPUT_KEYS.Space ? LEADER_INPUT_KEYS.LiteralSpace : msg.key;
  const leader = captureKey(msg, value);
  return leader == null
    ? [{ ...model, leaderSettingsIssue: { kind: JimSettingsIssueKinds.Input } }, []]
    : [saveLeader(model, leader, context), []];
}

function cancelLeaderCapture(msg: KeyMsg, model: WorkspaceModel): WorkspaceModel {
  return {
    ...model,
    settingsOpen: msg.key !== JEDIT_SETTINGS_TOGGLE_KEY,
    leaderCaptureActive: false,
    leaderSettingsIssue: model.leaderSettingsIssue?.kind === JimSettingsIssueKinds.Input
      ? undefined
      : model.leaderSettingsIssue,
  };
}

function saveLeader(model: WorkspaceModel, leader: LeaderKey, context: WorkspaceKeyBindingContext): WorkspaceModel {
  const port = context.deps.jimSettings;
  const issue = port == null
    ? { kind: JimSettingsIssueKinds.Unavailable }
    : port.saveLeader(leader);
  return {
    ...model,
    leaderKey: issue == null ? leader : model.leaderKey,
    leaderCaptureActive: false,
    leaderSettingsIssue: issue,
  };
}

function captureHasFocus(model: WorkspaceModel): boolean {
  return model.settingsOpen && model.leaderCaptureActive;
}

function isForceQuit(msg: KeyMsg): boolean {
  return msg.ctrl === true && msg.key === FORCE_QUIT_KEY;
}

function captureKey(msg: KeyMsg, value: string): LeaderKey | undefined {
  return msg.ctrl || msg.alt ? undefined : LeaderKey.from(value);
}
