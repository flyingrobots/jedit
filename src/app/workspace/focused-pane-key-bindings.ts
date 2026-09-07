import type { Cmd, KeyMsg } from '@flyingrobots/bijou-tui';
import { FocusPanes } from '../../ui/panel-focus.js';
import { updateGraftDrawerFromKey } from './graft-drawer.js';
import { updateTreeFromKey } from './file-tree.js';
import { updateViewerFromKey } from './viewer.js';
import { beginGraftRefresh } from './editor-session.js';
import type { WorkspaceKeyBindingContext } from './key-binding-context.js';
import type { WorkspaceModel } from './model.js';
import type { WorkspaceMsg } from './msg.js';

type KeyBindingResult = [WorkspaceModel, Cmd<WorkspaceMsg>[]];

// A focused drawer owns its own navigation keys. Without this, the title
// screen's camera bindings claimed the arrow keys whenever no file was open,
// so arrows did nothing in the explorer and quietly switched on the
// ray-traced backdrop instead.
export function workspaceDrawerHasFocus(model: WorkspaceModel): boolean {
  return (
    (model.focusPane === FocusPanes.Files && model.fileDrawerOpen) ||
    (model.focusPane === FocusPanes.Graft && model.graftDrawerOpen)
  );
}

export function updateFocusedPaneKey(
  msg: KeyMsg,
  model: WorkspaceModel,
  context: WorkspaceKeyBindingContext,
): KeyBindingResult {
  if (model.focusPane === FocusPanes.Files && model.fileDrawerOpen) {
    return updateTreeFromKey(msg, model, context.nowMs, context.deps);
  }

  if (model.focusPane === FocusPanes.Graft && model.graftDrawerOpen) {
    return updateGraftDrawerFromKey(msg, model, (nextModel, options) => (
      beginGraftRefresh(nextModel, options, context.deps.graftSession)
    ));
  }

  return updateViewerFromKey(
    msg,
    model,
    context.deps.sourceHighlighter,
    context.deps.productionTextSession,
  );
}
