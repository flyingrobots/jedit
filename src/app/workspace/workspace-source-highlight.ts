import type { Cmd } from '@flyingrobots/bijou-tui';
import type { SourceHighlighter } from '../../ports/source-highlighter.js';
import {
  beginSourceHighlightRefresh,
  shouldRefreshSourceHighlight,
  type SourceHighlightEditor,
  type SourceHighlightViewport,
} from '../source-highlight-session.js';
import type { WorkspaceModel } from './model.js';
import { workspaceSourceHighlightMessage, type WorkspaceMsg } from './msg.js';
import { workspaceTextProjectionMatchesLines } from './workspace-text-observed-reading.js';

export { shouldRefreshSourceHighlight };

export function beginWorkspaceSourceHighlightRefresh(
  model: WorkspaceModel,
  viewport: SourceHighlightViewport,
  highlighter: SourceHighlighter,
): [WorkspaceModel, Cmd<WorkspaceMsg>[]] {
  return beginSourceHighlightRefresh(
    model,
    sourceHighlightEditor(model),
    viewport,
    highlighter,
    workspaceSourceHighlightMessage,
  );
}

function sourceHighlightEditor(model: WorkspaceModel): SourceHighlightEditor | undefined {
  const editor = model.editor;
  if (editor == null || !('bufferId' in model.textAuthority)) {
    return editor;
  }
  const cache = model.textAuthority.cache;
  const latestHeadId = model.textAuthority.lastCausalTransition?.nextHeadId;
  if (cache?.projection == null
    || cache.bufferId !== model.textAuthority.bufferId
    || !workspaceTextProjectionMatchesLines(cache.projection, cache.lines)
    || (latestHeadId != null && cache.projection.basisHeadId !== latestHeadId)) {
    return { ...editor, requiresProjection: true };
  }
  return {
    ...editor,
    requiresProjection: true,
    projection: cache.projection,
    projectionStartLine: cache.startLine,
  };
}
