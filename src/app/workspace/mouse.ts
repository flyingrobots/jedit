import { updateFileExplorerPointer } from './file-explorer-pointer.js';
import type { DirectoryExpansionContext } from './directory-change-failure.js';
import type { Cmd, MouseMsg } from '@flyingrobots/bijou-tui';
import {
  mouseScrollDeltaRows,
  scrollIndexByRows,
  scrollTextViewport,
} from '../../ui/mouse-scroll.js';
import { moveSettingsFocusIndex } from '../settings-session.js';
import type { WorkspaceModel } from './model.js';
import type { WorkspaceMsg } from './msg.js';
import { editorViewport } from './editor-session.js';
import { settingsRows } from './settings.js';
import type { SourceHighlighter } from '../../ports/source-highlighter.js';
import { ViewModes } from './view-mode.js';
import { FocusPanes } from '../../ui/panel-focus.js';
import { beginWorkspaceSourceHighlightRefresh } from './workspace-source-highlight.js';
import { scrollFileSearchSelection } from './file-search.js';


export function updateFromMouse(
  msg: MouseMsg,
  model: WorkspaceModel,
  sourceHighlighter: SourceHighlighter,
  directoryContext?: DirectoryExpansionContext,
): [WorkspaceModel, Cmd<WorkspaceMsg>[]] {
  const pointer = updateFileExplorerPointer(msg, model, directoryContext);
  if (pointer != null) return pointer;
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

// Row and column map onto the pinned list the renderer drew: the drawer is blitted at
// (layout.fileDrawer.x, WORKSPACE_BODY_TOP_OFFSET) and its content is inset by
// DRAWER_INNER_PAD. Filtered positions map through the scroll offset back to
// original entry indexes.
function updateScrollableDrawerFromMouse(model: WorkspaceModel, deltaRows: number): WorkspaceModel | undefined {
  if (model.settingsOpen) {
    return {
      ...model,
      settingsFocusIndex: moveSettingsFocusIndex(model.settingsFocusIndex, deltaRows, settingsRows(model).length),
    };
  }
  if (model.focusPane === FocusPanes.Files && model.fileDrawerOpen) {
    return scrollFileSearchSelection(model, deltaRows);
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
    ? beginWorkspaceSourceHighlightRefresh(next, viewport, sourceHighlighter)
    : [next, []];
}

function graftOutlineLength(model: WorkspaceModel): number {
  return model.graftInfo?.outlineItems.length ?? 0;
}
