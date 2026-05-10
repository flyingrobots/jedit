import type { Cmd, KeyMsg, MouseMsg } from '@flyingrobots/bijou-tui';
import { clamp01, clampIndex } from '../../main.js';
import {
  applyNotificationState,
  notificationTickCmd,
} from '../../ui/feedback.js';
import { scrollIndexByRows, scrollTextViewport } from '../../ui/mouse-scroll.js';
import { beginSourceHighlightRefresh } from '../../main.js';
import { SOURCE_HIGHLIGHT_MESSAGE, reduceSourceHighlightMsg } from '../source-highlight-session.js';
import type { WorkspaceModel } from './model.js';
import type { WorkspaceMsg } from './msg.js';
import { type EditorState } from './editor/model.js';
import { type ViewMode } from './view-mode.js';

export function updateFromMouse(msg: MouseMsg, model: WorkspaceModel): [WorkspaceModel, Cmd<WorkspaceMsg>[]] {
  const deltaRows = scrollIndexByRows(msg.deltaY); // Assuming msg.deltaY provides scroll delta
  if (deltaRows === 0) {
    return [model, []];
  }
  if (model.settingsOpen) {
    return [{ ...model, settingsFocusIndex: moveSettingsFocusIndex(model.settingsFocusIndex, deltaRows, settingsRows(model).length) }, []];
  }
  if (model.focusPane === 'files' && model.fileDrawerOpen) {
    return [{ ...model, selectedIndex: scrollIndexByRows(model.selectedIndex, model.entries.length, deltaRows) }, []];
  }
  if (model.focusPane === 'graft' && model.graftDrawerOpen) {
    return [{ ...model, graftSelectedIndex: scrollIndexByRows(model.graftSelectedIndex, model.graftInfo?.outlineItems.length ?? 0, deltaRows) }, []];
  }
  if (model.editor == null) {
    return [model, []];
  }
  const viewport = editorViewport(model);
  const editor = scrollTextViewport(model.editor, deltaRows, viewport.height);
  const next = { ...model, editor };
  return model.viewMode === 'source'
    ? beginSourceHighlightRefresh<WorkspaceModel, WorkspaceMsg>(next, editor, viewport, sourceHighlighter)
    : [next, []];
}
