import type { Cmd } from '@flyingrobots/bijou-tui';
import type { ProductionTextSession } from './production-text-session.js';
import type { WorkspaceModel } from './model.js';
import { WorkspaceMessageTypes, type WorkspaceMsg } from './msg.js';
import {
  workspaceBufferDurabilityWithCausalLineChanges,
} from './workspace-buffer-durability.js';
import {
  identityWorkspaceBufferCausalLineChanges,
  initialWorkspaceBufferCausalLineChanges,
  unavailableWorkspaceBufferCausalLineChanges,
  WorkspaceBufferCausalLineChangeUnavailableReasons,
} from './workspace-causal-line-changes.js';
import {
  observeWorkspaceCausalLineChanges,
  type WorkspaceCausalLineChangeObservationRequest,
} from './workspace-causal-line-change-observation.js';
import {
  workspaceCausalGutterBasisHeadId,
  workspaceCurrentCausalHeadId,
} from './workspace-causal-gutter-basis.js';
import { WorkspaceTextAuthorityKinds } from './workspace-text-authority.js';

export interface WorkspaceCausalLineChangeRefreshRequest
  extends WorkspaceCausalLineChangeObservationRequest {
  readonly nextHeadId: string;
}

type WorkspaceCausalLineChangeResultMsg = Extract<
  WorkspaceMsg,
  { type: typeof WorkspaceMessageTypes.CausalLineChangesResult }
>;

export function beginWorkspaceCausalLineChangeRefresh(
  model: WorkspaceModel,
  productionTextSession: ProductionTextSession,
): [WorkspaceModel, Cmd<WorkspaceMsg>[]] {
  if (model.textAuthority.kind !== WorkspaceTextAuthorityKinds.Opened) {
    return [model, []];
  }
  const durability = model.textAuthority.durability;
  const nextHeadId = workspaceCurrentCausalHeadId(durability);
  const changeBasisHeadId = workspaceCausalGutterBasisHeadId(
    model.causalGutterBasis,
    durability,
  );
  const clearedAuthority = {
    ...model.textAuthority,
    durability: {
      ...durability,
      lineChanges: pendingWorkspaceCausalLineChanges(nextHeadId, changeBasisHeadId),
    },
  };
  const cleared = { ...model, textAuthority: clearedAuthority };
  if (nextHeadId == null || changeBasisHeadId == null || nextHeadId === changeBasisHeadId) {
    return [cleared, []];
  }
  return [cleared, [createWorkspaceCausalLineChangeRefreshCmd({
    bufferId: model.textAuthority.bufferId,
    productionTextSession,
    changeBasisHeadId,
    nextHeadId,
    atMs: model.time,
  })]];
}

export function ensureWorkspaceCausalLineChangeRefresh(
  model: WorkspaceModel,
  productionTextSession: ProductionTextSession,
): [WorkspaceModel, Cmd<WorkspaceMsg>[]] {
  if (model.textAuthority.kind !== WorkspaceTextAuthorityKinds.Opened) {
    return [model, []];
  }
  const durability = model.textAuthority.durability;
  const nextHeadId = workspaceCurrentCausalHeadId(durability);
  const basisHeadId = workspaceCausalGutterBasisHeadId(model.causalGutterBasis, durability);
  const lineChanges = durability.lineChanges;
  return lineChanges.basisHeadId === basisHeadId && lineChanges.nextHeadId === nextHeadId
    ? [model, []]
    : beginWorkspaceCausalLineChangeRefresh(model, productionTextSession);
}

export function createWorkspaceCausalLineChangeRefreshCmd(
  request: WorkspaceCausalLineChangeRefreshRequest,
): Cmd<WorkspaceMsg> {
  return async () => ({
    type: WorkspaceMessageTypes.CausalLineChangesResult,
    bufferId: request.bufferId,
    basisHeadId: request.changeBasisHeadId,
    nextHeadId: request.nextHeadId,
    lineChanges: await observeWorkspaceCausalLineChanges(request, request.nextHeadId),
  });
}

export function applyWorkspaceCausalLineChangeResult(
  msg: WorkspaceCausalLineChangeResultMsg,
  model: WorkspaceModel,
): [WorkspaceModel, Cmd<WorkspaceMsg>[]] {
  if (model.textAuthority.kind !== WorkspaceTextAuthorityKinds.Opened
      || model.textAuthority.bufferId !== msg.bufferId) {
    return [model, []];
  }
  const durability = model.textAuthority.durability;
  const currentHeadId = workspaceCurrentCausalHeadId(durability);
  const selectedBasisHeadId = workspaceCausalGutterBasisHeadId(
    model.causalGutterBasis,
    durability,
  );
  if (currentHeadId !== msg.nextHeadId || selectedBasisHeadId !== msg.basisHeadId) {
    return [model, []];
  }
  return [{
    ...model,
    textAuthority: {
      ...model.textAuthority,
      durability: workspaceBufferDurabilityWithCausalLineChanges(
        durability,
        msg.basisHeadId,
        msg.nextHeadId,
        msg.lineChanges,
      ),
    },
  }, []];
}

function pendingWorkspaceCausalLineChanges(
  nextHeadId: string | undefined,
  basisHeadId: string | undefined,
) {
  if (nextHeadId != null && nextHeadId === basisHeadId) {
    return identityWorkspaceBufferCausalLineChanges(nextHeadId);
  }
  if (nextHeadId == null || basisHeadId == null) {
    return initialWorkspaceBufferCausalLineChanges(nextHeadId, basisHeadId);
  }
  return unavailableWorkspaceBufferCausalLineChanges(
    WorkspaceBufferCausalLineChangeUnavailableReasons.ObservationPending,
    { basisHeadId, nextHeadId },
  );
}
