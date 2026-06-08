import {
  JEDIT_WSC_HISTORY_EVENT_EDIT_SETTLEMENT,
  JEDIT_WSC_HISTORY_EVENT_UNSUPPORTED_ENVELOPE,
  JEDIT_WSC_HISTORY_EVIDENCE_AVAILABLE,
  JEDIT_WSC_HISTORY_EVIDENCE_DERIVED,
  JEDIT_WSC_HISTORY_EVIDENCE_MISSING,
  JEDIT_WSC_HISTORY_EVIDENCE_UNSUPPORTED,
  JEDIT_WSC_HISTORY_LIST_OBSTRUCTED,
  JEDIT_WSC_HISTORY_LISTED,
  JEDIT_WSC_HISTORY_MALFORMED_ENVELOPE,
  JEDIT_WSC_HISTORY_MISSING_CHECKPOINT,
  JEDIT_WSC_HISTORY_MISSING_EXPORT,
  JEDIT_WSC_HISTORY_MISSING_OUTCOME,
  JEDIT_WSC_HISTORY_MISSING_READING,
  JEDIT_WSC_HISTORY_MISSING_RECEIPT,
  JEDIT_WSC_HISTORY_MISSING_SUBMISSION,
  JEDIT_WSC_HISTORY_UNSUPPORTED_SCHEMA,
  JEDIT_WSC_HISTORY_WSC_STORE_OBSTRUCTED,
  type JeditWscHistoryEntry,
  type JeditWscHistoryEvidenceRef,
  type JeditWscHistoryEvidenceRefs,
  type JeditWscHistoryListingResult,
  type JeditWscHistoryListObstructed,
} from '../ports/jedit-wsc-history-listing.js';
import {
  JEDIT_WSC_WORKSPACE_STORE_OBSTRUCTED,
  type JeditWscWorkspaceEnvelope,
  type JeditWscWorkspaceStoreObstruction,
  type JeditWscWorkspaceStorePort,
} from '../ports/jedit-wsc-workspace-store.js';
import {
  UTF8_ENCODING,
  WSC_EDIT_SETTLEMENT_SCHEMA_VERSION,
} from './workspace/workspace-text-wsc-settlement.js';

const FIRST_SEQUENCE = 1;
const UNKNOWN_TIME_SORT = Number.POSITIVE_INFINITY;
const TEXT_EMPTY = '-';
const TABLE_SEPARATOR = '  ';
const SUBMISSION_PREFIX = 'wsc-submission:';
const OUTCOME_PREFIX = 'wsc-outcome:applied:';
const AVAILABLE_LABEL = 'available:';
const DERIVED_LABEL = 'derived:';
const MISSING_LABEL = 'missing:';
const UNSUPPORTED_LABEL = 'unsupported:';
const TYPE_TAG_STRING = 'string';
const TYPE_TAG_NUMBER = 'number';
const TYPE_TAG_OBJECT = 'object';
const MIN_NON_EMPTY_STRING_LENGTH = 0;
const ORDER_BEFORE = -1;
const ORDER_AFTER = 1;

interface ParsedEnvelope {
  readonly envelopeId: string;
  readonly eventKind: JeditWscHistoryEntry['eventKind'];
  readonly filePath?: string;
  readonly commandKind?: string;
  readonly submittedAtMs?: number;
  readonly lineCount?: number;
  readonly refs: JeditWscHistoryEvidenceRefs;
}

type JsonValue = string | number | boolean | null | JsonObject | readonly JsonValue[];

interface JsonObject {
  readonly [key: string]: JsonValue | undefined;
}

type SettlementPayload = JsonObject;

export function listJeditWscHistoryEvidence(
  store: JeditWscWorkspaceStorePort,
): JeditWscHistoryListingResult {
  const listed = store.listEnvelopes();
  if (listed.status === JEDIT_WSC_WORKSPACE_STORE_OBSTRUCTED) {
    return obstructedFromStore(listed.obstruction);
  }
  const parsed: ParsedEnvelope[] = [];
  for (const envelopeId of listed.envelopeIds) {
    const read = store.readEnvelope(envelopeId);
    if (read.status === JEDIT_WSC_WORKSPACE_STORE_OBSTRUCTED) {
      return obstructedFromStore(read.obstruction);
    }
    parsed.push(parseHistoryEnvelope(read.envelope));
  }
  return {
    status: JEDIT_WSC_HISTORY_LISTED,
    entries: sortedEntries(parsed),
  };
}

export function renderJeditWscHistoryListingLines(
  result: JeditWscHistoryListingResult,
): readonly string[] {
  if (result.status === JEDIT_WSC_HISTORY_LIST_OBSTRUCTED) {
    return [
      'status  code  envelope  message',
      [
        'obstructed',
        result.obstruction.code,
        result.obstruction.envelopeId ?? TEXT_EMPTY,
        result.obstruction.message,
      ].join(TABLE_SEPARATOR),
    ];
  }
  return [
    [
      'seq',
      'submittedAt',
      'event',
      'command',
      'file',
      'basis',
      'submission',
      'outcome',
      'receipt',
      'reading',
      'checkpoint',
      'export',
    ].join(TABLE_SEPARATOR),
    ...result.entries.map(renderHistoryEntryLine),
  ];
}

function sortedEntries(parsed: readonly ParsedEnvelope[]): readonly JeditWscHistoryEntry[] {
  return [...parsed]
    .sort(compareParsedEnvelopes)
    .map((entry, index) => ({
      sequence: index + FIRST_SEQUENCE,
      basisId: entry.envelopeId,
      envelopeId: entry.envelopeId,
      eventKind: entry.eventKind,
      filePath: entry.filePath,
      commandKind: entry.commandKind,
      submittedAtMs: entry.submittedAtMs,
      lineCount: entry.lineCount,
      refs: entry.refs,
    }));
}

function parseHistoryEnvelope(envelope: JeditWscWorkspaceEnvelope): ParsedEnvelope {
  const payload = parsePayload(envelope);
  if (payload == null) {
    return unsupportedEnvelope(envelope.envelopeId, JEDIT_WSC_HISTORY_MALFORMED_ENVELOPE);
  }
  if (payload['schemaVersion'] !== WSC_EDIT_SETTLEMENT_SCHEMA_VERSION) {
    return unsupportedEnvelope(envelope.envelopeId, JEDIT_WSC_HISTORY_UNSUPPORTED_SCHEMA);
  }
  return editSettlementEnvelope(envelope.envelopeId, payload);
}

function editSettlementEnvelope(
  envelopeId: string,
  payload: SettlementPayload,
): ParsedEnvelope {
  const reading = recordValue(payload['reading']);
  const checkpoint = recordValue(payload['checkpoint']);
  const exportRef = recordValue(payload['export']);
  const receiptId = stringValue(payload['receiptId']);
  const readingId = stringValue(reading?.['readingId']);
  const submittedAtMs = finiteNumberValue(payload['submittedAtMs']);
  const checkpointId = firstStringValue(
    payload['checkpointId'],
    checkpoint?.['checkpointId'],
  );
  const exportId = firstStringValue(
    payload['exportEvidenceId'],
    exportRef?.['exportEvidenceId'],
  );
  return {
    envelopeId,
    eventKind: JEDIT_WSC_HISTORY_EVENT_EDIT_SETTLEMENT,
    filePath: stringValue(payload['filePath']),
    commandKind: stringValue(payload['commandKind']),
    submittedAtMs,
    lineCount: finiteNumberValue(reading?.['lineCount']),
    refs: {
      submission: derivedRef(
        `${SUBMISSION_PREFIX}${envelopeId}`,
        JEDIT_WSC_HISTORY_MISSING_SUBMISSION,
      ),
      outcome: receiptId == null
        ? missingRef(JEDIT_WSC_HISTORY_MISSING_OUTCOME)
        : derivedRef(`${OUTCOME_PREFIX}${receiptId}`, JEDIT_WSC_HISTORY_MISSING_OUTCOME),
      receipt: availableOrMissingRef(receiptId, JEDIT_WSC_HISTORY_MISSING_RECEIPT),
      reading: availableOrMissingRef(readingId, JEDIT_WSC_HISTORY_MISSING_READING),
      checkpoint: availableOrMissingRef(checkpointId, JEDIT_WSC_HISTORY_MISSING_CHECKPOINT),
      export: availableOrMissingRef(exportId, JEDIT_WSC_HISTORY_MISSING_EXPORT),
    },
  };
}

function unsupportedEnvelope(envelopeId: string, reason: string): ParsedEnvelope {
  return {
    envelopeId,
    eventKind: JEDIT_WSC_HISTORY_EVENT_UNSUPPORTED_ENVELOPE,
    refs: {
      submission: unsupportedRef(reason),
      outcome: unsupportedRef(reason),
      receipt: unsupportedRef(reason),
      reading: unsupportedRef(reason),
      checkpoint: unsupportedRef(reason),
      export: unsupportedRef(reason),
    },
  };
}

function parsePayload(envelope: JeditWscWorkspaceEnvelope): SettlementPayload | undefined {
  try {
    const parsed = JSON.parse(Buffer.from(envelope.bytes).toString(UTF8_ENCODING));
    return isRecord(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function availableOrMissingRef(
  id: string | undefined,
  missingReason: string,
): JeditWscHistoryEvidenceRef {
  return id == null ? missingRef(missingReason) : {
    status: JEDIT_WSC_HISTORY_EVIDENCE_AVAILABLE,
    id,
  };
}

function derivedRef(id: string, reason: string): JeditWscHistoryEvidenceRef {
  return {
    status: JEDIT_WSC_HISTORY_EVIDENCE_DERIVED,
    id,
    reason,
  };
}

function missingRef(reason: string): JeditWscHistoryEvidenceRef {
  return {
    status: JEDIT_WSC_HISTORY_EVIDENCE_MISSING,
    reason,
  };
}

function unsupportedRef(reason: string): JeditWscHistoryEvidenceRef {
  return {
    status: JEDIT_WSC_HISTORY_EVIDENCE_UNSUPPORTED,
    reason,
  };
}

function renderHistoryEntryLine(entry: JeditWscHistoryEntry): string {
  return [
    String(entry.sequence),
    entry.submittedAtMs == null ? TEXT_EMPTY : String(entry.submittedAtMs),
    entry.eventKind,
    entry.commandKind ?? TEXT_EMPTY,
    entry.filePath ?? TEXT_EMPTY,
    entry.basisId,
    renderEvidenceRef(entry.refs.submission),
    renderEvidenceRef(entry.refs.outcome),
    renderEvidenceRef(entry.refs.receipt),
    renderEvidenceRef(entry.refs.reading),
    renderEvidenceRef(entry.refs.checkpoint),
    renderEvidenceRef(entry.refs.export),
  ].join(TABLE_SEPARATOR);
}

function renderEvidenceRef(ref: JeditWscHistoryEvidenceRef): string {
  if (ref.status === JEDIT_WSC_HISTORY_EVIDENCE_AVAILABLE) {
    return `${AVAILABLE_LABEL}${ref.id ?? TEXT_EMPTY}`;
  }
  if (ref.status === JEDIT_WSC_HISTORY_EVIDENCE_DERIVED) {
    return `${DERIVED_LABEL}${ref.id ?? TEXT_EMPTY}`;
  }
  if (ref.status === JEDIT_WSC_HISTORY_EVIDENCE_UNSUPPORTED) {
    return `${UNSUPPORTED_LABEL}${ref.reason ?? TEXT_EMPTY}`;
  }
  return `${MISSING_LABEL}${ref.reason ?? TEXT_EMPTY}`;
}

function compareParsedEnvelopes(left: ParsedEnvelope, right: ParsedEnvelope): number {
  const leftTime = left.submittedAtMs ?? UNKNOWN_TIME_SORT;
  const rightTime = right.submittedAtMs ?? UNKNOWN_TIME_SORT;
  if (leftTime !== rightTime) {
    return leftTime - rightTime;
  }
  return compareIds(left.envelopeId, right.envelopeId);
}

function compareIds(left: string, right: string): number {
  if (left < right) {
    return ORDER_BEFORE;
  }
  if (left > right) {
    return ORDER_AFTER;
  }
  return 0;
}

function obstructedFromStore(
  obstruction: JeditWscWorkspaceStoreObstruction,
): JeditWscHistoryListObstructed {
  return {
    status: JEDIT_WSC_HISTORY_LIST_OBSTRUCTED,
    obstruction: {
      code: JEDIT_WSC_HISTORY_WSC_STORE_OBSTRUCTED,
      message: obstruction.message,
      envelopeId: obstruction.envelopeId,
    },
  };
}

function firstStringValue(...values: readonly (JsonValue | undefined)[]): string | undefined {
  for (const value of values) {
    const string = stringValue(value);
    if (string != null) {
      return string;
    }
  }
  return undefined;
}

function stringValue(value: JsonValue | undefined): string | undefined {
  return isJsonString(value) && value.length > MIN_NON_EMPTY_STRING_LENGTH ? value : undefined;
}

function finiteNumberValue(value: JsonValue | undefined): number | undefined {
  return isJsonNumber(value) && Number.isFinite(value) ? value : undefined;
}

function recordValue(value: JsonValue | undefined): JsonObject | undefined {
  return isRecord(value) ? value : undefined;
}

function isRecord(value: JsonValue | undefined): value is JsonObject {
  return typeof value === TYPE_TAG_OBJECT && value != null && !Array.isArray(value);
}

function isJsonString(value: JsonValue | undefined): value is string {
  return typeof value === TYPE_TAG_STRING;
}

function isJsonNumber(value: JsonValue | undefined): value is number {
  return typeof value === TYPE_TAG_NUMBER;
}
