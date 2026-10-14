import type { Cmd, KeyMsg } from '@flyingrobots/bijou-tui';
import { fileSearchHasFocus, fileExplorerHasFocus, fileSearchState, fileSearchWithInput, EMPTY_FILE_SEARCH, type FileSearchState } from './file-search.js';
import type { WorkspaceModel } from './model.js';
import type { WorkspaceMsg } from './msg.js';

const KEYS = Object.freeze({
  Left: 'left', Right: 'right', Home: 'home', End: 'end', Backspace: 'backspace', Delete: 'delete',
  Space: 'space', Clear: 'u', Filter: '/', Escape: 'escape', Enter: 'enter',
});
const LITERAL_SPACE = ' ';
const SINGLE_KEY_LENGTH = 1;
const NON_PRINTABLE = /[\p{Cc}\p{Cf}\p{Cs}\p{Zl}\p{Zp}]/u;
const FORWARD_STEP = 1;
const BACKWARD_STEP = -1;
type Edit = (state: FileSearchState) => FileSearchState;
const EDITS = new Map<string, Edit>([
  [KEYS.Left, (state) => moveCursor(state, BACKWARD_STEP)],
  [KEYS.Right, (state) => moveCursor(state, FORWARD_STEP)],
  [KEYS.Home, (state) => ({ ...state, cursorIndex: 0 })],
  [KEYS.End, (state) => ({ ...state, cursorIndex: Array.from(state.input).length })],
  [KEYS.Backspace, deleteBeforeCursor],
  [KEYS.Delete, deleteAtCursor],
]);

export function updateFileSearchInputKey(
  msg: KeyMsg,
  model: WorkspaceModel,
): [WorkspaceModel, Cmd<WorkspaceMsg>[]] | undefined {
  if (!fileExplorerHasFocus(model)) return undefined;
  const mode = updateFilterMode(msg, model);
  if (mode != null) return mode;
  if (!fileSearchHasFocus(model)) return undefined;
  const state = fileSearchState(model);
  const next = editFromKey(msg, state);
  if (next == null) return undefined;
  if (next.input !== state.input) return [fileSearchWithInput(model, next), []];
  return [next.cursorIndex === state.cursorIndex ? model : { ...model, fileSearch: next }, []];
}

function editFromKey(msg: KeyMsg, state: FileSearchState): FileSearchState | undefined {
  if (isClearKey(msg)) return EMPTY_FILE_SEARCH;
  if (msg.ctrl || msg.alt) return undefined;
  const edit = EDITS.get(msg.key);
  if (edit != null) return edit(state);
  const input = printableInput(msg);
  return input == null ? undefined : insertAtCursor(state, input);
}

function isClearKey(msg: KeyMsg): boolean {
  return msg.ctrl === true && !msg.alt && msg.key === KEYS.Clear;
}

function printableInput(msg: KeyMsg): string | undefined {
  const value = msg.key === KEYS.Space ? LITERAL_SPACE : msg.key;
  return Array.from(value).length === SINGLE_KEY_LENGTH && !NON_PRINTABLE.test(value)
    ? (msg.shift ? value.toUpperCase() : value)
    : undefined;
}

function moveCursor(state: FileSearchState, delta: number): FileSearchState {
  return { ...state, cursorIndex: Math.max(0, Math.min(Array.from(state.input).length, state.cursorIndex + delta)) };
}

function insertAtCursor(state: FileSearchState, input: string): FileSearchState {
  const characters = Array.from(state.input);
  characters.splice(state.cursorIndex, 0, ...Array.from(input));
  return { input: characters.join(''), cursorIndex: state.cursorIndex + Array.from(input).length };
}

function deleteBeforeCursor(state: FileSearchState): FileSearchState {
  if (state.cursorIndex <= 0) return state;
  const characters = Array.from(state.input);
  characters.splice(state.cursorIndex - FORWARD_STEP, FORWARD_STEP);
  return { input: characters.join(''), cursorIndex: state.cursorIndex - FORWARD_STEP };
}

function deleteAtCursor(state: FileSearchState): FileSearchState {
  const characters = Array.from(state.input);
  characters.splice(state.cursorIndex, FORWARD_STEP);
  return { input: characters.join(''), cursorIndex: state.cursorIndex };
}

function updateFilterMode(msg: KeyMsg, model: WorkspaceModel): [WorkspaceModel, Cmd<WorkspaceMsg>[]] | undefined {
  if (msg.ctrl || msg.alt) return undefined;
  if (!model.fileSearchEditing) {
    return msg.key === KEYS.Filter ? [{ ...model, fileSearchEditing: true }, []] : undefined;
  }
  return msg.key === KEYS.Escape || msg.key === KEYS.Enter
    ? [{ ...model, fileSearchEditing: false }, []]
    : undefined;
}
