import type { EditorFilePort } from '../ports/editor-file.js';
import {
  JEDIT_WSC_WORKSPACE_STORE_OBSTRUCTED,
  type JeditWscWorkspaceStoreObstruction,
  type JeditWscWorkspaceStorePort,
} from '../ports/jedit-wsc-workspace-store.js';
import {
  JEDIT_WSC_CURRENT_HISTORY_EXPORTED,
  JEDIT_WSC_CURRENT_HISTORY_EXPORT_EVIDENCE_PREFIX,
  JEDIT_WSC_CURRENT_HISTORY_EXPORT_OBSTRUCTED,
  JEDIT_WSC_CURRENT_HISTORY_HOST_ARTIFACT_WRITE_FAILED,
  JEDIT_WSC_CURRENT_HISTORY_MATERIALIZATION_OBSTRUCTED,
  JEDIT_WSC_CURRENT_HISTORY_MISSING_CURRENT_BASIS,
  JEDIT_WSC_CURRENT_HISTORY_WSC_STORE_OBSTRUCTED,
  type JeditWscCurrentHistoryExportObstructed,
  type JeditWscCurrentHistoryExportResult,
  type JeditWscCurrentHistoryMaterializer,
} from '../ports/jedit-wsc-current-history-export.js';
import {
  JEDIT_WSC_HISTORY_BASIS_OBSTRUCTED,
  type JeditWscHistoricalBasis,
  type JeditWscHistoryBasisObstruction,
} from '../ports/jedit-wsc-history-basis.js';
import {
  listJeditWscHistoricalBases,
  selectJeditWscHistoricalBasis,
} from './jedit-wsc-history-basis.js';

export interface ExportCurrentJeditWscHistoryInput {
  readonly store: JeditWscWorkspaceStorePort;
  readonly editorFile: EditorFilePort;
  readonly materializer: JeditWscCurrentHistoryMaterializer;
}

export function exportCurrentJeditWscHistory(
  input: ExportCurrentJeditWscHistoryInput,
): JeditWscCurrentHistoryExportResult {
  const currentBasis = currentWscHistoryBasis(input.store);
  if (!('basis' in currentBasis)) {
    return currentBasis;
  }
  const selected = selectJeditWscHistoricalBasis(input.store, currentBasis.basis.basisId);
  if (selected.status === JEDIT_WSC_HISTORY_BASIS_OBSTRUCTED) {
    return basisObstructed(selected.obstruction);
  }
  const materialized = input.materializer.materialize(selected.envelope, selected.basis);
  if (materialized.status === JEDIT_WSC_CURRENT_HISTORY_MATERIALIZATION_OBSTRUCTED) {
    return exportObstructed(materialized.obstruction.code, materialized.obstruction.message, selected.basis.basisId);
  }
  return writeHostArtifact(input.editorFile, selected.basis, materialized.artifact);
}

function currentWscHistoryBasis(
  store: JeditWscWorkspaceStorePort,
): { readonly basis: JeditWscHistoricalBasis } | JeditWscCurrentHistoryExportObstructed {
  const listed = store.listEnvelopes();
  if (listed.status === JEDIT_WSC_WORKSPACE_STORE_OBSTRUCTED) {
    return storeObstructed(listed.obstruction);
  }
  const bases = listJeditWscHistoricalBases(listed.envelopeIds).bases;
  const basis = bases.at(-1);
  return basis == null
    ? exportObstructed(JEDIT_WSC_CURRENT_HISTORY_MISSING_CURRENT_BASIS, 'No WSC current basis is retained.')
    : { basis };
}

function writeHostArtifact(
  editorFile: EditorFilePort,
  basis: JeditWscHistoricalBasis,
  artifact: { readonly filePath: string; readonly lines: readonly string[]; readonly readingId: string },
): JeditWscCurrentHistoryExportResult {
  try {
    editorFile.saveEditorFile(artifact.filePath, artifact.lines);
  } catch (cause) {
    return exportObstructed(
      JEDIT_WSC_CURRENT_HISTORY_HOST_ARTIFACT_WRITE_FAILED,
      cause instanceof Error ? cause.message : String(cause),
      basis.basisId,
    );
  }
  return {
    status: JEDIT_WSC_CURRENT_HISTORY_EXPORTED,
    basisId: basis.basisId,
    filePath: artifact.filePath,
    readingId: artifact.readingId,
    exportEvidenceId: `${JEDIT_WSC_CURRENT_HISTORY_EXPORT_EVIDENCE_PREFIX}${basis.basisId}:${artifact.readingId}`,
    lineCount: artifact.lines.length,
  };
}

function basisObstructed(
  obstruction: JeditWscHistoryBasisObstruction,
): JeditWscCurrentHistoryExportObstructed {
  return exportObstructed(obstruction.code, obstruction.message, obstruction.basisId);
}

function storeObstructed(
  obstruction: JeditWscWorkspaceStoreObstruction,
): JeditWscCurrentHistoryExportObstructed {
  return exportObstructed(JEDIT_WSC_CURRENT_HISTORY_WSC_STORE_OBSTRUCTED, obstruction.message, obstruction.envelopeId);
}

function exportObstructed(
  code: string,
  message: string,
  basisId?: string,
): JeditWscCurrentHistoryExportObstructed {
  return {
    status: JEDIT_WSC_CURRENT_HISTORY_EXPORT_OBSTRUCTED,
    obstruction: {
      code,
      message,
      basisId,
    },
  };
}
