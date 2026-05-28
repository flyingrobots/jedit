import type { KeyMsg } from '@flyingrobots/bijou-tui';

export const WorkspaceKeys = Object.freeze({
  Backtick: '`',
  One: '1',
  Two: '2',
  Period: '.',
  C: 'c',
  Q: 'q',
  S: 's',
  B: 'b',
  G: 'g',
  H: 'h',
  J: 'j',
  K: 'k',
  L: 'l',
  R: 'r',
  Escape: 'escape',
  Tab: 'tab',
  Backspace: 'backspace',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  ArrowUp: 'up',
  ArrowDown: 'down',
  PageUp: 'pageup',
  PageDown: 'pagedown',
  Enter: 'enter',
  Return: 'return',
} as const);

export type WorkspaceKey = typeof WorkspaceKeys[keyof typeof WorkspaceKeys];

export function isWorkspaceRefreshKey(msg: KeyMsg): boolean {
  return msg.key === WorkspaceKeys.R;
}

export function isWorkspaceBackKey(msg: KeyMsg): boolean {
  return msg.key === WorkspaceKeys.Backspace || msg.key === WorkspaceKeys.ArrowLeft || msg.key === WorkspaceKeys.H;
}

export function isWorkspaceDownKey(msg: KeyMsg): boolean {
  return msg.key === WorkspaceKeys.ArrowDown || msg.key === WorkspaceKeys.J;
}

export function isWorkspaceUpKey(msg: KeyMsg): boolean {
  return msg.key === WorkspaceKeys.ArrowUp || msg.key === WorkspaceKeys.K;
}

export function isWorkspaceOpenKey(msg: KeyMsg): boolean {
  return msg.key === WorkspaceKeys.Enter || msg.key === WorkspaceKeys.ArrowRight || msg.key === WorkspaceKeys.L;
}

export function isWorkspaceScenePickerCloseKey(msg: KeyMsg): boolean {
  return msg.key === WorkspaceKeys.Escape;
}

export function isWorkspaceScenePickerPreviousKey(msg: KeyMsg): boolean {
  return isWorkspaceUpKey(msg);
}

export function isWorkspaceScenePickerNextKey(msg: KeyMsg): boolean {
  return isWorkspaceDownKey(msg);
}

export function isWorkspaceScenePickerAcceptKey(msg: KeyMsg): boolean {
  return msg.key === WorkspaceKeys.Enter || msg.key === WorkspaceKeys.Return;
}
