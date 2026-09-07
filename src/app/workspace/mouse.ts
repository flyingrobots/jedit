import type { Cmd, MouseMsg } from '@flyingrobots/bijou-tui';
import {
  mouseScrollDeltaRows,
  scrollIndexByRows,
  scrollTextViewport,
} from '../../ui/mouse-scroll.js';
import { updateTitleCameraFromMouseLook } from '../title-camera-session.js';
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
} from './viewport.js';
import { FocusPanes } from '../../ui/panel-focus.js';
import { workspaceDrawerHasFocus } from './focused-pane-key-bindings.js';
import { beginWorkspaceSourceHighlightRefresh } from './workspace-source-highlight.js';
import { TITLE_BACKDROP_KIND } from '../../ui/title-screen.js';

const DRAWER_PAD_MULTIPLIER = 2;
const MOUSE_PRESS = 'press';
const MOUSE_BUTTON_LEFT = 'left';

export function updateFromMouse(
  msg: MouseMsg,
  model: WorkspaceModel,
  sourceHighlighter: SourceHighlighter,
): [WorkspaceModel, Cmd<WorkspaceMsg>[]] {
  const clicked = updateFileDrawerFromClick(msg, model);
  if (clicked != null) {
    return [clicked, []];
  }
  const deltaRows = mouseScrollDeltaRows(msg);
  if (deltaRows === 0) {
    return updateTitleCameraFromMouse(msg, model);
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
  if (!model.fileDrawerOpen) {
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
  const row = msg.row - WORKSPACE_BODY_TOP_OFFSET - DRAWER_INNER_PAD;
  const listHeight = workspaceBodyHeight({
    rows: model.rows,
    footerVisible: model.footerVisible,
  }) - (DRAWER_INNER_PAD * DRAWER_PAD_MULTIPLIER);
  if (row < 0 || row >= listHeight) {
    return undefined;
  }
  const index = row + listScrollOffset(
    model.selectedIndex,
    model.entries.length,
    listHeight,
  );
  return index < model.entries.length ? index : undefined;
}

function updateTitleCameraFromMouse(
  msg: MouseMsg,
  model: WorkspaceModel,
): [WorkspaceModel, Cmd<WorkspaceMsg>[]] {
  if (!titleMouseLookEnabled(model)) {
    return [model, []];
  }
  const result = updateTitleCameraFromMouseLook(
    { col: msg.col, row: msg.row },
    model.titleCamera,
    model.titleMouseLook,
  );
  return [
    {
      ...model,
      titleCamera: result.state,
      titleMouseLook: result.pointer,
      titleBackdropKind: TITLE_BACKDROP_KIND.LegacyScene,
    },
    [],
  ];
}

// Mouse-look activates the ray-traced backdrop, so it must not trigger while a
// drawer holds focus. Moving the pointer over the file explorer used to switch
// the ray tracer on without the reader asking for it.
function titleMouseLookEnabled(model: WorkspaceModel): boolean {
  return (
    model.editor == null &&
    !workspaceDrawerHasFocus(model) &&
    !model.settingsOpen &&
    !model.scenePickerOpen &&
    !model.startupFileModalOpen &&
    !model.quitConfirmOpen &&
    !model.commandLine.active
  );
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
    ? beginWorkspaceSourceHighlightRefresh(next, viewport, sourceHighlighter)
    : [next, []];
}

function graftOutlineLength(model: WorkspaceModel): number {
  return model.graftInfo?.outlineItems.length ?? 0;
}
