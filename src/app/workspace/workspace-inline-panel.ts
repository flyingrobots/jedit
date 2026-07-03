import type { KeyMsg } from "@flyingrobots/bijou-tui";
import type { EditorState } from "./editor/model.js";
import type { WorkspaceModel } from "./model.js";
import { WorkspaceKeys } from "./workspace-key.js";

export const WORKSPACE_INLINE_PANEL_TONE = Object.freeze({
  Info: "info",
  Warning: "warning",
} as const);

export type WorkspaceInlinePanelTone =
  (typeof WORKSPACE_INLINE_PANEL_TONE)[keyof typeof WORKSPACE_INLINE_PANEL_TONE];

export interface WorkspaceInlinePanel {
  readonly title: string;
  readonly message: string;
  readonly tone: WorkspaceInlinePanelTone;
  readonly anchorRow: number;
  readonly anchorColumn: number;
}

export interface WorkspaceInlinePanelAnchor {
  readonly row: number;
  readonly column: number;
}

export function anchoredWorkspaceInlinePanel(
  editor: EditorState,
  panel: Pick<WorkspaceInlinePanel, "title" | "message" | "tone">,
): WorkspaceInlinePanel {
  return workspaceInlinePanelAtAnchor(panel, workspaceInlinePanelAnchorFromEditor(editor));
}

export function workspaceInlinePanelAnchorFromEditor(
  editor: EditorState,
): WorkspaceInlinePanelAnchor {
  return {
    row: editor.cursorRow,
    column: editor.cursorCol,
  };
}

export function workspaceInlinePanelAtAnchor(
  panel: Pick<WorkspaceInlinePanel, "title" | "message" | "tone">,
  anchor: WorkspaceInlinePanelAnchor,
): WorkspaceInlinePanel {
  return {
    ...panel,
    anchorRow: anchor.row,
    anchorColumn: anchor.column,
  };
}

export function clearWorkspaceInlinePanelAfterKey(
  msg: KeyMsg,
  model: WorkspaceModel,
): WorkspaceModel {
  if (model.inlinePanel == null) {
    return model;
  }
  return shouldKeepWorkspaceInlinePanel(msg, model.editor, model.inlinePanel)
    ? model
    : { ...model, inlinePanel: undefined };
}

function shouldKeepWorkspaceInlinePanel(
  msg: KeyMsg,
  editor: EditorState | undefined,
  panel: WorkspaceInlinePanel,
): boolean {
  return (
    msg.key !== WorkspaceKeys.Escape &&
    editor != null &&
    editor.cursorRow === panel.anchorRow &&
    editor.cursorCol === panel.anchorColumn
  );
}
