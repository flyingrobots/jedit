import { beginSourceHighlightRefresh } from '../source-highlight-session.js';
import { editorViewport, type WorkspaceViewport } from './viewport.js';
import type { Cmd } from '@flyingrobots/bijou-tui';
import type { WorkspaceModel } from './model.js';
import type { WorkspaceMsg } from './msg.js';
import type { EditorState } from './editor/model.js';
import type { EditorFilePort } from '../../ports/editor-file.js';
import type { GraftSessionPort } from '../../ports/graft-session.js';
import type { SourceHighlighter } from '../../ports/source-highlighter.js';
import { isMarkdownFile } from './file-types.js';
import {
  ensureEditorVisible,
  scrollPreview,
  normalizeEditor,
  updateInsertMode,
  updateNormalMode,
} from './editor-editing.js';

export interface EditorSessionPorts {
  readonly editorFile: EditorFilePort;
  readonly sourceHighlighter: SourceHighlighter;
  readonly graftSession: GraftSessionPort;
}

export function isWorkspaceMarkdownFile(path: string): boolean {
  return isMarkdownFile(path);
}

export function loadEditor(filePath: string, editorFile: EditorFilePort): EditorState {
  try {
    const file = editorFile.loadEditorFile(filePath);

    return ensureEditorVisible({
      path: filePath,
      lines: file.lines,
      cursorRow: 0,
      cursorCol: 0,
      scrollRow: 0,
      scrollCol: 0,
      dirty: false,
      readOnly: file.readOnly,
      mode: 'normal',
      undoStack: [],
      redoStack: [],
    }, Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER);
  } catch (error) {
    return {
      path: filePath,
      lines: [String(error)],
      cursorRow: 0,
      cursorCol: 0,
      scrollRow: 0,
      scrollCol: 0,
      dirty: false,
      readOnly: true,
      mode: 'normal',
      undoStack: [],
      redoStack: [],
    };
  }
}

export function saveEditor(editor: EditorState, editorFile: EditorFilePort): EditorState {
  if (editor.readOnly) {
    return editor;
  }

  editorFile.saveEditorFile(editor.path, editor.lines);
  return {
    ...editor,
    dirty: false,
  };
}

export function toggleMarkdownPreview(
  model: WorkspaceModel,
  sourceHighlighter: SourceHighlighter,
): [WorkspaceModel, Cmd<WorkspaceMsg>[]] {
  if (model.editor == null || !isWorkspaceMarkdownFile(model.editor.path)) {
    return [model, []];
  }

  const next: WorkspaceModel = {
    ...model,
    editor: normalizeEditor(model.editor),
    viewMode: model.viewMode === 'source' ? 'preview' : 'source',
  };

  if (next.viewMode === 'source') {
    return beginSourceHighlightRefresh(
      next,
      next.editor,
      editorViewport(next),
      sourceHighlighter,
    );
  }

  return [next, []];
}

export function beginEditorProjectionRefresh(
  model: WorkspaceModel,
  refreshGraft: boolean,
  ports: EditorSessionPorts,
): [WorkspaceModel, Cmd<WorkspaceMsg>[]] {
  const [withGraft, graftCmds] = beginGraftRefresh(model, refreshGraft, ports.graftSession);
  const [withHighlight, highlightCmds] = beginSourceHighlightRefresh(
    withGraft,
    withGraft.editor,
    editorViewport(withGraft),
    ports.sourceHighlighter,
  );
  return [withHighlight, [...graftCmds, ...highlightCmds]];
}

export function beginGraftRefresh(
  model: WorkspaceModel,
  force: boolean,
  graftSession: GraftSessionPort,
): [WorkspaceModel, Cmd<WorkspaceMsg>[]] {
  if (model.editor == null) {
    return [{
      ...model,
      graftInfo: undefined,
      graftLoading: false,
      graftSelectedIndex: 0,
    }, []];
  }

  if (!force && model.graftInfo?.path === model.editor.path && model.graftInfo.dirty === model.editor.dirty) {
    return [model, []];
  }

  const requestId = model.graftRequestId + 1;
  const sameFile = model.graftInfo?.path === model.editor.path;

  return [
    {
      ...model,
      graftLoading: true,
      graftRequestId: requestId,
      graftInfo: sameFile ? model.graftInfo : undefined,
      graftSelectedIndex: sameFile ? model.graftSelectedIndex : 0,
    },
    [requestGraftInfoCmd(
      requestId,
      model.workspaceRoot,
      model.editor.path,
      model.editor.dirty,
      graftSession,
    )],
  ];
}

function requestGraftInfoCmd(
  requestId: number,
  workspaceRoot: string,
  filePath: string,
  dirty: boolean,
  graftSession: GraftSessionPort,
): Cmd<WorkspaceMsg> {
  return async () => {
    try {
      return {
        type: 'graft-info',
        requestId,
        info: await graftSession.loadGraftInfo(workspaceRoot, filePath, dirty),
      };
    } catch (cause) {
      return {
        type: 'graft-info',
        requestId,
        info: graftSession.failedGraftInfo(workspaceRoot, filePath, dirty, cause instanceof Error ? cause.message : String(cause)),
      };
    }
  };
}

export function editorViewportHeight(model: WorkspaceModel): WorkspaceViewport {
  return editorViewport(model);
}

export {
  ensureEditorVisible,
  normalizeEditor,
  updateInsertMode,
  updateNormalMode,
  scrollPreview,
};
