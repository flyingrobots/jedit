import {
  JEDIT_WSC_HISTORY_REPLAY_MATCH,
  JEDIT_WSC_HISTORY_REPLAY_MISMATCH,
  JEDIT_WSC_HISTORY_REPLAY_OBSTRUCTED,
  JEDIT_WSC_REPLAY_MALFORMED_ENVELOPE,
  JEDIT_WSC_REPLAY_SCHEDULER_LOCAL_ORDERED_SETTLEMENT,
  JEDIT_WSC_REPLAY_UNSUPPORTED_SCHEMA,
  JEDIT_WSC_REPLAY_WSC_STORE_OBSTRUCTED,
  type JeditWscHistoryReplayEntryIdentity,
  type JeditWscHistoryReplayIdentity,
  type JeditWscHistoryReplayInput,
  type JeditWscHistoryReplayMismatchDetail,
  type JeditWscHistoryReplayObstructed,
  type JeditWscHistoryReplayObstruction,
  type JeditWscHistoryReplayResult,
} from '../ports/jedit-wsc-history-replay.js';
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

const WALL_CLOCK_CADENCE_IS_SEMANTIC = false;
const DIAGNOSTIC_PROSE_IS_SEMANTIC = false;
const TYPE_TAG_STRING = 'string';
const TYPE_TAG_NUMBER = 'number';
const TYPE_TAG_BOOLEAN = 'boolean';
const TYPE_TAG_OBJECT = 'object';
const MIN_NON_EMPTY_STRING_LENGTH = 0;
const EMPTY_INSERT_TEXT = '';
const DEFAULT_BOOLEAN = false;
const DEFAULT_NUMBER = 0;
const ORDER_BEFORE = -1;
const ORDER_AFTER = 1;
const PATH_ENTRY_COUNT = 'entries.length';
const PATH_ENTRY_PREFIX = 'entries';
const FIELD_SEPARATOR = '.';

type JsonValue = string | number | boolean | null | JsonObject | readonly JsonValue[];

interface JsonObject {
  readonly [key: string]: JsonValue | undefined;
}

interface ParsedReplayEntry {
  readonly identity?: JeditWscHistoryReplayEntryIdentity;
  readonly obstruction?: JeditWscHistoryReplayObstruction;
}

interface ReplayField {
  readonly name: keyof JeditWscHistoryReplayEntryIdentity;
  read(entry: JeditWscHistoryReplayEntryIdentity): string;
}

const REPLAY_FIELDS: readonly ReplayField[] = Object.freeze([
  replayField('filePath'),
  replayField('bufferId'),
  replayField('commandKind'),
  replayField('rangeStartByte'),
  replayField('rangeEndByte'),
  replayField('rangeInsertText'),
  replayField('receiptId'),
  replayField('readingId'),
  replayField('readingLines'),
  replayField('readingLineCount'),
  replayField('readingCursorLine'),
  replayField('readingViewportLineCount'),
  replayField('readingTruncated'),
  replayField('apertureCursorLine'),
  replayField('apertureViewportLineCount'),
  replayField('apertureBeforeLines'),
  replayField('apertureAfterLines'),
  replayField('apertureMaxBytes'),
]);

export function proveJeditWscHistoryReplay(
  input: JeditWscHistoryReplayInput,
): JeditWscHistoryReplayResult {
  const first = replayIdentityFromStore(input.firstStore);
  if ('obstruction' in first) {
    return replayObstructed(first.obstruction);
  }
  const second = replayIdentityFromStore(input.secondStore);
  if ('obstruction' in second) {
    return replayObstructed(second.obstruction);
  }
  const mismatch = firstReplayMismatch(first, second);
  if (mismatch == null) {
    return {
      status: JEDIT_WSC_HISTORY_REPLAY_MATCH,
      first,
      second,
      wallClockCadenceSemantic: WALL_CLOCK_CADENCE_IS_SEMANTIC,
      diagnosticProseSemantic: DIAGNOSTIC_PROSE_IS_SEMANTIC,
    };
  }
  return {
    status: JEDIT_WSC_HISTORY_REPLAY_MISMATCH,
    first,
    second,
    mismatch,
    wallClockCadenceSemantic: WALL_CLOCK_CADENCE_IS_SEMANTIC,
    diagnosticProseSemantic: DIAGNOSTIC_PROSE_IS_SEMANTIC,
  };
}

function replayIdentityFromStore(
  store: JeditWscWorkspaceStorePort,
): JeditWscHistoryReplayIdentity | JeditWscHistoryReplayObstructed {
  const listed = store.listEnvelopes();
  if (listed.status === JEDIT_WSC_WORKSPACE_STORE_OBSTRUCTED) {
    return replayObstructed(storeObstruction(listed.obstruction));
  }
  const entries: JeditWscHistoryReplayEntryIdentity[] = [];
  for (const envelopeId of listed.envelopeIds) {
    const read = store.readEnvelope(envelopeId);
    if (read.status === JEDIT_WSC_WORKSPACE_STORE_OBSTRUCTED) {
      return replayObstructed(storeObstruction(read.obstruction));
    }
    const parsed = parseReplayEntry(read.envelope);
    if (parsed.obstruction != null) {
      return replayObstructed(parsed.obstruction);
    }
    if (parsed.identity == null) {
      return replayObstructed(envelopeObstruction(JEDIT_WSC_REPLAY_MALFORMED_ENVELOPE, read.envelope.envelopeId));
    }
    entries.push(parsed.identity);
  }
  return {
    schedulerPolicy: JEDIT_WSC_REPLAY_SCHEDULER_LOCAL_ORDERED_SETTLEMENT,
    entries: entries.sort(compareReplayEntries),
  };
}

function parseReplayEntry(envelope: JeditWscWorkspaceEnvelope): ParsedReplayEntry {
  const payload = parsePayload(envelope);
  if (payload == null) {
    return { obstruction: envelopeObstruction(JEDIT_WSC_REPLAY_MALFORMED_ENVELOPE, envelope.envelopeId) };
  }
  if (payload['schemaVersion'] !== WSC_EDIT_SETTLEMENT_SCHEMA_VERSION) {
    return { obstruction: envelopeObstruction(JEDIT_WSC_REPLAY_UNSUPPORTED_SCHEMA, envelope.envelopeId) };
  }
  const range = recordValue(payload['range']);
  const reading = recordValue(payload['reading']);
  const aperture = recordValue(payload['aperture']);
  return {
    identity: {
      filePath: stringValue(payload['filePath']),
      bufferId: stringValue(payload['bufferId']),
      commandKind: stringValue(payload['commandKind']),
      rangeStartByte: numberValue(range?.['startByte']),
      rangeEndByte: numberValue(range?.['endByte']),
      rangeInsertText: stringValue(range?.['insertText'], EMPTY_INSERT_TEXT),
      receiptId: stringValue(payload['receiptId']),
      readingId: stringValue(reading?.['readingId']),
      readingLines: readingLines(reading),
      readingLineCount: numberValue(reading?.['lineCount']),
      readingCursorLine: numberValue(reading?.['cursorLine']),
      readingViewportLineCount: numberValue(reading?.['viewportLineCount']),
      readingTruncated: booleanValue(reading?.['truncated']),
      apertureCursorLine: numberValue(aperture?.['cursorLine']),
      apertureViewportLineCount: numberValue(aperture?.['viewportLineCount']),
      apertureBeforeLines: numberValue(aperture?.['beforeLines']),
      apertureAfterLines: numberValue(aperture?.['afterLines']),
      apertureMaxBytes: numberValue(aperture?.['maxBytes']),
    },
  };
}

function parsePayload(envelope: JeditWscWorkspaceEnvelope): JsonObject | undefined {
  try {
    const parsed = JSON.parse(Buffer.from(envelope.bytes).toString(UTF8_ENCODING));
    return isJsonObject(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function readingLines(reading: JsonObject | undefined): readonly string[] {
  const lines = arrayValue(reading?.['lines']);
  if (lines == null) {
    return [];
  }
  return lines.filter(isJsonString);
}

function firstReplayMismatch(
  first: JeditWscHistoryReplayIdentity,
  second: JeditWscHistoryReplayIdentity,
): JeditWscHistoryReplayMismatchDetail | undefined {
  if (first.entries.length !== second.entries.length) {
    return {
      path: PATH_ENTRY_COUNT,
      firstValue: String(first.entries.length),
      secondValue: String(second.entries.length),
    };
  }
  for (const [index, firstEntry] of first.entries.entries()) {
    const secondEntry = second.entries[index];
    if (secondEntry == null) {
      return {
        path: PATH_ENTRY_COUNT,
        firstValue: String(first.entries.length),
        secondValue: String(second.entries.length),
      };
    }
    const mismatch = firstEntryMismatch(index, firstEntry, secondEntry);
    if (mismatch != null) {
      return mismatch;
    }
  }
  return undefined;
}

function firstEntryMismatch(
  index: number,
  first: JeditWscHistoryReplayEntryIdentity,
  second: JeditWscHistoryReplayEntryIdentity,
): JeditWscHistoryReplayMismatchDetail | undefined {
  for (const field of REPLAY_FIELDS) {
    const firstValue = field.read(first);
    const secondValue = field.read(second);
    if (firstValue !== secondValue) {
      return {
        path: `${PATH_ENTRY_PREFIX}[${String(index)}]${FIELD_SEPARATOR}${String(field.name)}`,
        firstValue,
        secondValue,
      };
    }
  }
  return undefined;
}

function compareReplayEntries(
  left: JeditWscHistoryReplayEntryIdentity,
  right: JeditWscHistoryReplayEntryIdentity,
): number {
  return compareStrings(entrySortKey(left), entrySortKey(right));
}

function entrySortKey(entry: JeditWscHistoryReplayEntryIdentity): string {
  return REPLAY_FIELDS.map((field) => field.read(entry)).join(FIELD_SEPARATOR);
}

function compareStrings(left: string, right: string): number {
  if (left < right) {
    return ORDER_BEFORE;
  }
  if (left > right) {
    return ORDER_AFTER;
  }
  return DEFAULT_NUMBER;
}

function replayField(
  name: keyof JeditWscHistoryReplayEntryIdentity,
): ReplayField {
  return {
    name,
    read(entry) {
      const value = entry[name];
      return Array.isArray(value) ? JSON.stringify(value) : String(value);
    },
  };
}

function replayObstructed(
  obstruction: JeditWscHistoryReplayObstruction,
): JeditWscHistoryReplayObstructed {
  return {
    status: JEDIT_WSC_HISTORY_REPLAY_OBSTRUCTED,
    obstruction,
    wallClockCadenceSemantic: WALL_CLOCK_CADENCE_IS_SEMANTIC,
    diagnosticProseSemantic: DIAGNOSTIC_PROSE_IS_SEMANTIC,
  };
}

function storeObstruction(
  obstruction: JeditWscWorkspaceStoreObstruction,
): JeditWscHistoryReplayObstruction {
  return {
    code: JEDIT_WSC_REPLAY_WSC_STORE_OBSTRUCTED,
    message: obstruction.message,
    envelopeId: obstruction.envelopeId,
  };
}

function envelopeObstruction(
  code: string,
  envelopeId: string,
): JeditWscHistoryReplayObstruction {
  return {
    code,
    message: `${code}: ${envelopeId}`,
    envelopeId,
  };
}

function stringValue(value: JsonValue | undefined, fallback = ''): string {
  return isJsonString(value) && value.length > MIN_NON_EMPTY_STRING_LENGTH ? value : fallback;
}

function numberValue(value: JsonValue | undefined): number {
  return isJsonNumber(value) && Number.isFinite(value) ? value : DEFAULT_NUMBER;
}

function booleanValue(value: JsonValue | undefined): boolean {
  return isJsonBoolean(value) ? value : DEFAULT_BOOLEAN;
}

function recordValue(value: JsonValue | undefined): JsonObject | undefined {
  return isJsonObject(value) ? value : undefined;
}

function arrayValue(value: JsonValue | undefined): readonly JsonValue[] | undefined {
  return Array.isArray(value) ? value : undefined;
}

function isJsonString(value: JsonValue | undefined): value is string {
  return typeof value === TYPE_TAG_STRING;
}

function isJsonNumber(value: JsonValue | undefined): value is number {
  return typeof value === TYPE_TAG_NUMBER;
}

function isJsonBoolean(value: JsonValue | undefined): value is boolean {
  return typeof value === TYPE_TAG_BOOLEAN;
}

function isJsonObject(value: JsonValue | undefined): value is JsonObject {
  return typeof value === TYPE_TAG_OBJECT && value != null && !Array.isArray(value);
}
