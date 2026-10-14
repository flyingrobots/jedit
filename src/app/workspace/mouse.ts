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
import { resolveWorkspaceLayout } from '../../ui/drawer-layout.js';
import {
  DRAWER_INNER_PAD,
  listScrollOffset,
  workspaceBodyHeight,
  WORKSPACE_BODY_TOP_OFFSET,
  FILE_SEARCH_ROW,
  FILE_SEARCH_LIST_TOP,
  fileSearchListHeight,
} from './viewport.js';
import { FocusPanes } from '../../ui/panel-focus.js';
import { beginWorkspaceSourceHighlightRefresh } from './workspace-source-highlight.js';
import { fileSearchEntries, fileSearchState, scrollFileSearchSelection, selectedFileSearchEntry } from './file-search.js';
import { fileSearchCursorAtColumn } from '../../ui/file-search-input.js';
import { fileSearchInputOptions } from './file-explorer-view.js';

const DRAWER_PAD_MULTIPLIER = 2;
const MOUSE_PRESS = 'press';
const MOUSE_BUTTON_LEFT = 'left';

// Opening on click needs the filesystem and Echo dependencies the pointer path
// does not otherwise carry. Injecting a named opener keeps that dependency
// explicit and lets the selection-only behaviour stand on its own when the
// caller has nothing to open with.
export interface WorkspaceEntryOpener {
  readonly nowMs: () => number;
  readonly openEntry: (
    model: WorkspaceModel,
    entry: NonNullable<WorkspaceModel['entries'][number]>,
  ) => [WorkspaceModel, Cmd<WorkspaceMsg>[]];
}

export function updateFromMouse(
  msg: MouseMsg,
  model: WorkspaceModel,
  sourceHighlighter: SourceHighlighter,
  opener?: WorkspaceEntryOpener,
): [WorkspaceModel, Cmd<WorkspaceMsg>[]] {
  const input = updateFileSearchFromClick(msg, model);
  if (input != null) return [input, []];
  const clicked = updateFileDrawerFromClick(msg, model);
  if (clicked != null) {
    return openClickedEntry(clicked, opener);
  }
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

// Row and column map onto the list the renderer drew: the drawer is blitted at
// (layout.fileDrawer.x, WORKSPACE_BODY_TOP_OFFSET) and its content is inset by
// DRAWER_INNER_PAD. Entry index equals line index because the list does not
// scroll -- long directories are truncated rather than paged today.
function updateFileDrawerFromClick(
  msg: MouseMsg,
  model: WorkspaceModel,
): WorkspaceModel | undefined {
  if (msg.action !== MOUSE_PRESS || msg.button !== MOUSE_BUTTON_LEFT) {
    return undefined;
  }
  const index = fileDrawerEntryIndexAt(msg, model);
  return index == null
    ? undefined
    : { ...model, focusPane: FocusPanes.Files, selectedIndex: index };
}

function fileDrawerEntryIndexAt(
  msg: MouseMsg,
  model: WorkspaceModel,
): number | undefined {
  if (!fileDrawerPointerEnabled(model)) {
    return undefined;
  }
  const drawer = resolveWorkspaceLayout(
    model.columns,
    model.fileDrawerProgress,
    model.graftDrawerProgress,
  ).fileDrawer;
  const withinDrawer = drawer.width > 0
    && msg.col >= drawer.x + DRAWER_INNER_PAD
    && msg.col < (drawer.x + drawer.width) - DRAWER_INNER_PAD;
  if (!withinDrawer) {
    return undefined;
  }
  const row = msg.row - WORKSPACE_BODY_TOP_OFFSET - FILE_SEARCH_LIST_TOP;
  const listHeight = fileSearchListHeight(workspaceBodyHeight({
    rows: model.rows,
    footerVisible: model.footerVisible,
  }));
  if (row < 0 || row >= listHeight) {
    return undefined;
  }
  const entries = fileSearchEntries(model);
  const position = entries.findIndex(({ index }) => index === model.selectedIndex);
  const index = row + listScrollOffset(
    position,
    entries.length,
    listHeight,
  );
  return entries[index]?.index;
}

function openClickedEntry(
  model: WorkspaceModel,
  opener: WorkspaceEntryOpener | undefined,
): [WorkspaceModel, Cmd<WorkspaceMsg>[]] {
  const entry = selectedFileSearchEntry(model);
  if (opener == null || entry == null) {
    return [model, []];
  }
  return opener.openEntry(model, entry);
}

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

function fileDrawerPointerEnabled(model: WorkspaceModel): boolean {
  return model.fileDrawerOpen && !model.settingsOpen && !model.quitConfirmOpen &&
    !model.startupFileModalOpen && !model.commandLine?.active;
}

function updateFileSearchFromClick(msg: MouseMsg, model: WorkspaceModel): WorkspaceModel | undefined {
  if (msg.action !== MOUSE_PRESS || msg.button !== MOUSE_BUTTON_LEFT || !fileDrawerPointerEnabled(model)) return undefined;
  if (msg.row !== WORKSPACE_BODY_TOP_OFFSET + FILE_SEARCH_ROW) return undefined;
  const layout = resolveWorkspaceLayout(model.columns, model.fileDrawerProgress, model.graftDrawerProgress).fileDrawer;
  const innerWidth = layout.width - DRAWER_INNER_PAD * DRAWER_PAD_MULTIPLIER;
  const column = msg.col - layout.x - DRAWER_INNER_PAD;
  if (column < 0 || column >= innerWidth) return undefined;
  return {
    ...model, focusPane: FocusPanes.Files,
    fileSearch: {
      ...fileSearchState(model),
      cursorIndex: fileSearchCursorAtColumn(fileSearchInputOptions(model, innerWidth), column),
    },
  };
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
