import type { KeyMsg } from '@flyingrobots/bijou-tui';
import { graftVisibleOutlineRows } from '../../ui/workspace-render.js';
import { DRAWER_INNER_PAD } from './viewport.js';
import { clampIndex } from './viewport.js';
import { workspaceBodyHeight } from './viewport.js';
import { editorViewport, ensureEditorVisible } from './editor-session.js';
import { withFocusPane } from './focus.js';
import { FocusPanes } from '../../ui/panel-focus.js';
import { WorkspaceKeys, isWorkspaceDownKey, isWorkspaceRefreshKey, isWorkspaceUpKey } from './workspace-key.js';
import type { WorkspaceModel } from './model.js';
import type { WorkspaceMsg } from './msg.js';
import type { Cmd } from '@flyingrobots/bijou-tui';

const GRAFT_META_ROWS = 5;
const GRAFT_CHANGE_ROWS = 5;

export function updateGraftDrawerFromKey(
  msg: KeyMsg,
  model: WorkspaceModel,
  beginGraftRefresh: (model: WorkspaceModel, force: boolean) => [WorkspaceModel, Cmd<WorkspaceMsg>[]],
): [WorkspaceModel, Cmd<WorkspaceMsg>[]] {
  if (isWorkspaceRefreshKey(msg)) {
    return beginGraftRefresh(model, true);
  }

  const graftInfo = model.graftInfo;
  if (graftInfo == null || graftInfo.outlineItems.length === 0) {
    return [model, []];
  }

  if (isWorkspaceDownKey(msg)) {
    return [{
      ...model,
      graftSelectedIndex: clampIndex(model.graftSelectedIndex + 1, graftInfo.outlineItems.length),
    }, []];
  }

  if (isWorkspaceUpKey(msg)) {
    return [{
      ...model,
      graftSelectedIndex: clampIndex(model.graftSelectedIndex - 1, graftInfo.outlineItems.length),
    }, []];
  }

  const visible = graftVisibleOutlineRows(
    workspaceBodyHeight(model.rows, model.footerVisible),
    DRAWER_INNER_PAD,
    GRAFT_META_ROWS,
    GRAFT_CHANGE_ROWS,
  );

  if (msg.key === WorkspaceKeys.PageUp) {
    return [{
      ...model,
      graftSelectedIndex: clampIndex(model.graftSelectedIndex - visible, graftInfo.outlineItems.length),
    }, []];
  }

  if (msg.key === WorkspaceKeys.PageDown) {
    return [{
      ...model,
      graftSelectedIndex: clampIndex(model.graftSelectedIndex + visible, graftInfo.outlineItems.length),
    }, []];
  }

  if (!msg.ctrl && !msg.alt && !msg.shift && msg.key === WorkspaceKeys.G) {
    return [{
      ...model,
      graftSelectedIndex: 0,
    }, []];
  }

  if (!msg.ctrl && !msg.alt && msg.shift && msg.key === WorkspaceKeys.G) {
    return [{
      ...model,
      graftSelectedIndex: graftInfo.outlineItems.length - 1,
    }, []];
  }

  if (msg.key === WorkspaceKeys.Enter && model.editor != null) {
    const selected = graftInfo.outlineItems[model.graftSelectedIndex];
    if (selected == null) {
      return [model, []];
    }

    const viewport = editorViewport(model);
    const editor = ensureEditorVisible({
      ...model.editor,
      cursorRow: Math.max(0, selected.startLine - 1),
      cursorCol: 0,
    }, viewport.width, viewport.height);

    return [
      withFocusPane({
        ...model,
        editor,
      }, FocusPanes.Editor),
      [],
    ];
  }

  return [model, []];
}
