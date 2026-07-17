import { ProductionTextSessionOutcomeKinds } from './production-text-session.js';
import type { ProductionTextSession } from './production-text-session.js';
import type { CausalLineDiffReading } from '../../ports/text-authority-evidence.js';
import {
  unavailableWorkspaceBufferCausalLineChanges,
  workspaceBufferCausalLineChangesFromReading,
  WorkspaceBufferCausalLineChangeUnavailableReasons,
  type WorkspaceBufferCausalLineChanges,
} from './workspace-causal-line-changes.js';

const CAUSAL_LINE_DIFF_MAX_BYTES = 67108864;
const CAUSAL_LINE_DIFF_MAX_LINES = 5000000;
const CAUSAL_LINE_DIFF_MAX_REWRITES = 10000;
const CAUSAL_LINE_DIFF_MAX_MARKERS = 100000;

export interface WorkspaceCausalLineChangeObservationRequest {
  readonly bufferId: string;
  readonly productionTextSession: ProductionTextSession;
  readonly changeBasisHeadId?: string;
  readonly atMs: number;
}

export async function observeWorkspaceCausalLineChanges(
  request: WorkspaceCausalLineChangeObservationRequest,
  nextHeadId: string,
): Promise<WorkspaceBufferCausalLineChanges> {
  if (request.changeBasisHeadId == null) {
    return unavailableWorkspaceBufferCausalLineChanges(
      WorkspaceBufferCausalLineChangeUnavailableReasons.BasisUnavailable,
      { nextHeadId },
    );
  }
  let observed;
  try {
    observed = await request.productionTextSession.observeCausalLineDiff({
      bufferId: request.bufferId,
      basisHeadId: request.changeBasisHeadId,
      nextHeadId,
      maxByteCount: CAUSAL_LINE_DIFF_MAX_BYTES,
      maxLineCount: CAUSAL_LINE_DIFF_MAX_LINES,
      maxRewriteCount: CAUSAL_LINE_DIFF_MAX_REWRITES,
      maxMarkerCount: CAUSAL_LINE_DIFF_MAX_MARKERS,
      atMs: request.atMs,
    });
  } catch (cause) {
    return obstructedLineChanges(
      request,
      nextHeadId,
      cause instanceof Error ? cause.message : String(cause),
    );
  }
  return observed.kind === ProductionTextSessionOutcomeKinds.Obstructed
    ? obstructedLineChanges(request, nextHeadId, observed.obstruction.issue.message)
    : observedLineChanges(request, nextHeadId, observed.reading);
}

function observedLineChanges(
  request: WorkspaceCausalLineChangeObservationRequest,
  nextHeadId: string,
  reading: CausalLineDiffReading,
): WorkspaceBufferCausalLineChanges {
  if (reading.basisHeadId !== request.changeBasisHeadId || reading.nextHeadId !== nextHeadId) {
    return unavailableWorkspaceBufferCausalLineChanges(
      WorkspaceBufferCausalLineChangeUnavailableReasons.EvidenceMismatch,
      { basisHeadId: request.changeBasisHeadId, nextHeadId },
    );
  }
  return workspaceBufferCausalLineChangesFromReading(reading);
}

function obstructedLineChanges(
  request: WorkspaceCausalLineChangeObservationRequest,
  nextHeadId: string,
  message: string,
): WorkspaceBufferCausalLineChanges {
  return unavailableWorkspaceBufferCausalLineChanges(
    WorkspaceBufferCausalLineChangeUnavailableReasons.ObservationObstructed,
    { basisHeadId: request.changeBasisHeadId, nextHeadId, message },
  );
}
