import type { EditorMode, PendingNormal } from './mode.js';

export const RegisterKinds = Object.freeze({
  Char: 'char',
  Line: 'line',
} as const);

export type RegisterKind = typeof RegisterKinds[keyof typeof RegisterKinds];

export interface RegisterState {
  readonly kind: RegisterKind;
  readonly text: string;
}
export interface HistoryEntry {
  readonly lines: readonly string[];
  readonly cursorRow: number;
  readonly cursorCol: number;
  readonly scrollRow: number;
  readonly scrollCol: number;
  readonly dirty: boolean;
}
export interface EditorState {
  readonly path: string;
  readonly lines: readonly string[];
  readonly cursorRow: number;
  readonly cursorCol: number;
  readonly scrollRow: number;
  readonly scrollCol: number;
  readonly dirty: boolean;
  readonly readOnly: boolean;
  readonly mode: EditorMode;
  readonly pendingNormal?: PendingNormal;
  readonly register?: RegisterState;
  readonly undoStack: readonly HistoryEntry[];
  readonly redoStack: readonly HistoryEntry[];
}
