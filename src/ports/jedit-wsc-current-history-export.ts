import type { JeditWscHistoricalBasis } from './jedit-wsc-history-basis.js';
import type { JeditWscWorkspaceEnvelope } from './jedit-wsc-workspace-store.js';

export const JEDIT_WSC_CURRENT_HISTORY_EXPORTED = 'JEDIT_WSC_CURRENT_HISTORY_EXPORTED';
export const JEDIT_WSC_CURRENT_HISTORY_EXPORT_OBSTRUCTED = 'JEDIT_WSC_CURRENT_HISTORY_EXPORT_OBSTRUCTED';
export const JEDIT_WSC_CURRENT_HISTORY_MATERIALIZED = 'JEDIT_WSC_CURRENT_HISTORY_MATERIALIZED';
export const JEDIT_WSC_CURRENT_HISTORY_MATERIALIZATION_OBSTRUCTED = 'JEDIT_WSC_CURRENT_HISTORY_MATERIALIZATION_OBSTRUCTED';
export const JEDIT_WSC_CURRENT_HISTORY_EXPORT_EVIDENCE_PREFIX = 'wsc-current-export:';
export const JEDIT_WSC_CURRENT_HISTORY_MISSING_CURRENT_BASIS = 'missing_current_basis';
export const JEDIT_WSC_CURRENT_HISTORY_WSC_STORE_OBSTRUCTED = 'wsc_store_obstructed';
export const JEDIT_WSC_CURRENT_HISTORY_MATERIALIZATION_FAILED = 'materialization_failed';
export const JEDIT_WSC_CURRENT_HISTORY_HOST_ARTIFACT_WRITE_FAILED = 'host_artifact_write_failed';

export interface JeditWscCurrentHistoryArtifact {
  readonly filePath: string;
  readonly lines: readonly string[];
  readonly readingId: string;
}

export interface JeditWscCurrentHistoryMaterialized {
  readonly status: typeof JEDIT_WSC_CURRENT_HISTORY_MATERIALIZED;
  readonly artifact: JeditWscCurrentHistoryArtifact;
}

export interface JeditWscCurrentHistoryObstruction {
  readonly code: string;
  readonly message: string;
  readonly basisId?: string;
}

export interface JeditWscCurrentHistoryMaterializationObstructed {
  readonly status: typeof JEDIT_WSC_CURRENT_HISTORY_MATERIALIZATION_OBSTRUCTED;
  readonly obstruction: JeditWscCurrentHistoryObstruction;
}

export type JeditWscCurrentHistoryMaterializationResult =
  | JeditWscCurrentHistoryMaterialized
  | JeditWscCurrentHistoryMaterializationObstructed;

export interface JeditWscCurrentHistoryMaterializer {
  materialize(
    envelope: JeditWscWorkspaceEnvelope,
    basis: JeditWscHistoricalBasis,
  ): JeditWscCurrentHistoryMaterializationResult;
}

export interface JeditWscCurrentHistoryExported {
  readonly status: typeof JEDIT_WSC_CURRENT_HISTORY_EXPORTED;
  readonly basisId: string;
  readonly filePath: string;
  readonly readingId: string;
  readonly exportEvidenceId: string;
  readonly lineCount: number;
}

export interface JeditWscCurrentHistoryExportObstructed {
  readonly status: typeof JEDIT_WSC_CURRENT_HISTORY_EXPORT_OBSTRUCTED;
  readonly obstruction: JeditWscCurrentHistoryObstruction;
}

export type JeditWscCurrentHistoryExportResult =
  | JeditWscCurrentHistoryExported
  | JeditWscCurrentHistoryExportObstructed;
