import type { EditorFilePort } from '../ports/editor-file.js';
import {
  JEDIT_WSC_WORKSPACE_STORE_OBSTRUCTED,
  type JeditWscWorkspaceEnvelope,
  type JeditWscWorkspaceStoreObstruction,
  type JeditWscWorkspaceStorePort,
} from '../ports/jedit-wsc-workspace-store.js';
import {
  JEDIT_WSC_CURRENT_HISTORY_EXPORTED,
  JEDIT_WSC_CURRENT_HISTORY_EXPORT_EVIDENCE_PREFIX,
  JEDIT_WSC_CURRENT_HISTORY_EXPORT_OBSTRUCTED,
  JEDIT_WSC_CURRENT_HISTORY_HOST_ARTIFACT_WRITE_FAILED,
  JEDIT_WSC_CURRENT_HISTORY_MATERIALIZATION_FAILED,
  JEDIT_WSC_CURRENT_HISTORY_MATERIALIZATION_OBSTRUCTED,
  JEDIT_WSC_CURRENT_HISTORY_MISSING_CURRENT_BASIS,
  JEDIT_WSC_CURRENT_HISTORY_WSC_STORE_OBSTRUCTED,
  type JeditWscCurrentHistoryExportObstructed,
  type JeditWscCurrentHistoryExportResult,
  type JeditWscCurrentHistoryMaterializer,
} from '../ports/jedit-wsc-current-history-export.js';
import {
  type JeditWscHistoricalBasis,
} from '../ports/jedit-wsc-history-basis.js';
import { listJeditWscHistoricalBases } from './jedit-wsc-history-basis.js';

interface CurrentWscHistoryBasis {
  readonly basis: JeditWscHistoricalBasis;
  readonly envelope: JeditWscWorkspaceEnvelope;
}

interface CurrentWscHistoryCandidate {
  readonly envelopeId: string;
  readonly envelope: JeditWscWorkspaceEnvelope;
  readonly submittedAtMs: number;
}

interface CurrentWscHistoryCandidates {
  readonly candidates: readonly CurrentWscHistoryCandidate[];
}

export interface ExportCurrentJeditWscHistoryInput {
  readonly store: JeditWscWorkspaceStorePort;
  readonly editorFile: EditorFilePort;
  readonly materializer: JeditWscCurrentHistoryMaterializer;
}

const WSC_EDIT_SETTLEMENT_SCHEMA_VERSION = 'jedit.workspace_text_edit_settlement.v1';

export function exportCurrentJeditWscHistory(
  input: ExportCurrentJeditWscHistoryInput,
): JeditWscCurrentHistoryExportResult {
  const currentBasis = currentWscHistoryBasis(input.store);
  if (!('basis' in currentBasis)) {
    return currentBasis;
  }
  const materialized = input.materializer.materialize(currentBasis.envelope, currentBasis.basis);
  if (materialized.status === JEDIT_WSC_CURRENT_HISTORY_MATERIALIZATION_OBSTRUCTED) {
    return exportObstructed(materialized.obstruction.code, materialized.obstruction.message, currentBasis.basis.basisId);
  }
  return writeHostArtifact(input.editorFile, currentBasis.basis, materialized.artifact);
}

function currentWscHistoryBasis(
  store: JeditWscWorkspaceStorePort,
): CurrentWscHistoryBasis | JeditWscCurrentHistoryExportObstructed {
  const listed = store.listEnvelopes();
  if (listed.status === JEDIT_WSC_WORKSPACE_STORE_OBSTRUCTED) {
    return storeObstructed(listed.obstruction);
  }
  const recovered = currentHistoryCandidates(store, listed.envelopeIds);
  if (!('candidates' in recovered)) {
    return recovered;
  }
  const ordered = [...recovered.candidates].sort(compareCurrentHistoryCandidates);
  const current = ordered.at(-1);
  if (current == null) {
    return exportObstructed(JEDIT_WSC_CURRENT_HISTORY_MISSING_CURRENT_BASIS, 'No WSC current basis is retained.');
  }
  const basis = listJeditWscHistoricalBases(ordered.map((candidate) => candidate.envelopeId)).bases.at(-1);
  return basis == null
    ? exportObstructed(JEDIT_WSC_CURRENT_HISTORY_MISSING_CURRENT_BASIS, 'No WSC current basis is retained.')
    : { basis, envelope: current.envelope };
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

function currentHistoryCandidates(
  store: JeditWscWorkspaceStorePort,
  envelopeIds: readonly string[],
): CurrentWscHistoryCandidates | JeditWscCurrentHistoryExportObstructed {
  const candidates: CurrentWscHistoryCandidate[] = [];
  for (const envelopeId of envelopeIds) {
    const read = store.readEnvelope(envelopeId);
    if (read.status === JEDIT_WSC_WORKSPACE_STORE_OBSTRUCTED) {
      return storeObstructed(read.obstruction);
    }
    const submittedAtMs = submittedAtMsFromEnvelope(read.envelope);
    if (submittedAtMs == null) {
      return exportObstructed(
        JEDIT_WSC_CURRENT_HISTORY_MATERIALIZATION_FAILED,
        `WSC envelope lacks current-basis metadata: ${read.envelope.envelopeId}`,
        read.envelope.envelopeId,
      );
    }
    candidates.push({
      envelopeId: read.envelope.envelopeId,
      envelope: read.envelope,
      submittedAtMs,
    });
  }
  return { candidates };
}

function submittedAtMsFromEnvelope(envelope: JeditWscWorkspaceEnvelope): number | undefined {
  try {
    const payload = JSON.parse(Buffer.from(envelope.bytes).toString('utf8'));
    return payload?.schemaVersion === WSC_EDIT_SETTLEMENT_SCHEMA_VERSION
      && Number.isFinite(payload.submittedAtMs)
      ? payload.submittedAtMs
      : undefined;
  } catch {
    return undefined;
  }
}

function compareCurrentHistoryCandidates(
  left: CurrentWscHistoryCandidate,
  right: CurrentWscHistoryCandidate,
): number {
  if (left.submittedAtMs !== right.submittedAtMs) {
    return left.submittedAtMs - right.submittedAtMs;
  }
  return left.envelopeId.localeCompare(right.envelopeId);
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
