import type { JeditWscWorkspaceStoreObstruction } from './jedit-wsc-workspace-store.js';

export const JEDIT_WSC_STARTUP_RECOVERY_NOT_REQUESTED = 'JEDIT_WSC_STARTUP_RECOVERY_NOT_REQUESTED';
export const JEDIT_WSC_STARTUP_RECOVERY_NO_HISTORY = 'JEDIT_WSC_STARTUP_RECOVERY_NO_HISTORY';
export const JEDIT_WSC_STARTUP_RECOVERY_RECOVERED = 'JEDIT_WSC_STARTUP_RECOVERY_RECOVERED';
export const JEDIT_WSC_STARTUP_RECOVERY_OBSTRUCTED = 'JEDIT_WSC_STARTUP_RECOVERY_OBSTRUCTED';
export const JEDIT_WSC_STARTUP_HOST_IMPORT_EXPLICIT = 'explicit_import_required';
export const JEDIT_WSC_STARTUP_AUTHORITY_ECHO_HISTORY = 'echo_wsc_history';
export const JEDIT_WSC_STARTUP_PENDING_MATERIALIZATION = 'pending_materialization';

export interface JeditWscStartupRecoveryNotRequested {
  readonly status: typeof JEDIT_WSC_STARTUP_RECOVERY_NOT_REQUESTED;
}

export interface JeditWscStartupRecoveryNoHistory {
  readonly status: typeof JEDIT_WSC_STARTUP_RECOVERY_NO_HISTORY;
  readonly hostImportMode: typeof JEDIT_WSC_STARTUP_HOST_IMPORT_EXPLICIT;
}

export interface JeditWscStartupRecoveryRecovered {
  readonly status: typeof JEDIT_WSC_STARTUP_RECOVERY_RECOVERED;
  readonly authorityPosture: typeof JEDIT_WSC_STARTUP_AUTHORITY_ECHO_HISTORY;
  readonly readingCachePosture: typeof JEDIT_WSC_STARTUP_PENDING_MATERIALIZATION;
  readonly outcomePosture: typeof JEDIT_WSC_STARTUP_PENDING_MATERIALIZATION;
  readonly envelopeIds: readonly string[];
}

export interface JeditWscStartupRecoveryObstructed {
  readonly status: typeof JEDIT_WSC_STARTUP_RECOVERY_OBSTRUCTED;
  readonly obstruction: JeditWscWorkspaceStoreObstruction;
}

export type JeditWscStartupRecoveryResult =
  | JeditWscStartupRecoveryNotRequested
  | JeditWscStartupRecoveryNoHistory
  | JeditWscStartupRecoveryRecovered
  | JeditWscStartupRecoveryObstructed;
