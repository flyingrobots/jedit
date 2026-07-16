import type { WorkspaceModel } from './model.js';
import { WorkspaceMessageTypes, type WorkspaceMsg } from './msg.js';
import type {
  WorkspaceRuntimeDependencies,
  WorkspaceRuntimeResult,
} from './workspace-runtime-dependencies.js';
import { ensureWorkspaceCausalLineChangeRefresh } from './workspace-causal-line-change-refresh.js';
import { applyWorkspaceTextMessage as applyBaseWorkspaceTextMessage } from './workspace-text-runtime-state.js';

export function applyWorkspaceTextMessage(
  deps: WorkspaceRuntimeDependencies,
  msg: WorkspaceMsg,
  model: WorkspaceModel,
): WorkspaceRuntimeResult | undefined {
  const result = applyBaseWorkspaceTextMessage(deps, msg, model);
  if (result == null || !messageMayMoveCausalLineBasis(msg)) {
    return result;
  }
  const [next, commands] = result;
  const [refreshed, causalCommands] = ensureWorkspaceCausalLineChangeRefresh(
    next,
    deps.productionTextSession,
  );
  return [refreshed, [...causalCommands, ...commands]];
}

function messageMayMoveCausalLineBasis(msg: WorkspaceMsg): boolean {
  return msg.type === WorkspaceMessageTypes.TextEditResult
    || msg.type === WorkspaceMessageTypes.TextExportResult;
}
