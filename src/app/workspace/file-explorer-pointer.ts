import type { Cmd, MouseMsg } from '@flyingrobots/bijou-tui';
import { fileSearchCursorAtColumn } from '../../ui/file-search-input.js';
import { fileSearchInputOptions, fileFilterPromptWidth, fileFilterPromptX } from '../../ui/workspace-file-filter-prompt.js';
import { resolveWorkspaceLayout } from '../../ui/drawer-layout.js';
import { FocusPanes } from '../../ui/panel-focus.js';
import { fileSearchEntries, fileSearchState } from './file-search.js';
import { DRAWER_INNER_PAD, listScrollOffset, workspaceBodyHeight, WORKSPACE_BODY_TOP_OFFSET,
  FILE_SEARCH_ROW, FILE_SEARCH_LIST_TOP, fileSearchListHeight, workspaceFooterRows } from './viewport.js';
import { toggleFileTreeDirectory } from './file-tree-expansion.js';
import type { DirectoryExpansionContext } from './directory-change-failure.js';
import type { WorkspaceModel } from './model.js';
import type { WorkspaceMsg } from './msg.js';

const MOUSE_PRESS = 'press';
const MOUSE_MOVE = 'move';
const MOUSE_BUTTON_LEFT = 'left';

export function updateFileExplorerPointer(
  msg: MouseMsg,
  model: WorkspaceModel,
  context?: DirectoryExpansionContext,
): [WorkspaceModel, Cmd<WorkspaceMsg>[]] | undefined {
  const hover = updateFileDrawerHover(msg, model);
  if (hover != null) return [hover, []];
  const input = updateFooterFilterFromClick(msg, model) ?? updateFileSearchFromClick(msg, model);
  if (input != null) return [input, []];
  const clicked = updateFileDrawerFromClick(msg, model);
  if (clicked == null) return undefined;
  return context == null ? [clicked, []] : toggleFileTreeDirectory(clicked, context);
}

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
    : { ...model, focusPane: FocusPanes.Files, selectedIndex: index, fileSearchEditing: false };
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
  const listHeight = fileSearchListHeight(workspaceBodyHeight(model));
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

function updateFileDrawerHover(msg: MouseMsg, model: WorkspaceModel): WorkspaceModel | undefined {
  if (msg.action !== MOUSE_MOVE) return undefined;
  const index = fileDrawerEntryIndexAt(msg, model);
  return model.fileHoveredIndex === index ? model : { ...model, fileHoveredIndex: index };
}

function fileDrawerPointerEnabled(model: WorkspaceModel): boolean {
  return model.fileDrawerOpen && !model.settingsOpen && !model.quitConfirmOpen &&
    !model.startupFileModalOpen && !model.commandLine?.active;
}

function updateFileSearchFromClick(msg: MouseMsg, model: WorkspaceModel): WorkspaceModel | undefined {
  if (msg.action !== MOUSE_PRESS || msg.button !== MOUSE_BUTTON_LEFT || !fileDrawerPointerEnabled(model)) return undefined;
  if (msg.row !== WORKSPACE_BODY_TOP_OFFSET + FILE_SEARCH_ROW) return undefined;
  if (fileSearchState(model).input.length === 0) return undefined;
  const layout = resolveWorkspaceLayout(model.columns, model.fileDrawerProgress, model.graftDrawerProgress).fileDrawer;
  if (msg.col <= layout.x || msg.col >= layout.x + layout.width - DRAWER_INNER_PAD) return undefined;
  return { ...model, focusPane: FocusPanes.Files, fileSearchEditing: true };
}

function updateFooterFilterFromClick(msg: MouseMsg, model: WorkspaceModel): WorkspaceModel | undefined {
  if (!model.fileSearchEditing || !fileDrawerPointerEnabled(model)) return undefined;
  if (msg.action !== MOUSE_PRESS || msg.button !== MOUSE_BUTTON_LEFT || msg.row !== model.rows - workspaceFooterRows(model)) return undefined;
  const width = fileFilterPromptWidth(model);
  const column = msg.col - fileFilterPromptX(model);
  if (column < 0 || column >= width) return undefined;
  return { ...model, fileSearch: { ...fileSearchState(model),
    cursorIndex: fileSearchCursorAtColumn(fileSearchInputOptions(model, width), column) } };
}
