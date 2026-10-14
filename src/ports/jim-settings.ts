import type { LeaderKey } from '../app/leader-key.js';

export const JimSettingsIssueKinds = Object.freeze({
  Invalid: Symbol('jim.settings.invalid'),
  Read: Symbol('jim.settings.read'),
  Write: Symbol('jim.settings.write'),
  Unavailable: Symbol('jim.settings.unavailable'),
} as const);

export interface JimSettingsIssue {
  readonly kind: typeof JimSettingsIssueKinds[keyof typeof JimSettingsIssueKinds];
  readonly detail?: string;
}

export interface JimSettingsSnapshot {
  readonly leaderKey: LeaderKey;
  readonly issue?: JimSettingsIssue;
}

export interface JimSettingsPort {
  load(): JimSettingsSnapshot;
  saveLeader(leader: LeaderKey): JimSettingsIssue | undefined;
}
