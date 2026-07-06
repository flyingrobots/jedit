import { beginSourceHighlightRefresh } from '../source-highlight-session.js';
import { joinLines } from '../editor-lines.js';
import { editorViewport, type WorkspaceViewport } from './viewport.js';
import type { Cmd } from '@flyingrobots/bijou-tui';
import type { WorkspaceModel } from './model.js';
import { WorkspaceMessageTypes, workspaceSourceHighlightMessage, type WorkspaceMsg } from './msg.js';
import type { EditorState } from './editor/model.js';
import {
  isLoadedEditorFile,
  isMissingEditorFile,
  type EditorFilePort,
} from '../../ports/editor-file.js';
import type { GraftFileRequest, GraftSessionPort } from '../../ports/graft-session.js';
import type { SourceHighlighter } from '../../ports/source-highlighter.js';
import { isMarkdownFile } from './file-types.js';
import { ViewModes } from './view-mode.js';
import {
  ensureEditorVisible,
  scrollPreview,
  normalizeEditor,
  updateInsertMode,
  updateNormalMode,
} from './editor-editing.js';
import { EditorModes } from './editor/mode.js';

const INITIAL_EDITOR_VIEWPORT_WIDTH = Number.MAX_SAFE_INTEGER;
const INITIAL_EDITOR_VIEWPORT_HEIGHT = Number.MAX_SAFE_INTEGER;

export interface EditorSessionPorts {
  readonly editorFile: EditorFilePort;
  readonly sourceHighlighter: SourceHighlighter;
  readonly graftSession: GraftSessionPort;
}

export interface EditorProjectionRefreshOptions {
  readonly refreshGraft: boolean;
}

export interface GraftRefreshOptions {
  readonly force: boolean;
}

export function isWorkspaceMarkdownFile(path: string): boolean {
  return isMarkdownFile(path);
}

export function loadEditor(filePath: string, editorFile: EditorFilePort): EditorState {
  try {
    const file = editorFile.loadEditorFile(filePath);
    if (isMissingEditorFile(file)) {
      return emptyEditor(filePath);
    }
    if (!isLoadedEditorFile(file)) {
      return readOnlyErrorEditor(filePath, file.kind);
    }

    return ensureEditorVisible({
      path: filePath,
      lines: file.lines,
      cursorRow: 0,
      cursorCol: 0,
      scrollRow: 0,
      scrollCol: 0,
      dirty: false,
      readOnly: file.readOnly,
      mode: EditorModes.Normal,
      undoStack: [],
      redoStack: [],
    }, INITIAL_EDITOR_VIEWPORT_WIDTH, INITIAL_EDITOR_VIEWPORT_HEIGHT);
  } catch (error) {
    return readOnlyErrorEditor(filePath, String(error));
  }
}

function readOnlyErrorEditor(filePath: string, message: string): EditorState {
  return {
    path: filePath,
    lines: [message],
    cursorRow: 0,
    cursorCol: 0,
    scrollRow: 0,
    scrollCol: 0,
    dirty: false,
    readOnly: true,
    mode: EditorModes.Normal,
    undoStack: [],
    redoStack: [],
  };
}

function emptyEditor(filePath: string): EditorState {
  return ensureEditorVisible({
    path: filePath,
    lines: [''],
    cursorRow: 0,
    cursorCol: 0,
    scrollRow: 0,
    scrollCol: 0,
    dirty: false,
    readOnly: false,
    mode: EditorModes.Normal,
    undoStack: [],
    redoStack: [],
  }, INITIAL_EDITOR_VIEWPORT_WIDTH, INITIAL_EDITOR_VIEWPORT_HEIGHT);
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
    viewMode: model.viewMode === ViewModes.Source ? ViewModes.Preview : ViewModes.Source,
  };

  if (next.viewMode === ViewModes.Source) {
    return beginSourceHighlightRefresh<WorkspaceModel, WorkspaceMsg>(
      next,
      next.editor,
      editorViewport(next),
      sourceHighlighter,
      workspaceSourceHighlightMessage,
    );
  }

  return [next, []];
}

export function beginEditorProjectionRefresh(
  model: WorkspaceModel,
  options: EditorProjectionRefreshOptions,
  ports: EditorSessionPorts,
): [WorkspaceModel, Cmd<WorkspaceMsg>[]] {
  const [withGraft, graftCmds] = beginGraftRefresh(model, { force: options.refreshGraft }, ports.graftSession);
  const [withHighlight, highlightCmds] = beginSourceHighlightRefresh<WorkspaceModel, WorkspaceMsg>(
    withGraft,
    withGraft.editor,
    editorViewport(withGraft),
    ports.sourceHighlighter,
    workspaceSourceHighlightMessage,
  );
  return [withHighlight, [...graftCmds, ...highlightCmds]];
}

export function beginEditorSourceHighlightRefresh(
  model: WorkspaceModel,
  ports: Pick<EditorSessionPorts, 'sourceHighlighter'>,
): [WorkspaceModel, Cmd<WorkspaceMsg>[]] {
  return beginSourceHighlightRefresh<WorkspaceModel, WorkspaceMsg>(
    model,
    model.editor,
    editorViewport(model),
    ports.sourceHighlighter,
    workspaceSourceHighlightMessage,
  );
}

export function beginGraftRefresh(
  model: WorkspaceModel,
  options: GraftRefreshOptions,
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

  if (!options.force && model.graftInfo?.path === model.editor.path && model.graftInfo.dirty === model.editor.dirty) {
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
    [requestGraftInfoCmd(requestId, {
      workspaceRoot: model.workspaceRoot,
      filePath: model.editor.path,
      dirty: model.editor.dirty,
      sourceText: joinLines(model.editor.lines),
    }, graftSession)],
  ];
}

function requestGraftInfoCmd(
  requestId: number,
  request: GraftFileRequest,
  graftSession: GraftSessionPort,
): Cmd<WorkspaceMsg> {
  return async () => {
    try {
      return {
        type: WorkspaceMessageTypes.GraftInfo,
        requestId,
        info: await graftSession.loadGraftInfo(request),
      };
    } catch (cause) {
      return {
        type: WorkspaceMessageTypes.GraftInfo,
        requestId,
        info: graftSession.failedGraftInfo({
          ...request,
          message: cause instanceof Error ? cause.message : String(cause),
        }),
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
  editorViewport,
};
