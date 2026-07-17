import type { KeyMsg } from '@flyingrobots/bijou-tui';
import { hasFocusablePeers } from '../../ui/panel-focus.js';
import { focusCycleState } from './focus.js';
import type { WorkspaceModel } from './model.js';
import { EditorKeys } from './editor/key.js';
import {
  planWorkspaceTextBackspace,
  planWorkspaceTextDeleteUnderCursor,
  planWorkspaceTextInsert,
  type WorkspaceTextDeletePlan,
  type WorkspaceTextInsertPlan,
  type WorkspaceTextUnsupportedPlan,
} from './workspace-text-edit-planner.js';

const INSERT_TAB_TEXT = '  ';
const INSERT_NEWLINE_TEXT = '\n';
const INSERT_SPACE_TEXT = ' ';
const LOWERCASE_A = 'a';
const LOWERCASE_Z = 'z';
const SINGLE_CHARACTER_KEY_LENGTH = 1;
const SPECIAL_INSERT_TEXT_BY_KEY = new Map<string, string>([
  [EditorKeys.Enter, INSERT_NEWLINE_TEXT],
  [EditorKeys.Tab, INSERT_TAB_TEXT],
  [EditorKeys.Space, INSERT_SPACE_TEXT],
]);

export interface ProductionTextEditProposal {
  readonly plan: WorkspaceTextInsertPlan | WorkspaceTextDeletePlan | WorkspaceTextUnsupportedPlan;
}

export function canEditorTabIndent(model: WorkspaceModel): boolean {
  return !hasFocusablePeers(focusCycleState(model));
}

export function productionInsertEditProposal(
  msg: KeyMsg,
  model: WorkspaceModel,
): ProductionTextEditProposal | undefined {
  const editor = model.editor;
  if (editor == null) {
    return undefined;
  }
  const insertText = insertTextFromKey(msg, model);
  if (insertText != null) {
    return { plan: planWorkspaceTextInsert(editor, insertText) };
  }
  if (msg.key === EditorKeys.Backspace) {
    return { plan: planWorkspaceTextBackspace(editor) };
  }
  return msg.key === EditorKeys.Delete
    ? { plan: planWorkspaceTextDeleteUnderCursor(editor) }
    : undefined;
}

function insertTextFromKey(msg: KeyMsg, model: WorkspaceModel): string | undefined {
  if (msg.ctrl || msg.alt || (msg.key === EditorKeys.Tab && !canEditorTabIndent(model))) {
    return undefined;
  }
  const special = SPECIAL_INSERT_TEXT_BY_KEY.get(msg.key);
  return special ?? singleCharacterTextFromKey(msg);
}

function singleCharacterTextFromKey(msg: KeyMsg): string | undefined {
  if (msg.key.length !== SINGLE_CHARACTER_KEY_LENGTH) {
    return undefined;
  }
  return shouldUppercaseKey(msg)
    ? msg.key.toUpperCase()
    : msg.key;
}

function shouldUppercaseKey(msg: KeyMsg): boolean {
  return msg.shift && msg.key >= LOWERCASE_A && msg.key <= LOWERCASE_Z;
}
