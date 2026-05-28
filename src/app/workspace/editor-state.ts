import { FocusPanes } from '../../ui/panel-focus.js';
import { EditorModes } from './editor/mode.js';
import type { WorkspaceModel } from './model.js';
import { ViewModes } from './view-mode.js';

export function insertModeActive(model: WorkspaceModel): boolean {
  return model.focusPane === FocusPanes.Editor
    && model.viewMode === ViewModes.Source
    && model.editor?.mode === EditorModes.Insert;
}
