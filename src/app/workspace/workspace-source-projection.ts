import type { SourceGutterLineMarker } from '../../ui/source-viewer.js';
import type { WorkspaceModel } from './model.js';
import { WorkspaceBufferCausalLineChangeKinds } from './workspace-causal-line-changes.js';
import {
  canReadingReplaceWholeEditor,
  editorFromFullWorkspaceTextCache,
  hasVisibleOptimisticText,
  isWorkspaceTextAuthorityOpened,
  projectedSourceWindow,
} from './workspace-text-authority.js';

const INSERTED_CAUSAL_LINE_MARKER = 'INSERTED';

export function displayEditorForWorkspaceModel(
  model: WorkspaceModel,
): WorkspaceModel['editor'] {
  const authority = model.textAuthority;
  return isWorkspaceTextAuthorityOpened(authority)
    && !hasVisibleOptimisticText(authority)
    && canReadingReplaceWholeEditor(authority.cache)
    ? editorFromFullWorkspaceTextCache({ ...authority, cache: authority.cache }, model.editor)
    : model.editor;
}

export function sourceWindowForWorkspaceModel(model: WorkspaceModel) {
  if (!isWorkspaceTextAuthorityOpened(model.textAuthority)) {
    return undefined;
  }
  if (hasVisibleOptimisticText(model.textAuthority)) {
    return undefined;
  }
  const projected = projectedSourceWindow(model.textAuthority);
  return projected ?? {
    startLine: model.editor?.scrollRow ?? 0,
    lineCount: 0,
    totalLineCount: model.textAuthority.cache?.totalLineCount ?? 0,
    hasMoreBefore: false,
    hasMoreAfter: false,
    lines: [],
  };
}

export function sourceHighlightForWorkspaceProjection(
  model: WorkspaceModel,
  editorPath: string,
): WorkspaceModel['sourceHighlight'] {
  const highlight = model.sourceHighlight;
  if (highlight?.path !== editorPath || !isWorkspaceTextAuthorityOpened(model.textAuthority)) {
    return highlight?.path === editorPath ? highlight : undefined;
  }
  const projection = model.textAuthority.cache?.projection;
  return projection != null && sameProjectionBasis(highlight.projection, projection)
    ? highlight
    : undefined;
}

export function causalSourceGutterLineMarkers(
  model: WorkspaceModel,
): readonly SourceGutterLineMarker[] | undefined {
  if (!isWorkspaceTextAuthorityOpened(model.textAuthority)
      || hasVisibleOptimisticText(model.textAuthority)) {
    return undefined;
  }
  const lineChanges = model.textAuthority.durability.lineChanges;
  const projection = model.textAuthority.cache?.projection;
  if (lineChanges.kind !== WorkspaceBufferCausalLineChangeKinds.Available
      || projection?.basisHeadId !== lineChanges.nextHeadId) {
    return undefined;
  }
  return lineChanges.markers.map(marker => ({
    lineNumber: marker.lineNumber,
    kind: marker.kind === INSERTED_CAUSAL_LINE_MARKER ? 'inserted' : 'modified',
  }));
}

function sameProjectionBasis(
  left: NonNullable<WorkspaceModel['sourceHighlight']>['projection'],
  right: NonNullable<WorkspaceModel['sourceHighlight']>['projection'],
): boolean {
  return left?.basisHeadId === right?.basisHeadId
    && left?.byteRange.startByte === right?.byteRange.startByte
    && left?.byteRange.endByte === right?.byteRange.endByte;
}
