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
import {
  UTF8_ENCODING,
  WSC_EDIT_SETTLEMENT_SCHEMA_VERSION,
} from './workspace/workspace-text-wsc-settlement.js';

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

export interface ExportJeditWscHistoryAtBasisInput extends ExportCurrentJeditWscHistoryInput {
  readonly basisId: string;
}

interface ExportJeditWscHistoryBasisInput {
  readonly basis: JeditWscHistoricalBasis;
  readonly envelope: JeditWscWorkspaceEnvelope;
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
  return exportJeditWscHistoryBasis({
    basis: currentBasis.basis,
    envelope: currentBasis.envelope,
    editorFile: input.editorFile,
    materializer: input.materializer,
  });
}

export function exportJeditWscHistoryAtBasis(
  input: ExportJeditWscHistoryAtBasisInput,
): JeditWscCurrentHistoryExportResult {
  const historicalBasis = historicalWscHistoryBasis(input.store, input.basisId);
  if (!('basis' in historicalBasis)) {
    return historicalBasis;
  }
  return exportJeditWscHistoryBasis({
    basis: historicalBasis.basis,
    envelope: historicalBasis.envelope,
    editorFile: input.editorFile,
    materializer: input.materializer,
  });
}

function exportJeditWscHistoryBasis(
  input: ExportJeditWscHistoryBasisInput,
): JeditWscCurrentHistoryExportResult {
  const materialized = input.materializer.materialize(input.envelope, input.basis);
  if (materialized.status === JEDIT_WSC_CURRENT_HISTORY_MATERIALIZATION_OBSTRUCTED) {
    return exportObstructed(materialized.obstruction.code, materialized.obstruction.message, input.basis.basisId);
  }
  return writeHostArtifact(input.editorFile, input.basis, materialized.artifact);
}

function historicalWscHistoryBasis(
  store: JeditWscWorkspaceStorePort,
  basisId: string,
): CurrentWscHistoryBasis | JeditWscCurrentHistoryExportObstructed {
  const listed = store.listEnvelopes();
  if (listed.status === JEDIT_WSC_WORKSPACE_STORE_OBSTRUCTED) {
    return storeObstructed(listed.obstruction);
  }
  const basis = listJeditWscHistoricalBases(listed.envelopeIds)
    .bases
    .find((candidate) => candidate.basisId === basisId);
  if (basis == null) {
    return exportObstructed(
      JEDIT_WSC_CURRENT_HISTORY_MISSING_CURRENT_BASIS,
      `No WSC historical basis is retained for ${basisId}.`,
      basisId,
    );
  }
  const read = store.readEnvelope(basis.envelopeId);
  if (read.status === JEDIT_WSC_WORKSPACE_STORE_OBSTRUCTED) {
    return storeObstructed(read.obstruction);
  }
  return { basis, envelope: read.envelope };
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
    const payload = JSON.parse(Buffer.from(envelope.bytes).toString(UTF8_ENCODING));
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
  return compareEnvelopeIds(left.envelopeId, right.envelopeId);
}

function compareEnvelopeIds(left: string, right: string): number {
  if (left < right) {
    return -1;
  }
  if (left > right) {
    return 1;
  }
  return 0;
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
