import type { Cmd, MouseMsg } from '@flyingrobots/bijou-tui';
import {
  mouseScrollDeltaRows,
  scrollIndexByRows,
  scrollTextViewport,
} from '../../ui/mouse-scroll.js';
import { beginSourceHighlightRefresh } from '../source-highlight-session.js';
import { moveSettingsFocusIndex } from '../settings-session.js';
import type { WorkspaceModel } from './model.js';
import { workspaceSourceHighlightMessage, type WorkspaceMsg } from './msg.js';
import { editorViewport } from './editor-session.js';
import { settingsRows } from './settings.js';
import type { SourceHighlighter } from '../../ports/source-highlighter.js';
import { ViewModes } from './view-mode.js';
import { FocusPanes } from '../../ui/panel-focus.js';

export function updateFromMouse(
  msg: MouseMsg,
  model: WorkspaceModel,
  sourceHighlighter: SourceHighlighter,
): [WorkspaceModel, Cmd<WorkspaceMsg>[]] {
  const deltaRows = mouseScrollDeltaRows(msg);
  if (deltaRows === 0) {
    return [model, []];
  }
  const drawer = updateScrollableDrawerFromMouse(model, deltaRows);
  if (drawer != null) {
    return [drawer, []];
  }
  return updateEditorFromMouse(model, deltaRows, sourceHighlighter);
}

function updateScrollableDrawerFromMouse(model: WorkspaceModel, deltaRows: number): WorkspaceModel | undefined {
  if (model.settingsOpen) {
    return {
      ...model,
      settingsFocusIndex: moveSettingsFocusIndex(model.settingsFocusIndex, deltaRows, settingsRows(model).length),
    };
  }
  if (model.focusPane === FocusPanes.Files && model.fileDrawerOpen) {
    return { ...model, selectedIndex: scrollIndexByRows(model.selectedIndex, model.entries.length, deltaRows) };
  }
  if (model.focusPane === FocusPanes.Graft && model.graftDrawerOpen) {
    return {
      ...model,
      graftSelectedIndex: scrollIndexByRows(model.graftSelectedIndex, graftOutlineLength(model), deltaRows),
    };
  }
  return undefined;
}

function updateEditorFromMouse(
  model: WorkspaceModel,
  deltaRows: number,
  sourceHighlighter: SourceHighlighter,
): [WorkspaceModel, Cmd<WorkspaceMsg>[]] {
  if (model.editor == null) {
    return [model, []];
  }
  const viewport = editorViewport(model);
  const editor = scrollTextViewport(model.editor, deltaRows, viewport.height);
  const next = { ...model, editor };
  return model.viewMode === ViewModes.Source
    ? beginSourceHighlightRefresh<WorkspaceModel, WorkspaceMsg>(next, editor, viewport, sourceHighlighter, workspaceSourceHighlightMessage)
    : [next, []];
}

function graftOutlineLength(model: WorkspaceModel): number {
  return model.graftInfo?.outlineItems.length ?? 0;
}
