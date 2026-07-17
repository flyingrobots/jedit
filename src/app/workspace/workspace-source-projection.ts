import type {
  SourceGutterDeletionMarker,
  SourceGutterLineMarker,
} from '../../ui/source-viewer.js';
import type { JeditCommandTarget } from './command-provenance.js';
import type { WorkspaceModel } from './model.js';
import {
  WorkspaceBufferCausalDurabilityKinds,
  WorkspaceTextIntentStatuses,
  type WorkspaceTextIntentStatus,
} from './workspace-buffer-durability.js';
import {
  WorkspaceBufferCausalLineChangeKinds,
  type WorkspaceBufferCausalLineChangesAvailable,
} from './workspace-causal-line-changes.js';
import {
  canReadingReplaceWholeEditor,
  editorFromFullWorkspaceTextCache,
  hasVisibleOptimisticText,
  isWorkspaceTextAuthorityOpened,
  projectedSourceWindow,
} from './workspace-text-authority.js';
import { workspaceCausalGutterBasisHeadId } from './workspace-causal-gutter-basis.js';
import {
  workspaceGutterWhyEvidence,
  type WorkspaceGutterWhyEvidence,
} from './workspace-causal-evidence-explainers.js';

const INSERTED_CAUSAL_LINE_MARKER = 'INSERTED';
const SOURCE_GUTTER_EXECUTION_POSTURE = Object.freeze({
  Applied: 'applied',
  Pending: 'pending',
  Obstructed: 'obstructed',
} as const);
const PENDING_INTENT_STATUSES: ReadonlySet<WorkspaceTextIntentStatus> = new Set([
  WorkspaceTextIntentStatuses.Predicted,
  WorkspaceTextIntentStatuses.Submitted,
  WorkspaceTextIntentStatuses.Rebased,
]);
const OBSTRUCTED_INTENT_STATUSES: ReadonlySet<WorkspaceTextIntentStatus> = new Set([
  WorkspaceTextIntentStatuses.Blocked,
  WorkspaceTextIntentStatuses.Obstructed,
  WorkspaceTextIntentStatuses.Superseded,
  WorkspaceTextIntentStatuses.Abandoned,
]);

export interface SourceGutterExecutionReading {
  readonly lineNumber: number;
  readonly markerKind: SourceGutterLineMarker['kind'];
  readonly posture: typeof SOURCE_GUTTER_EXECUTION_POSTURE[keyof typeof SOURCE_GUTTER_EXECUTION_POSTURE];
  readonly basisHeadId?: string;
  readonly nextHeadId?: string;
  readonly tickReceiptIds: readonly string[];
  readonly rewriteIds: readonly string[];
  readonly diffIds: readonly string[];
  readonly receiptId?: string;
  readonly clientSeq?: number;
  readonly blockerClientSeq?: number;
  readonly eventId?: string;
  readonly target?: JeditCommandTarget;
  readonly obstructionMessage?: string;
  readonly whyEvidence?: WorkspaceGutterWhyEvidence;
}

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

export function sourceGutterExecutionReadings(
  model: WorkspaceModel,
): readonly SourceGutterExecutionReading[] {
  const transient = transientGutterExecutionReading(model);
  if (transient != null) {
    return [transient];
  }
  const lineChanges = causalLineChangesForProjection(model);
  if (lineChanges == null) {
    return [];
  }
  const retainedTickReceiptIds = new Set(lineChanges.tickReceiptIds);
  return lineChanges.markers
    .filter(marker => hasRetainedTickReceiptSupport(marker.tickReceiptIds, retainedTickReceiptIds))
    .map(marker => appliedGutterExecutionReading(model, lineChanges, marker));
}

export function sourceGutterLineMarkers(
  model: WorkspaceModel,
): readonly SourceGutterLineMarker[] {
  return sourceGutterExecutionReadings(model).map(reading => ({
    lineNumber: reading.lineNumber,
    kind: reading.markerKind,
  }));
}

export function causalSourceGutterLineMarkers(
  model: WorkspaceModel,
): readonly SourceGutterLineMarker[] | undefined {
  const lineChanges = causalLineChangesForProjection(model);
  const retainedTickReceiptIds = new Set(lineChanges?.tickReceiptIds);
  return lineChanges?.markers
    .filter(marker => hasRetainedTickReceiptSupport(marker.tickReceiptIds, retainedTickReceiptIds))
    .map(marker => ({
      lineNumber: marker.lineNumber,
      kind: marker.kind === INSERTED_CAUSAL_LINE_MARKER ? 'inserted' : 'modified',
    }));
}

export function causalSourceGutterDeletionMarkers(
  model: WorkspaceModel,
): readonly SourceGutterDeletionMarker[] | undefined {
  const lineChanges = causalLineChangesForProjection(model);
  const retainedTickReceiptIds = new Set(lineChanges?.tickReceiptIds);
  return lineChanges?.deletions
    .filter(deletion => hasRetainedTickReceiptSupport(deletion.tickReceiptIds, retainedTickReceiptIds))
    .map(deletion => ({
      boundaryLineNumber: deletion.boundaryLineNumber,
      deletedLineCount: deletion.deletedLineCount,
    }));
}

function causalLineChangesForProjection(
  model: WorkspaceModel,
): WorkspaceBufferCausalLineChangesAvailable | undefined {
  if (!isWorkspaceTextAuthorityOpened(model.textAuthority)
      || hasVisibleOptimisticText(model.textAuthority)) {
    return undefined;
  }
  const lineChanges = model.textAuthority.durability.lineChanges;
  const projection = model.textAuthority.cache?.projection;
  const selectedBasisHeadId = workspaceCausalGutterBasisHeadId(
    model.causalGutterBasis,
    model.textAuthority.durability,
  );
  return lineChanges.kind === WorkspaceBufferCausalLineChangeKinds.Available
      && projection?.basisHeadId === lineChanges.nextHeadId
      && selectedBasisHeadId === lineChanges.basisHeadId
    ? lineChanges
    : undefined;
}

function appliedGutterExecutionReading(
  model: WorkspaceModel,
  lineChanges: WorkspaceBufferCausalLineChangesAvailable,
  marker: WorkspaceBufferCausalLineChangesAvailable['markers'][number],
): SourceGutterExecutionReading {
  const tickReceiptIds = [...marker.tickReceiptIds];
  const receiptId = latestAppliedReceiptId(model, tickReceiptIds);
  const whyEvidence = workspaceGutterWhyEvidence(model, marker.lineNumber, {
    nextHeadId: lineChanges.nextHeadId,
    tickReceiptIds: marker.tickReceiptIds,
    rewriteIds: marker.rewriteIds,
    diffIds: marker.diffIds,
  });
  return {
    lineNumber: marker.lineNumber,
    markerKind: marker.kind === INSERTED_CAUSAL_LINE_MARKER ? 'inserted' : 'modified',
    posture: SOURCE_GUTTER_EXECUTION_POSTURE.Applied,
    basisHeadId: lineChanges.basisHeadId,
    nextHeadId: lineChanges.nextHeadId,
    tickReceiptIds,
    rewriteIds: [...marker.rewriteIds],
    diffIds: [...marker.diffIds],
    ...(receiptId == null ? {} : { receiptId }),
    ...(whyEvidence == null ? {} : { whyEvidence }),
  };
}

function latestAppliedReceiptId(
  model: WorkspaceModel,
  tickReceiptIds: readonly string[],
): string | undefined {
  if (!isWorkspaceTextAuthorityOpened(model.textAuthority)) {
    return undefined;
  }
  const causal = model.textAuthority.durability.causal;
  return causal.kind === WorkspaceBufferCausalDurabilityKinds.Admitted
      && causal.receiptId != null
      && causal.admittedTickId != null
      && tickReceiptIds.includes(causal.admittedTickId)
    ? causal.receiptId
    : undefined;
}

function transientGutterExecutionReading(
  model: WorkspaceModel,
): SourceGutterExecutionReading | undefined {
  if (!isWorkspaceTextAuthorityOpened(model.textAuthority)) {
    return undefined;
  }
  const markerKind = transientMarkerKind(model.textAuthority.pendingIntentStatus);
  const event = model.textAuthority.pendingCommandEvent?.event;
  const lineNumber = event?.result.cursorRow;
  if (markerKind == null || lineNumber == null || !Number.isSafeInteger(lineNumber) || lineNumber < 0) {
    return undefined;
  }
  return {
    lineNumber,
    markerKind,
    posture: markerKind,
    tickReceiptIds: [],
    rewriteIds: [],
    diffIds: [],
    ...transientGutterExecutionMetadata(model),
  };
}

function transientGutterExecutionMetadata(
  model: WorkspaceModel,
): Pick<SourceGutterExecutionReading, 'clientSeq' | 'blockerClientSeq' | 'eventId' | 'target' | 'obstructionMessage'> {
  if (!isWorkspaceTextAuthorityOpened(model.textAuthority)) {
    return {};
  }
  const authority = model.textAuthority;
  const event = authority.pendingCommandEvent?.event;
  return {
    ...(authority.pendingClientSeq == null ? {} : { clientSeq: authority.pendingClientSeq }),
    ...(authority.blockedByClientSeq == null ? {} : { blockerClientSeq: authority.blockedByClientSeq }),
    ...(event == null ? {} : { eventId: event.eventId }),
    ...(event?.target == null ? {} : { target: event.target }),
    ...(authority.lastObstruction == null ? {} : { obstructionMessage: authority.lastObstruction.message }),
  };
}

function transientMarkerKind(
  status: WorkspaceTextIntentStatus | undefined,
): 'pending' | 'obstructed' | undefined {
  if (status != null && PENDING_INTENT_STATUSES.has(status)) {
    return SOURCE_GUTTER_EXECUTION_POSTURE.Pending;
  }
  return status != null && OBSTRUCTED_INTENT_STATUSES.has(status)
    ? SOURCE_GUTTER_EXECUTION_POSTURE.Obstructed
    : undefined;
}

function hasRetainedTickReceiptSupport(
  markerTickReceiptIds: readonly string[],
  retainedTickReceiptIds: ReadonlySet<string>,
): boolean {
  return markerTickReceiptIds.length > 0
    && markerTickReceiptIds.every(tickReceiptId => retainedTickReceiptIds.has(tickReceiptId));
}

function sameProjectionBasis(
  left: NonNullable<WorkspaceModel['sourceHighlight']>['projection'],
  right: NonNullable<WorkspaceModel['sourceHighlight']>['projection'],
): boolean {
  return left?.basisHeadId === right?.basisHeadId
    && left?.byteRange.startByte === right?.byteRange.startByte
    && left?.byteRange.endByte === right?.byteRange.endByte;
}
