import { createHash } from 'node:crypto';
import {
  JEDIT_WSC_CURRENT_HISTORY_EXPORT_EVIDENCE_PREFIX,
} from '../ports/jedit-wsc-current-history-export.js';
import {
  JEDIT_WSC_WORKSPACE_STORE_OBSTRUCTED,
  type JeditWscWorkspaceEnvelope,
  type JeditWscWorkspaceStoreObstruction,
  type JeditWscWorkspaceStorePort,
} from '../ports/jedit-wsc-workspace-store.js';
import {
  JEDIT_WSC_HISTORY_APPLIED,
  JEDIT_WSC_HISTORY_LISTED,
  JEDIT_WSC_HISTORY_LIST_OBSTRUCTED,
  JEDIT_WSC_HISTORY_MALFORMED_EVIDENCE,
  JEDIT_WSC_HISTORY_MISSING_EVIDENCE,
  JEDIT_WSC_HISTORY_READ_OBSTRUCTED_EVIDENCE,
  JEDIT_WSC_HISTORY_REJECTED,
  JEDIT_WSC_HISTORY_REJECTION_EVIDENCE,
  JEDIT_WSC_HISTORY_REJECTION_SCHEMA_VERSION,
  JEDIT_WSC_HISTORY_SETTLEMENT_EVIDENCE,
  JEDIT_WSC_HISTORY_UNSUPPORTED_EVIDENCE,
  type JeditWscHistoryFileSummary,
  type JeditWscHistoryListObstructed,
  type JeditWscHistoryListResult,
  type JeditWscHistoryListed,
  type JeditWscHistoryRecord,
} from '../ports/jedit-wsc-history-listing.js';
import {
  UTF8_ENCODING,
  WSC_EDIT_SETTLEMENT_SCHEMA_VERSION,
} from './workspace/workspace-text-wsc-settlement.js';

const FIRST_SEQUENCE = 1;
const COUNT_INCREMENT = 1;
const EMPTY_COUNT = 0;
const SORT_BEFORE = -1;
const SORT_EQUAL = 0;
const SORT_AFTER = 1;
const SHA256_ALGORITHM = 'sha256';
const HEX_ENCODING = 'hex';
const MISSING_TIMESTAMP_SORT = Number.MAX_SAFE_INTEGER;

interface JeditWscHistoryRecordDraft {
  readonly basisId: string;
  readonly envelopeId: string;
  readonly outcomeStatus: string;
  readonly evidencePosture: string;
  readonly filePath?: string;
  readonly bufferId?: string;
  readonly commandKind?: string;
  readonly submittedAtMs?: number;
  readonly receiptId?: string;
  readonly readingId?: string;
  readonly readingLineCount?: number;
  readonly readingTextDigest?: string;
  readonly checkpointId?: string;
  readonly exportEvidenceId?: string;
  readonly submissionId?: string;
  readonly admissionId?: string;
  readonly ticketId?: string;
  readonly executionId?: string;
  readonly rejectionReason?: string;
  readonly obstructionCode?: string;
  readonly obstructionMessage?: string;
}

interface MutableFileSummary {
  filePath: string;
  recordCount: number;
  appliedCount: number;
  rejectedCount: number;
  missingEvidenceCount: number;
  latestBasisId: string;
  latestSubmittedAtMs: number;
}

interface SubmittedAtCarrier {
  readonly submittedAtMs?: number;
}

interface JeditWscHistoryCommonFields {
  readonly filePath?: string;
  readonly bufferId?: string;
  readonly commandKind?: string;
  readonly submittedAtMs?: number;
  readonly receiptId?: string;
  readonly checkpointId?: string;
  readonly submissionId?: string;
  readonly admissionId?: string;
  readonly ticketId?: string;
  readonly executionId?: string;
}

interface JeditWscHistoryReadingPayload {
  readonly readingId?: string;
  readonly lineCount?: number;
  readonly lines?: readonly string[];
}

interface JeditWscHistoryEnvelopePayload extends JeditWscHistoryCommonFields {
  readonly schemaVersion?: string;
  readonly reading?: JeditWscHistoryReadingPayload;
  readonly rejectionReason?: string;
  readonly reason?: string;
}

export function listJeditWscHistory(
  store: JeditWscWorkspaceStorePort,
): JeditWscHistoryListResult {
  const listed = store.listEnvelopes();
  if (listed.status === JEDIT_WSC_WORKSPACE_STORE_OBSTRUCTED) {
    return listObstructed(listed.obstruction);
  }
  return listedHistory(listed.envelopeIds.map((envelopeId) => readHistoryRecord(store, envelopeId)));
}

export function listJeditWscHistoryForFile(
  store: JeditWscWorkspaceStorePort,
  filePath: string,
): JeditWscHistoryListResult {
  const listed = listJeditWscHistory(store);
  if (listed.status === JEDIT_WSC_HISTORY_LIST_OBSTRUCTED) {
    return listed;
  }
  return listedHistory(listed.records.filter((record) => record.filePath === filePath));
}

function readHistoryRecord(
  store: JeditWscWorkspaceStorePort,
  envelopeId: string,
): JeditWscHistoryRecordDraft {
  const read = store.readEnvelope(envelopeId);
  if (read.status === JEDIT_WSC_WORKSPACE_STORE_OBSTRUCTED) {
    return missingEvidenceRecord(envelopeId, read.obstruction);
  }
  return decodeHistoryEnvelope(read.envelope);
}

function decodeHistoryEnvelope(envelope: JeditWscWorkspaceEnvelope): JeditWscHistoryRecordDraft {
  try {
    const payload: JeditWscHistoryEnvelopePayload = JSON.parse(Buffer.from(envelope.bytes).toString(UTF8_ENCODING));
    if (payload?.schemaVersion === WSC_EDIT_SETTLEMENT_SCHEMA_VERSION) {
      return appliedRecord(envelope.envelopeId, payload);
    }
    if (payload?.schemaVersion === JEDIT_WSC_HISTORY_REJECTION_SCHEMA_VERSION) {
      return rejectedRecord(envelope.envelopeId, payload);
    }
    return unsupportedEvidenceRecord(envelope.envelopeId);
  } catch (cause) {
    return malformedEvidenceRecord(envelope.envelopeId, cause instanceof Error ? cause.message : String(cause));
  }
}

function appliedRecord(
  envelopeId: string,
  payload: JeditWscHistoryEnvelopePayload,
): JeditWscHistoryRecordDraft {
  const readingId = payload.reading?.readingId;
  return {
    basisId: envelopeId,
    envelopeId,
    outcomeStatus: JEDIT_WSC_HISTORY_APPLIED,
    evidencePosture: JEDIT_WSC_HISTORY_SETTLEMENT_EVIDENCE,
    ...commonPayloadFields(payload),
    readingId,
    readingLineCount: payload.reading?.lineCount,
    readingTextDigest: readingDigest(payload.reading?.lines),
    exportEvidenceId: readingId != null
      ? `${JEDIT_WSC_CURRENT_HISTORY_EXPORT_EVIDENCE_PREFIX}${envelopeId}:${readingId}`
      : undefined,
  };
}

function rejectedRecord(
  envelopeId: string,
  payload: JeditWscHistoryEnvelopePayload,
): JeditWscHistoryRecordDraft {
  return {
    basisId: envelopeId,
    envelopeId,
    outcomeStatus: JEDIT_WSC_HISTORY_REJECTED,
    evidencePosture: JEDIT_WSC_HISTORY_REJECTION_EVIDENCE,
    ...commonPayloadFields(payload),
    rejectionReason: String(payload.rejectionReason ?? payload.reason ?? 'rejected'),
  };
}

function commonPayloadFields(payload: JeditWscHistoryEnvelopePayload): JeditWscHistoryCommonFields {
  return {
    filePath: payload.filePath,
    bufferId: payload.bufferId,
    commandKind: payload.commandKind,
    submittedAtMs: payload.submittedAtMs,
    receiptId: payload.receiptId,
    checkpointId: payload.checkpointId,
    submissionId: payload.submissionId,
    admissionId: payload.admissionId,
    ticketId: payload.ticketId,
    executionId: payload.executionId,
  };
}

function missingEvidenceRecord(
  envelopeId: string,
  obstruction: JeditWscWorkspaceStoreObstruction,
): JeditWscHistoryRecordDraft {
  return {
    basisId: envelopeId,
    envelopeId,
    outcomeStatus: JEDIT_WSC_HISTORY_MISSING_EVIDENCE,
    evidencePosture: JEDIT_WSC_HISTORY_READ_OBSTRUCTED_EVIDENCE,
    obstructionCode: obstruction.code,
    obstructionMessage: obstruction.message,
  };
}

function unsupportedEvidenceRecord(envelopeId: string): JeditWscHistoryRecordDraft {
  return {
    basisId: envelopeId,
    envelopeId,
    outcomeStatus: JEDIT_WSC_HISTORY_MISSING_EVIDENCE,
    evidencePosture: JEDIT_WSC_HISTORY_UNSUPPORTED_EVIDENCE,
    obstructionCode: JEDIT_WSC_HISTORY_UNSUPPORTED_EVIDENCE,
    obstructionMessage: `unsupported WSC envelope schema: ${envelopeId}`,
  };
}

function malformedEvidenceRecord(envelopeId: string, message: string): JeditWscHistoryRecordDraft {
  return {
    basisId: envelopeId,
    envelopeId,
    outcomeStatus: JEDIT_WSC_HISTORY_MISSING_EVIDENCE,
    evidencePosture: JEDIT_WSC_HISTORY_MALFORMED_EVIDENCE,
    obstructionCode: JEDIT_WSC_HISTORY_MALFORMED_EVIDENCE,
    obstructionMessage: message,
  };
}

function listedHistory(records: readonly JeditWscHistoryRecordDraft[]): JeditWscHistoryListed {
  const numbered = [...records]
    .sort(compareHistoryRecords)
    .map(numberedRecord);
  return {
    status: JEDIT_WSC_HISTORY_LISTED,
    records: numbered,
    files: fileSummaries(numbered),
  };
}

function numberedRecord(record: JeditWscHistoryRecordDraft, index: number): JeditWscHistoryRecord {
  return {
    ...record,
    sequence: index + FIRST_SEQUENCE,
  };
}

function fileSummaries(records: readonly JeditWscHistoryRecord[]): readonly JeditWscHistoryFileSummary[] {
  const summaries = new Map<string, MutableFileSummary>();
  for (const record of records) {
    recordFileSummary(summaries, record);
  }
  return [...summaries.values()]
    .sort(compareFileSummaries)
    .map(fileSummary);
}

function recordFileSummary(
  summaries: Map<string, MutableFileSummary>,
  record: JeditWscHistoryRecord,
): void {
  if (record.filePath == null) {
    return;
  }
  const summary = summaries.get(record.filePath) ?? emptyFileSummary(record);
  summary.recordCount += 1;
  summary.appliedCount += record.outcomeStatus === JEDIT_WSC_HISTORY_APPLIED ? COUNT_INCREMENT : EMPTY_COUNT;
  summary.rejectedCount += record.outcomeStatus === JEDIT_WSC_HISTORY_REJECTED ? COUNT_INCREMENT : EMPTY_COUNT;
  summary.missingEvidenceCount += record.outcomeStatus === JEDIT_WSC_HISTORY_MISSING_EVIDENCE
    ? COUNT_INCREMENT
    : EMPTY_COUNT;
  updateLatestSummaryBasis(summary, record);
  summaries.set(record.filePath, summary);
}

function emptyFileSummary(record: JeditWscHistoryRecord): MutableFileSummary {
  return {
    filePath: record.filePath ?? '',
    recordCount: EMPTY_COUNT,
    appliedCount: EMPTY_COUNT,
    rejectedCount: EMPTY_COUNT,
    missingEvidenceCount: EMPTY_COUNT,
    latestBasisId: record.basisId,
    latestSubmittedAtMs: timestampSortValue(record),
  };
}

function updateLatestSummaryBasis(
  summary: MutableFileSummary,
  record: JeditWscHistoryRecord,
): void {
  const timestamp = timestampSortValue(record);
  if (timestamp < summary.latestSubmittedAtMs) {
    return;
  }
  if (timestamp === summary.latestSubmittedAtMs && record.basisId < summary.latestBasisId) {
    return;
  }
  summary.latestBasisId = record.basisId;
  summary.latestSubmittedAtMs = timestamp;
}

function fileSummary(summary: MutableFileSummary): JeditWscHistoryFileSummary {
  return {
    filePath: summary.filePath,
    recordCount: summary.recordCount,
    appliedCount: summary.appliedCount,
    rejectedCount: summary.rejectedCount,
    missingEvidenceCount: summary.missingEvidenceCount,
    latestBasisId: summary.latestBasisId,
  };
}

function readingDigest(lines: readonly string[] | undefined): string | undefined {
  return Array.isArray(lines)
    ? createHash(SHA256_ALGORITHM).update(JSON.stringify(lines)).digest(HEX_ENCODING)
    : undefined;
}

function compareHistoryRecords(
  left: JeditWscHistoryRecordDraft,
  right: JeditWscHistoryRecordDraft,
): number {
  const timeComparison = timestampSortValue(left) - timestampSortValue(right);
  return timeComparison === SORT_EQUAL ? compareStrings(left.envelopeId, right.envelopeId) : timeComparison;
}

function compareFileSummaries(left: JeditWscHistoryFileSummary, right: JeditWscHistoryFileSummary): number {
  return compareStrings(left.filePath, right.filePath);
}

function timestampSortValue(record: SubmittedAtCarrier): number {
  const submittedAtMs = Number(record.submittedAtMs);
  return Number.isFinite(submittedAtMs)
    ? submittedAtMs
    : MISSING_TIMESTAMP_SORT;
}

function compareStrings(left: string, right: string): number {
  if (left < right) {
    return SORT_BEFORE;
  }
  if (left > right) {
    return SORT_AFTER;
  }
  return SORT_EQUAL;
}

function listObstructed(
  obstruction: JeditWscWorkspaceStoreObstruction,
): JeditWscHistoryListObstructed {
  return {
    status: JEDIT_WSC_HISTORY_LIST_OBSTRUCTED,
    obstruction: {
      code: obstruction.code,
      message: obstruction.message,
    },
  };
}
