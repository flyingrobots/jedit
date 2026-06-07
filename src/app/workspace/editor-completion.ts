import {
  type InlineCompletionItem,
} from "../../ui/inline-completion-popup.js";
import type { EditorState } from "./editor/model.js";
import type { WorkspaceModel } from "./model.js";

const EDITOR_COMPLETION_FIRST_INDEX = 0;
const EDITOR_COMPLETION_CURSOR_STEP = 1;
const EDITOR_COMPLETION_EMPTY_PREFIX = "";
const EDITOR_COMPLETION_WORD_CHAR_PATTERN = /[A-Za-z0-9_$-]/;

export interface WorkspaceEditorCompletionContext {
  readonly filePath: string;
  readonly lineText: string;
  readonly cursorRow: number;
  readonly cursorCol: number;
  readonly wordStartCol: number;
  readonly wordEndCol: number;
  readonly prefix: string;
}

export interface WorkspaceEditorCompletionProvider {
  readonly id: string;
  complete(
    context: WorkspaceEditorCompletionContext,
  ): readonly InlineCompletionItem[];
}

export interface WorkspaceEditorCompletionRegistry {
  readonly providers: readonly WorkspaceEditorCompletionProvider[];
}

export interface WorkspaceEditorCompletionRequest {
  readonly model: WorkspaceModel;
  readonly registry: WorkspaceEditorCompletionRegistry;
}

export const EMPTY_WORKSPACE_EDITOR_COMPLETION_REGISTRY: WorkspaceEditorCompletionRegistry =
  Object.freeze({ providers: [] });

export function workspaceEditorCompletionContext(
  model: WorkspaceModel,
): WorkspaceEditorCompletionContext | undefined {
  return model.editor == null
    ? undefined
    : editorCompletionContext(model.editor);
}

export function workspaceEditorCompletionItems(
  request: WorkspaceEditorCompletionRequest,
): readonly InlineCompletionItem[] {
  const context = workspaceEditorCompletionContext(request.model);
  return context == null
    ? []
    : request.registry.providers.flatMap((provider) =>
        provider.complete(context),
      );
}

function editorCompletionContext(
  editor: EditorState,
): WorkspaceEditorCompletionContext {
  const cursorRow = clampedCursorRow(editor);
  const lineText = editor.lines[cursorRow] ?? EDITOR_COMPLETION_EMPTY_PREFIX;
  const cursorCol = clampedCursorCol(editor, lineText);
  const wordStartCol = wordStartIndex(lineText, cursorCol);
  return {
    filePath: editor.path,
    lineText,
    cursorRow,
    cursorCol,
    wordStartCol,
    wordEndCol: cursorCol,
    prefix: lineText.slice(wordStartCol, cursorCol),
  };
}

function clampedCursorRow(editor: EditorState): number {
  return Math.max(
    EDITOR_COMPLETION_FIRST_INDEX,
    Math.min(
      Math.max(EDITOR_COMPLETION_FIRST_INDEX, editor.lines.length - 1),
      editor.cursorRow,
    ),
  );
}

function clampedCursorCol(editor: EditorState, lineText: string): number {
  return Math.max(
    EDITOR_COMPLETION_FIRST_INDEX,
    Math.min(lineText.length, editor.cursorCol),
  );
}

function wordStartIndex(lineText: string, cursorCol: number): number {
  let index = cursorCol;
  while (
    index > EDITOR_COMPLETION_FIRST_INDEX &&
    EDITOR_COMPLETION_WORD_CHAR_PATTERN.test(
      lineText[index - EDITOR_COMPLETION_CURSOR_STEP] ??
        EDITOR_COMPLETION_EMPTY_PREFIX,
    )
  ) {
    index -= EDITOR_COMPLETION_CURSOR_STEP;
  }
  return index;
}
