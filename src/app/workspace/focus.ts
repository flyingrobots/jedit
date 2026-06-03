import { shouldClearPendingNormalOnPaneChange, type FocusCycleState, type FocusPane } from '../../ui/panel-focus.js';
import type { WorkspaceModel } from './model.js';
import type { EditorState } from './editor/model.js';

export function focusCycleState(
  model: Pick<WorkspaceModel, 'fileDrawerOpen' | 'graftDrawerOpen' | 'historyDrawerOpen' | 'editor' | 'focusPane'>,
): FocusCycleState {
  return {
    fileDrawerOpen: model.fileDrawerOpen,
    graftDrawerOpen: model.graftDrawerOpen,
    historyDrawerOpen: model.historyDrawerOpen,
    hasEditor: model.editor != null,
    focusPane: model.focusPane,
  };
}

export function clearPendingNormal(editor: EditorState): EditorState {
  if (editor.pendingNormal == null) {
    return editor;
  }
  return {
    ...editor,
    pendingNormal: undefined,
  };
}

export function withFocusPane<Model extends { readonly focusPane: FocusPane; readonly editor?: EditorState }>(
  model: Model,
  focusPane: FocusPane,
): Model {
  if (model.focusPane === focusPane) {
    return model;
  }

  if (model.editor == null || !shouldClearPendingNormalOnPaneChange(model.focusPane, focusPane)) {
    return {
      ...model,
      focusPane,
    };
  }

  return {
    ...model,
    focusPane,
    editor: clearPendingNormal(model.editor),
  };
}
