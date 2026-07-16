import type { KeyMsg } from "@flyingrobots/bijou-tui";
import type { JeditWhyRangeReport } from "../../ports/jedit-why-range.js";
import { FocusPanes } from "../../ui/panel-focus.js";
import type { EditorState } from "./editor/model.js";
import type { WorkspaceModel } from "./model.js";
import { ViewModes } from "./view-mode.js";
import { WorkspaceKeys } from "./workspace-key.js";
import { WorkspaceTextAuthorityKinds } from "./workspace-text-authority.js";
import { WorkspaceBufferCausalDurabilityKinds } from "./workspace-buffer-durability.js";

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
  readonly detailRows?: readonly string[];
  readonly basisHeadId?: string;
  readonly bufferId?: string;
  readonly whyRangeReport?: JeditWhyRangeReport;
}

export interface WorkspaceInlinePanelAnchor {
  readonly row: number;
  readonly column: number;
}

export type WorkspaceInlinePanelContent = Pick<
  WorkspaceInlinePanel,
  "title" | "message" | "tone" | "detailRows" | "basisHeadId" | "bufferId" | "whyRangeReport"
>;

export function anchoredWorkspaceInlinePanel(
  editor: EditorState,
  panel: WorkspaceInlinePanelContent,
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
  panel: WorkspaceInlinePanelContent,
  anchor: WorkspaceInlinePanelAnchor,
): WorkspaceInlinePanel {
  const anchored: WorkspaceInlinePanel = {
    ...panel,
    anchorRow: anchor.row,
    anchorColumn: anchor.column,
    detailRows: panel.detailRows == null ? undefined : [...panel.detailRows],
  };
  return panel.bufferId == null
    ? anchored
    : {
        ...anchored,
        bufferId: panel.bufferId,
      };
}

export function clearWorkspaceInlinePanelAfterKey(
  msg: KeyMsg,
  model: WorkspaceModel,
): WorkspaceModel {
  if (model.inlinePanel == null) {
    return model;
  }
  return shouldKeepWorkspaceInlinePanel(msg, model, model.inlinePanel)
    ? model
    : { ...model, inlinePanel: undefined };
}

export function workspaceInlinePanelWhyRangeReport(
  model: WorkspaceModel,
): JeditWhyRangeReport | undefined {
  const panel = model.inlinePanel;
  return panel?.whyRangeReport != null && workspaceInlinePanelMatchesModel(model, panel)
    ? panel.whyRangeReport
    : undefined;
}

function shouldKeepWorkspaceInlinePanel(
  msg: KeyMsg,
  model: WorkspaceModel,
  panel: WorkspaceInlinePanel,
): boolean {
  return msg.key !== WorkspaceKeys.Escape &&
    workspaceInlinePanelMatchesModel(model, panel);
}

function workspaceInlinePanelMatchesModel(
  model: WorkspaceModel,
  panel: WorkspaceInlinePanel,
): boolean {
  const editor = model.editor;
  return sourceEditorOwnsInlinePanel(model) &&
    editor != null &&
    editor.cursorRow === panel.anchorRow &&
    editor.cursorCol === panel.anchorColumn &&
    inlinePanelMatchesActiveBuffer(model, panel) &&
    workspaceInlinePanelBasisMatchesModel(model, panel.basisHeadId);
}

export function workspaceInlinePanelBasisMatchesModel(
  model: WorkspaceModel,
  basisHeadId: string | undefined,
): boolean {
  if (basisHeadId == null) {
    return true;
  }
  return model.textAuthority.kind === WorkspaceTextAuthorityKinds.Opened &&
    model.textAuthority.durability.causal.kind === WorkspaceBufferCausalDurabilityKinds.Admitted &&
    model.textAuthority.durability.causal.headId === basisHeadId;
}

function sourceEditorOwnsInlinePanel(model: WorkspaceModel): boolean {
  return model.focusPane === FocusPanes.Editor &&
    model.viewMode === ViewModes.Source &&
    model.quitConfirmOpen !== true &&
    model.settingsOpen !== true &&
    model.scenePickerOpen !== true &&
    model.startupFileModalOpen !== true &&
    model.commandLine.active !== true;
}

function inlinePanelMatchesActiveBuffer(
  model: WorkspaceModel,
  panel: WorkspaceInlinePanel,
): boolean {
  if (panel.bufferId == null) {
    return true;
  }
  return model.textAuthority.kind === WorkspaceTextAuthorityKinds.Opened &&
    model.textAuthority.bufferId === panel.bufferId;
}
