import type { EditorFilePort } from '../ports/editor-file.js';
import {
  JEDIT_WSC_WORKSPACE_STORE_OBSTRUCTED,
  type JeditWscWorkspaceEnvelope,
  type JeditWscWorkspaceStoreObstruction,
  type JeditWscWorkspaceStorePort,
} from '../ports/jedit-wsc-workspace-store.js';
import {
  JEDIT_WSC_HISTORY_REJECTION_SCHEMA_VERSION,
} from '../ports/jedit-wsc-history-listing.js';
import {
  JEDIT_WSC_CURRENT_HISTORY_EXPORTED,
  JEDIT_WSC_CURRENT_HISTORY_EXPORT_EVIDENCE_PREFIX,
  JEDIT_WSC_CURRENT_HISTORY_EXPORT_OBSTRUCTED,
  JEDIT_WSC_CURRENT_HISTORY_BOUNDED_READING_NOT_MATERIALIZABLE,
  JEDIT_WSC_CURRENT_HISTORY_HOST_ARTIFACT_WRITE_FAILED,
  JEDIT_WSC_CURRENT_HISTORY_MATERIALIZATION_OBSTRUCTED,
  JEDIT_WSC_CURRENT_HISTORY_MATERIALIZATION_FAILED,
  JEDIT_WSC_CURRENT_HISTORY_MATERIALIZATION_REQUIRES_FULL_PROJECTION,
  JEDIT_WSC_CURRENT_HISTORY_MISSING_CURRENT_BASIS,
  JEDIT_WSC_CURRENT_HISTORY_WSC_STORE_OBSTRUCTED,
  type JeditWscCurrentHistoryObstruction,
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

type CurrentWscHistoryEnvelopeMetadata =
  | { readonly status: 'candidate'; readonly submittedAtMs: number }
  | { readonly status: 'ignored' }
  | { readonly status: 'obstructed'; readonly message: string };

interface CurrentWscSettlementPayload {
  readonly schemaVersion?: string;
  readonly submittedAtMs?: number;
  readonly reading?: CurrentWscSettlementReadingPayload;
}

interface CurrentWscSettlementReadingPayload {
  readonly coverage?: string;
  readonly startLine?: number;
  readonly returnedLineCount?: number;
  readonly totalLineCount?: number;
  readonly hasMoreBefore?: boolean;
  readonly hasMoreAfter?: boolean;
  readonly truncated?: boolean;
}

const METADATA_CANDIDATE: 'candidate' = 'candidate';
const METADATA_IGNORED: 'ignored' = 'ignored';
const METADATA_OBSTRUCTED: 'obstructed' = 'obstructed';
const READING_COVERAGE_FULL = 'full';
const FIRST_READING_LINE = 0;

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
  const projectionObstruction = materializationProjectionObstruction(input.envelope, input.basis.basisId);
  if (projectionObstruction != null) {
    return {
      status: JEDIT_WSC_CURRENT_HISTORY_EXPORT_OBSTRUCTED,
      obstruction: projectionObstruction,
    };
  }
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
    const metadata = currentHistoryMetadataFromEnvelope(read.envelope);
    if (metadata.status === METADATA_OBSTRUCTED) {
      return exportObstructed(JEDIT_WSC_CURRENT_HISTORY_MATERIALIZATION_FAILED, metadata.message, read.envelope.envelopeId);
    }
    if (metadata.status === METADATA_IGNORED) {
      continue;
    }
    candidates.push({
      envelopeId: read.envelope.envelopeId,
      envelope: read.envelope,
      submittedAtMs: metadata.submittedAtMs,
    });
  }
  return { candidates };
}

function currentHistoryMetadataFromEnvelope(envelope: JeditWscWorkspaceEnvelope): CurrentWscHistoryEnvelopeMetadata {
  let payload: CurrentWscSettlementPayload;
  try {
    payload = JSON.parse(Buffer.from(envelope.bytes).toString(UTF8_ENCODING));
  } catch {
    return { status: METADATA_OBSTRUCTED, message: `WSC envelope is not valid JSON: ${envelope.envelopeId}` };
  }
  if (payload.schemaVersion === JEDIT_WSC_HISTORY_REJECTION_SCHEMA_VERSION) {
    return { status: METADATA_IGNORED };
  }
  if (payload.schemaVersion !== WSC_EDIT_SETTLEMENT_SCHEMA_VERSION) {
    return { status: METADATA_OBSTRUCTED, message: `WSC envelope has unsupported schema: ${envelope.envelopeId}` };
  }
  const submittedAtMs = payload.submittedAtMs;
  return isFiniteNumber(submittedAtMs)
    ? { status: METADATA_CANDIDATE, submittedAtMs }
    : { status: METADATA_OBSTRUCTED, message: `WSC envelope lacks current-basis metadata: ${envelope.envelopeId}` };
}

function materializationProjectionObstruction(
  envelope: JeditWscWorkspaceEnvelope,
  basisId: string,
): JeditWscCurrentHistoryObstruction | undefined {
  const payload = settlementPayloadFromEnvelope(envelope);
  if (!('payload' in payload)) {
    return { code: JEDIT_WSC_CURRENT_HISTORY_MATERIALIZATION_FAILED, message: payload.message, basisId };
  }
  if (payload.payload.schemaVersion !== WSC_EDIT_SETTLEMENT_SCHEMA_VERSION) {
    return {
      code: JEDIT_WSC_CURRENT_HISTORY_MATERIALIZATION_FAILED,
      message: `WSC envelope has unsupported materialization schema: ${envelope.envelopeId}`,
      basisId,
    };
  }
  const reading = payload.payload.reading;
  if (reading?.coverage == null) {
    return {
      code: JEDIT_WSC_CURRENT_HISTORY_MATERIALIZATION_REQUIRES_FULL_PROJECTION,
      message: `WSC envelope lacks full-projection reading coverage: ${envelope.envelopeId}`,
      basisId,
    };
  }
  return readingCoversFullProjection(reading)
    ? undefined
    : {
      code: JEDIT_WSC_CURRENT_HISTORY_BOUNDED_READING_NOT_MATERIALIZABLE,
      message: `WSC envelope reading is bounded and cannot be materialized as full text: ${envelope.envelopeId}`,
      basisId,
    };
}

function settlementPayloadFromEnvelope(
  envelope: JeditWscWorkspaceEnvelope,
): { readonly payload: CurrentWscSettlementPayload } | { readonly message: string } {
  try {
    return {
      payload: JSON.parse(Buffer.from(envelope.bytes).toString(UTF8_ENCODING)),
    };
  } catch {
    return { message: `WSC envelope is not valid JSON: ${envelope.envelopeId}` };
  }
}

function readingCoversFullProjection(reading: CurrentWscSettlementReadingPayload): boolean {
  return reading.coverage === READING_COVERAGE_FULL
    && reading.startLine === FIRST_READING_LINE
    && reading.hasMoreBefore !== true
    && reading.hasMoreAfter !== true
    && reading.truncated !== true
    && reading.returnedLineCount === reading.totalLineCount;
}

function isFiniteNumber(value: number | undefined): value is number {
  return value != null && Number.isFinite(value);
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
