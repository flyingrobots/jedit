import type { EditorMode, PendingNormal } from './mode.js';

export const RegisterKinds = Object.freeze({
  Char: 'char',
  Line: 'line',
} as const);

export type RegisterKind = typeof RegisterKinds[keyof typeof RegisterKinds];

export interface RegisterState {
  readonly kind: RegisterKind;
  readonly text: string;
  readonly source?: RegisterSourceState;
}
export interface RegisterSourceState {
  readonly basisDigest: string;
  readonly operation: string;
  readonly rangeEnd: number;
  readonly rangeStart: number;
}
export type VimRepeatTargetShape = 'charwise' | 'linewise';
export interface VimRepeatTargetState {
  readonly basisDigest: string;
  readonly rangeEnd: number;
  readonly rangeStart: number;
  readonly shape: VimRepeatTargetShape;
}
export interface VimRepeatState {
  readonly description: string;
  readonly keys: readonly string[];
  readonly replayPolicy?: 'resolve-current-basis';
  readonly sourceBasisDigest?: string;
  readonly target?: VimRepeatTargetState;
}
export interface VimMarkState {
  readonly basisDigest: string;
  readonly column: number;
  readonly row: number;
}
export const VimSearchDirections = Object.freeze({
  Backward: 'backward',
  Forward: 'forward',
} as const);
export type VimSearchDirection = typeof VimSearchDirections[keyof typeof VimSearchDirections];
export interface VimSearchState {
  readonly direction: VimSearchDirection;
  readonly pattern: string;
  readonly searchId?: string;
}
export interface HistoryEntry {
  readonly lines: readonly string[];
  readonly cursorRow: number;
  readonly cursorCol: number;
  readonly scrollRow: number;
  readonly scrollCol: number;
  readonly dirty: boolean;
  readonly transitionRequestId?: number;
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
  readonly pendingVimKeys?: readonly string[];
  readonly register?: RegisterState;
  readonly registers?: Readonly<Record<string, RegisterState>>;
  readonly lastVimEdit?: VimRepeatState;
  readonly marks?: Readonly<Record<string, VimMarkState>>;
  readonly lastSearch?: VimSearchState;
  readonly undoStack: readonly HistoryEntry[];
  readonly redoStack: readonly HistoryEntry[];
}
