import { joinLines } from '../editor-lines.js';
import { editorViewport, type WorkspaceViewport } from './viewport.js';
import type { Cmd } from '@flyingrobots/bijou-tui';
import type { WorkspaceModel } from './model.js';
import { WorkspaceMessageTypes, type WorkspaceMsg } from './msg.js';
import type { EditorFilePort } from '../../ports/editor-file.js';
import { GraftProjectionSources, type GraftFileRequest, type GraftSessionPort } from '../../ports/graft-session.js';
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
import { beginWorkspaceSourceHighlightRefresh } from './workspace-source-highlight.js';

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
    return beginWorkspaceSourceHighlightRefresh(next, editorViewport(next), sourceHighlighter);
  }

  return [next, []];
}

export function beginEditorProjectionRefresh(
  model: WorkspaceModel,
  options: EditorProjectionRefreshOptions,
  ports: EditorSessionPorts,
): [WorkspaceModel, Cmd<WorkspaceMsg>[]] {
  const [withGraft, graftCmds] = beginGraftRefresh(model, { force: options.refreshGraft }, ports.graftSession);
  const [withHighlight, highlightCmds] = beginWorkspaceSourceHighlightRefresh(
    withGraft, editorViewport(withGraft), ports.sourceHighlighter,
  );
  return [withHighlight, [...graftCmds, ...highlightCmds]];
}

export function beginEditorSourceHighlightRefresh(
  model: WorkspaceModel,
  ports: Pick<EditorSessionPorts, 'sourceHighlighter'>,
): [WorkspaceModel, Cmd<WorkspaceMsg>[]] {
  return beginWorkspaceSourceHighlightRefresh(model, editorViewport(model), ports.sourceHighlighter);
}

export function beginGraftRefresh(
  model: WorkspaceModel,
  options: GraftRefreshOptions,
  graftSession: GraftSessionPort,
): [WorkspaceModel, Cmd<WorkspaceMsg>[]] {
  if (model.editor == null) {
    return [clearedGraftRefreshModel(model), []];
  }

  if (shouldReuseGraftInfo(model, options)) {
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
      expandedProjectionLaneIndex: sameFile ? model.expandedProjectionLaneIndex : undefined,
    },
    [requestGraftInfoCmd(requestId, {
      workspaceRoot: model.workspaceRoot,
      filePath: model.editor.path,
      dirty: model.editor.dirty,
      sourceText: joinLines(model.editor.lines),
    }, graftSession)],
  ];
}

function clearedGraftRefreshModel(model: WorkspaceModel): WorkspaceModel {
  return {
    ...model,
    graftInfo: undefined,
    graftLoading: false,
    graftSelectedIndex: 0,
    expandedProjectionLaneIndex: undefined,
  };
}

function shouldReuseGraftInfo(model: WorkspaceModel, options: GraftRefreshOptions): boolean {
  return !options.force
    && model.editor != null
    && model.graftInfo?.path === model.editor.path
    && model.graftInfo.dirty === model.editor.dirty
    && model.graftInfo.projectionSource !== GraftProjectionSources.LiveBuffer;
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
