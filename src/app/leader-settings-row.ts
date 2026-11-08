import { LeaderKey } from '../domain/leader-key.js';
import { LEADER_INPUT_KEYS } from './leader-input-keys.js';
import { JimSettingsIssueKinds, type JimSettingsIssue } from '../ports/jim-settings.js';
import {
  JEDIT_SETTING_ACTION,
  JEDIT_SETTING_ROW_KIND,
  type JeditSettingsI18nState,
  type JeditSettingsRow,
} from './settings-session.js';

export const LEADER_SETTING_ROW_ID = 'leader';
export interface LeaderSettingsState {
  readonly leaderKey?: LeaderKey;
  readonly leaderCaptureActive?: boolean;
  readonly leaderCaptureInvalid?: boolean;
  readonly leaderSettingsIssue?: JimSettingsIssue;
}

const COPY = Object.freeze({
  Section: 'settings.sections.keybindings',
  Label: 'settings.rows.leader.label',
  Description: 'settings.rows.leader.description',
  Capture: 'settings.rows.leader.capture',
  CapturingValue: 'settings.rows.leader.capturing_value',
  Space: 'settings.rows.leader.space',
  Backslash: 'settings.rows.leader.backslash',
  Invalid: 'settings.rows.leader.invalid',
  Input: 'settings.rows.leader.invalid_key',
  Read: 'settings.rows.leader.read_error',
  Write: 'settings.rows.leader.write_error',
  Unavailable: 'settings.rows.leader.unavailable',
} as const);

const ISSUE_COPY = new Map([
  [JimSettingsIssueKinds.Invalid, COPY.Invalid],
  [JimSettingsIssueKinds.Read, COPY.Read],
  [JimSettingsIssueKinds.Write, COPY.Write],
  [JimSettingsIssueKinds.Unavailable, COPY.Unavailable],
]);

export function leaderSettingsRow(
  state: LeaderSettingsState & { readonly i18n: JeditSettingsI18nState },
): JeditSettingsRow {
  const key = state.leaderKey ?? LeaderKey.Default;
  return {
    id: LEADER_SETTING_ROW_ID,
    section: state.i18n.t(COPY.Section),
    label: state.i18n.t(COPY.Label),
    description: leaderDescription(state),
    valueLabel: state.leaderCaptureActive
      ? state.i18n.t(COPY.CapturingValue)
      : leaderValueLabel(key, state.i18n),
    kind: JEDIT_SETTING_ROW_KIND.Choice,
    action: JEDIT_SETTING_ACTION.CaptureLeader,
  };
}

function leaderValueLabel(key: LeaderKey, i18n: JeditSettingsI18nState): string {
  if (key.value === LEADER_INPUT_KEYS.LiteralSpace) return i18n.t(COPY.Space);
  return key.value === LeaderKey.Default.value ? i18n.t(COPY.Backslash) : key.value;
}

function leaderDescription(state: LeaderSettingsState & { readonly i18n: JeditSettingsI18nState }): string {
  if (state.leaderCaptureActive) {
    return state.i18n.t(state.leaderCaptureInvalid ? COPY.Input : COPY.Capture);
  }
  const issue = state.leaderSettingsIssue;
  if (issue != null) {
    const message = state.i18n.t(ISSUE_COPY.get(issue.kind) ?? COPY.Invalid);
    return issue.detail == null ? message : `${message} ${issue.detail}`;
  }
  return state.i18n.t(COPY.Description);
}
