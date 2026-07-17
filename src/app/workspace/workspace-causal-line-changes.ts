import type {
  CausalLineDiffReading,
  CausalLineMarkerReading,
} from '../../ports/text-authority-evidence.js';

const LINE_CHANGES_AVAILABLE = 'available';
const LINE_CHANGES_UNAVAILABLE = 'unavailable';
const LINE_CHANGES_SOURCE_IDENTITY = 'identity';
const LINE_CHANGES_SOURCE_CAUSAL_OBSERVATION = 'causal-observation';
const LINE_CHANGES_REASON_BASIS_UNAVAILABLE = 'basis-unavailable';
const LINE_CHANGES_REASON_OBSERVATION_PENDING = 'observation-pending';
const LINE_CHANGES_REASON_OBSERVATION_OBSTRUCTED = 'observation-obstructed';
const LINE_CHANGES_REASON_EVIDENCE_MISMATCH = 'evidence-mismatch';
const LINE_CHANGES_IDENTITY_OBSERVER_VERSION = 'jedit-causal-line-diff-identity-v1';

export const WorkspaceBufferCausalLineChangeKinds = Object.freeze({
  Available: LINE_CHANGES_AVAILABLE,
  Unavailable: LINE_CHANGES_UNAVAILABLE,
} as const);

export const WorkspaceBufferCausalLineChangeSources = Object.freeze({
  Identity: LINE_CHANGES_SOURCE_IDENTITY,
  CausalObservation: LINE_CHANGES_SOURCE_CAUSAL_OBSERVATION,
} as const);

export const WorkspaceBufferCausalLineChangeUnavailableReasons = Object.freeze({
  BasisUnavailable: LINE_CHANGES_REASON_BASIS_UNAVAILABLE,
  ObservationPending: LINE_CHANGES_REASON_OBSERVATION_PENDING,
  ObservationObstructed: LINE_CHANGES_REASON_OBSERVATION_OBSTRUCTED,
  EvidenceMismatch: LINE_CHANGES_REASON_EVIDENCE_MISMATCH,
} as const);

export type WorkspaceBufferCausalLineChangeUnavailableReason =
  typeof WorkspaceBufferCausalLineChangeUnavailableReasons[
    keyof typeof WorkspaceBufferCausalLineChangeUnavailableReasons
  ];

export interface WorkspaceBufferCausalLineChangesAvailable {
  readonly kind: typeof LINE_CHANGES_AVAILABLE;
  readonly source:
    | typeof LINE_CHANGES_SOURCE_IDENTITY
    | typeof LINE_CHANGES_SOURCE_CAUSAL_OBSERVATION;
  readonly basisHeadId: string;
  readonly nextHeadId: string;
  readonly insertedLineCount: number;
  readonly deletedLineCount: number;
  readonly tickReceiptIds: readonly string[];
  readonly rewriteIds: readonly string[];
  readonly diffIds: readonly string[];
  readonly markers: readonly CausalLineMarkerReading[];
  readonly deletions: CausalLineDiffReading['deletions'];
  readonly observerVersion: string;
}

export interface WorkspaceBufferCausalLineChangesUnavailable {
  readonly kind: typeof LINE_CHANGES_UNAVAILABLE;
  readonly reason: WorkspaceBufferCausalLineChangeUnavailableReason;
  readonly basisHeadId?: string;
  readonly nextHeadId?: string;
  readonly message?: string;
}

export type WorkspaceBufferCausalLineChanges =
  | WorkspaceBufferCausalLineChangesAvailable
  | WorkspaceBufferCausalLineChangesUnavailable;

export interface UnavailableWorkspaceBufferCausalLineChangesOptions {
  readonly basisHeadId?: string;
  readonly nextHeadId?: string;
  readonly message?: string;
}

export function workspaceBufferCausalLineChangesFromReading(
  reading: CausalLineDiffReading,
): WorkspaceBufferCausalLineChangesAvailable {
  return {
    kind: LINE_CHANGES_AVAILABLE,
    source: LINE_CHANGES_SOURCE_CAUSAL_OBSERVATION,
    basisHeadId: reading.basisHeadId,
    nextHeadId: reading.nextHeadId,
    insertedLineCount: reading.insertedLineCount,
    deletedLineCount: reading.deletedLineCount,
    tickReceiptIds: [...reading.tickReceiptIds],
    rewriteIds: [...reading.rewriteIds],
    diffIds: [...reading.diffIds],
    markers: reading.markers.map(marker => ({
      ...marker,
      tickReceiptIds: [...marker.tickReceiptIds],
      rewriteIds: [...marker.rewriteIds],
      diffIds: [...marker.diffIds],
    })),
    deletions: reading.deletions.map(deletion => ({
      ...deletion,
      tickReceiptIds: [...deletion.tickReceiptIds],
      rewriteIds: [...deletion.rewriteIds],
      diffIds: [...deletion.diffIds],
    })),
    observerVersion: reading.observerVersion,
  };
}

export function unavailableWorkspaceBufferCausalLineChanges(
  reason: WorkspaceBufferCausalLineChangeUnavailableReason,
  options: UnavailableWorkspaceBufferCausalLineChangesOptions = {},
): WorkspaceBufferCausalLineChangesUnavailable {
  return {
    kind: LINE_CHANGES_UNAVAILABLE,
    reason,
    ...(nonEmptyId(options.basisHeadId) == null ? {} : { basisHeadId: options.basisHeadId }),
    ...(nonEmptyId(options.nextHeadId) == null ? {} : { nextHeadId: options.nextHeadId }),
    ...(options.message == null || options.message.length === 0 ? {} : { message: options.message }),
  };
}

export function initialWorkspaceBufferCausalLineChanges(
  currentHeadId: string | undefined,
  fileBasisHeadId: string | undefined,
): WorkspaceBufferCausalLineChanges {
  return currentHeadId != null && currentHeadId === fileBasisHeadId
    ? identityWorkspaceBufferCausalLineChanges(currentHeadId)
    : unavailableWorkspaceBufferCausalLineChanges(
      LINE_CHANGES_REASON_BASIS_UNAVAILABLE,
      { basisHeadId: fileBasisHeadId, nextHeadId: currentHeadId },
    );
}

export function identityWorkspaceBufferCausalLineChanges(
  headId: string,
): WorkspaceBufferCausalLineChangesAvailable {
  return {
    kind: LINE_CHANGES_AVAILABLE,
    source: LINE_CHANGES_SOURCE_IDENTITY,
    basisHeadId: headId,
    nextHeadId: headId,
    insertedLineCount: 0,
    deletedLineCount: 0,
    tickReceiptIds: [],
    rewriteIds: [],
    diffIds: [],
    markers: [],
    deletions: [],
    observerVersion: LINE_CHANGES_IDENTITY_OBSERVER_VERSION,
  };
}

export function workspaceBufferCausalLineChangesForTransition(
  expectedBasisHeadId: string | undefined,
  nextHeadId: string,
  lineChanges: WorkspaceBufferCausalLineChanges | undefined,
): WorkspaceBufferCausalLineChanges {
  if (lineChanges == null) {
    return unavailableWorkspaceBufferCausalLineChanges(
      LINE_CHANGES_REASON_OBSERVATION_OBSTRUCTED,
      { basisHeadId: expectedBasisHeadId, nextHeadId },
    );
  }
  if (lineChanges.kind === LINE_CHANGES_UNAVAILABLE) {
    return lineChanges;
  }
  if (lineChanges.nextHeadId !== nextHeadId || lineChanges.basisHeadId !== expectedBasisHeadId) {
    return unavailableWorkspaceBufferCausalLineChanges(
      LINE_CHANGES_REASON_EVIDENCE_MISMATCH,
      { basisHeadId: expectedBasisHeadId, nextHeadId },
    );
  }
  return {
    ...lineChanges,
    tickReceiptIds: [...lineChanges.tickReceiptIds],
    rewriteIds: [...lineChanges.rewriteIds],
    diffIds: [...lineChanges.diffIds],
    markers: lineChanges.markers.map(marker => ({
      ...marker,
      tickReceiptIds: [...marker.tickReceiptIds],
      rewriteIds: [...marker.rewriteIds],
      diffIds: [...marker.diffIds],
    })),
    deletions: lineChanges.deletions.map(deletion => ({
      ...deletion,
      tickReceiptIds: [...deletion.tickReceiptIds],
      rewriteIds: [...deletion.rewriteIds],
      diffIds: [...deletion.diffIds],
    })),
  };
}

function nonEmptyId(value: string | undefined): string | undefined {
  return value == null || value.trim().length === 0 ? undefined : value;
}
