import { ProductionTextSessionOutcomeKinds } from './production-text-session.js';
import type { WorkspaceTextEditCommandRequest } from './workspace-text-commands.js';
import {
  unavailableWorkspaceBufferCausalLineChanges,
  workspaceBufferCausalLineChangesFromReading,
  WorkspaceBufferCausalLineChangeUnavailableReasons,
  type WorkspaceBufferCausalLineChanges,
} from './workspace-causal-line-changes.js';

const CAUSAL_LINE_DIFF_MAX_BYTES = 67108864;
const CAUSAL_LINE_DIFF_MAX_LINES = 5000000;
const CAUSAL_LINE_DIFF_MAX_REWRITES = 10000;

export async function observeWorkspaceCausalLineChanges(
  request: WorkspaceTextEditCommandRequest,
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
    : workspaceBufferCausalLineChangesFromReading(observed.reading);
}

function obstructedLineChanges(
  request: WorkspaceTextEditCommandRequest,
  nextHeadId: string,
  message: string,
): WorkspaceBufferCausalLineChanges {
  return unavailableWorkspaceBufferCausalLineChanges(
    WorkspaceBufferCausalLineChangeUnavailableReasons.ObservationObstructed,
    { basisHeadId: request.changeBasisHeadId, nextHeadId, message },
  );
}
