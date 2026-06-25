import type { Cmd } from '@flyingrobots/bijou-tui';
import type {
  GraftDiagnosticsPort,
  GraftDiagnosticsReport,
} from '../../ports/graft-diagnostics.js';
import type { WorkspaceModel } from './model.js';
import { WorkspaceMessageTypes, type WorkspaceMsg } from './msg.js';

const DIAGNOSTICS_ERROR_FALLBACK = 'diagnostics failed without an error message';

export function beginGraftDiagnosticsRefresh(
  model: WorkspaceModel,
  diagnostics: GraftDiagnosticsPort,
): [WorkspaceModel, Cmd<WorkspaceMsg>[]] {
  const requestId = model.graftDiagnosticsRequestId + 1;
  return [
    {
      ...model,
      settingsDiagnosticsOpen: true,
      graftDiagnosticsLoading: true,
      graftDiagnosticsRequestId: requestId,
    },
    [createGraftDiagnosticsCmd(requestId, diagnostics)],
  ];
}

export function applyGraftDiagnostics(
  model: WorkspaceModel,
  requestId: number,
  report: GraftDiagnosticsReport,
): WorkspaceModel {
  return requestId === model.graftDiagnosticsRequestId
    ? {
        ...model,
        graftDiagnostics: report,
        graftDiagnosticsLoading: false,
      }
    : model;
}

function createGraftDiagnosticsCmd(
  requestId: number,
  diagnostics: GraftDiagnosticsPort,
): Cmd<WorkspaceMsg> {
  return async () => ({
    type: WorkspaceMessageTypes.GraftDiagnostics,
    requestId,
    report: await loadGraftDiagnosticsReport(diagnostics),
  });
}

async function loadGraftDiagnosticsReport(
  diagnostics: GraftDiagnosticsPort,
): Promise<GraftDiagnosticsReport> {
  try {
    return await diagnostics.loadDiagnostics();
  } catch (cause) {
    return diagnostics.failedDiagnostics({
      message: cause instanceof Error
        ? cause.message
        : cause == null ? DIAGNOSTICS_ERROR_FALLBACK : String(cause),
    });
  }
}
