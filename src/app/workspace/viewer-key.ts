import type { Cmd, KeyMsg } from '@flyingrobots/bijou-tui';
import { hasFocusablePeers } from '../../ui/panel-focus.js';
import type { SourceHighlighter } from '../../ports/source-highlighter.js';
import {
  beginSourceHighlightRefresh,
  shouldRefreshSourceHighlight,
} from '../source-highlight-session.js';
import {
  editorViewport,
  scrollPreview,
  updateInsertMode,
  updateNormalMode,
} from './editor-session.js';
import { EditorModes } from './editor/mode.js';
import { focusCycleState } from './focus.js';
import type { WorkspaceModel } from './model.js';
import { workspaceSourceHighlightMessage, type WorkspaceMsg } from './msg.js';
import { ViewModes } from './view-mode.js';

export function updateViewerFromKey(
  msg: KeyMsg,
  model: WorkspaceModel,
  sourceHighlighter: SourceHighlighter,
): [WorkspaceModel, Cmd<WorkspaceMsg>[]] {
  if (model.editor == null) {
    return [model, []];
  }

  const viewport = editorViewport(model);
  if (model.viewMode === ViewModes.Preview) {
    return [{
      ...model,
      editor: scrollPreview(model.editor, msg, viewport.height),
    }, []];
  }

  const canTabIndent = !hasFocusablePeers(focusCycleState(model));
  const editor = model.editor.mode === EditorModes.Insert
    ? updateInsertMode(model.editor, msg, {
      viewportWidth: viewport.width,
      viewportHeight: viewport.height,
      allowTabIndent: canTabIndent,
    })
    : updateNormalMode(model.editor, msg, viewport.width, viewport.height);

  const next: WorkspaceModel = {
    ...model,
    editor,
  };

  return shouldRefreshSourceHighlight(model.editor, editor)
    ? beginSourceHighlightRefresh(next, editor, viewport, sourceHighlighter, workspaceSourceHighlightMessage)
    : [next, []];
}
