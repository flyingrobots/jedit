import {
  JEDIT_WSC_WORKSPACE_STORE_OBSTRUCTED,
  type JeditWscWorkspaceStorePort,
} from '../ports/jedit-wsc-workspace-store.js';
import {
  JEDIT_WSC_STARTUP_AUTHORITY_ECHO_HISTORY,
  JEDIT_WSC_STARTUP_HOST_IMPORT_EXPLICIT,
  JEDIT_WSC_STARTUP_PENDING_MATERIALIZATION,
  JEDIT_WSC_STARTUP_RECOVERY_NO_HISTORY,
  JEDIT_WSC_STARTUP_RECOVERY_NOT_REQUESTED,
  JEDIT_WSC_STARTUP_RECOVERY_OBSTRUCTED,
  JEDIT_WSC_STARTUP_RECOVERY_RECOVERED,
  type JeditWscStartupRecoveryNotRequested,
  type JeditWscStartupRecoveryResult,
} from '../ports/jedit-wsc-startup-recovery.js';

export function unrecoveredJeditWscStartupRecovery(): JeditWscStartupRecoveryNotRequested {
  return {
    status: JEDIT_WSC_STARTUP_RECOVERY_NOT_REQUESTED,
  };
}

export function recoverJeditWorkspaceFromWsc(
  store: JeditWscWorkspaceStorePort,
): JeditWscStartupRecoveryResult {
  const listed = store.listEnvelopes();
  if (listed.status === JEDIT_WSC_WORKSPACE_STORE_OBSTRUCTED) {
    return {
      status: JEDIT_WSC_STARTUP_RECOVERY_OBSTRUCTED,
      obstruction: listed.obstruction,
    };
  }
  if (listed.envelopeIds.length === 0) {
    return {
      status: JEDIT_WSC_STARTUP_RECOVERY_NO_HISTORY,
      hostImportMode: JEDIT_WSC_STARTUP_HOST_IMPORT_EXPLICIT,
    };
  }
  return {
    status: JEDIT_WSC_STARTUP_RECOVERY_RECOVERED,
    authorityPosture: JEDIT_WSC_STARTUP_AUTHORITY_ECHO_HISTORY,
    readingCachePosture: JEDIT_WSC_STARTUP_PENDING_MATERIALIZATION,
    outcomePosture: JEDIT_WSC_STARTUP_PENDING_MATERIALIZATION,
    envelopeIds: listed.envelopeIds,
  };
}
