import type { KeyMsg } from '@flyingrobots/bijou-tui';
import { hasFocusablePeers } from '../../ui/panel-focus.js';
import { editorViewport, updateInsertMode } from './editor-session.js';
import { EditorKeys } from './editor/key.js';
import { focusCycleState } from './focus.js';
import type { WorkspaceModel } from './model.js';
import {
  planWorkspaceTextBackspace,
  planWorkspaceTextDeleteUnderCursor,
  planWorkspaceTextInsert,
  WorkspaceTextEditPlanKinds,
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

export interface OptimisticProductionTextMutation {
  readonly model: WorkspaceModel;
  readonly plan: WorkspaceTextInsertPlan | WorkspaceTextDeletePlan | WorkspaceTextUnsupportedPlan;
}

export function canEditorTabIndent(model: WorkspaceModel): boolean {
  return !hasFocusablePeers(focusCycleState(model));
}

export function optimisticProductionInsertMutation(
  msg: KeyMsg,
  model: WorkspaceModel,
): OptimisticProductionTextMutation | undefined {
  const editor = model.editor;
  if (editor == null) {
    return undefined;
  }

  const viewport = editorViewport(model);
  const moved = updateInsertMode(editor, msg, {
    viewportWidth: viewport.width,
    viewportHeight: viewport.height,
    allowTabIndent: canEditorTabIndent(model),
  });
  return insertMutation(msg, model, editor, moved)
    ?? backspaceMutation(msg, model, editor, moved)
    ?? deleteUnderCursorMutation(msg, model, editor, moved);
}

function insertMutation(
  msg: KeyMsg,
  model: WorkspaceModel,
  editor: NonNullable<WorkspaceModel['editor']>,
  moved: NonNullable<WorkspaceModel['editor']>,
): OptimisticProductionTextMutation | undefined {
  const insertText = insertTextFromKey(msg);
  if (insertText == null || moved.lines === editor.lines) {
    return undefined;
  }
  return {
    model: modelWithOptimisticEditor(model, moved),
    plan: planWorkspaceTextInsert(editor, insertText),
  };
}

function backspaceMutation(
  msg: KeyMsg,
  model: WorkspaceModel,
  editor: NonNullable<WorkspaceModel['editor']>,
  moved: NonNullable<WorkspaceModel['editor']>,
): OptimisticProductionTextMutation | undefined {
  return msg.key === EditorKeys.Backspace
    ? deleteMutation(model, editor, moved, planWorkspaceTextBackspace(editor))
    : undefined;
}

function deleteUnderCursorMutation(
  msg: KeyMsg,
  model: WorkspaceModel,
  editor: NonNullable<WorkspaceModel['editor']>,
  moved: NonNullable<WorkspaceModel['editor']>,
): OptimisticProductionTextMutation | undefined {
  return msg.key === EditorKeys.Delete
    ? deleteMutation(model, editor, moved, planWorkspaceTextDeleteUnderCursor(editor))
    : undefined;
}

function deleteMutation(
  model: WorkspaceModel,
  editor: NonNullable<WorkspaceModel['editor']>,
  moved: NonNullable<WorkspaceModel['editor']>,
  plan: WorkspaceTextDeletePlan | WorkspaceTextUnsupportedPlan,
): OptimisticProductionTextMutation {
  return plan.kind === WorkspaceTextEditPlanKinds.Unsupported || moved.lines === editor.lines
    ? { model, plan }
    : {
      model: modelWithOptimisticEditor(model, moved),
      plan,
    };
}

function modelWithOptimisticEditor(
  model: WorkspaceModel,
  editor: NonNullable<WorkspaceModel['editor']>,
): WorkspaceModel {
  return {
    ...model,
    editor,
  };
}

function insertTextFromKey(msg: KeyMsg): string | undefined {
  if (msg.ctrl || msg.alt) {
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
