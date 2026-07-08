import type { GraftJsonObject, GraftJsonValue } from '../ports/graft-session.js';
import {
  REVIEW_PAYLOAD_DEPTH_LIMIT,
  REVIEW_PAYLOAD_ENTRY_LIMIT,
  REVIEW_PAYLOAD_OBJECT_KEY_SCAN_LIMIT,
} from '../ports/graft-review-payload-limits.js';

const REVIEW_PAYLOAD_HEADER = 'review payload:';
const REVIEW_PAYLOAD_ROW_LIMIT = 12;
const REVIEW_PAYLOAD_SCALAR_TEXT = 120;
const REVIEW_PAYLOAD_STRING_RAW_TEXT = 96;
const INDENT_STEP = 2;
const OBJECT_HAS_OWN = Object.prototype.hasOwnProperty;

interface ReviewPayloadRenderState {
  readonly rows: string[];
  truncated: boolean;
}

interface ReviewPayloadObjectKeys {
  readonly visibleKeys: readonly string[];
  readonly omittedCount: number;
  readonly omittedIsLowerBound: boolean;
}

export function projectionReviewPayloadLines(payload: GraftJsonObject): readonly string[] {
  const state: ReviewPayloadRenderState = { rows: [], truncated: false };
  appendJsonValue(payload, 0, 0, state);
  return [
    REVIEW_PAYLOAD_HEADER,
    ...state.rows,
    ...(state.truncated ? [`[review payload truncated at ${String(REVIEW_PAYLOAD_ROW_LIMIT)} rows]`] : []),
  ];
}

export function projectionReviewPayloadLineCount(payload: GraftJsonObject): number {
  return projectionReviewPayloadLines(payload).length;
}

function appendJsonValue(value: GraftJsonValue, depth: number, indent: number, state: ReviewPayloadRenderState): void {
  if (isJsonArray(value)) {
    appendJsonArray(value, depth, indent, state);
    return;
  }
  if (isJsonObject(value)) {
    appendJsonObject(value, depth, indent, state);
    return;
  }
  appendLine(`${indentText(indent)}${formatScalar(value)}`, state);
}

function appendJsonObject(value: GraftJsonObject, depth: number, indent: number, state: ReviewPayloadRenderState): void {
  appendJsonObjectBlock(value, depth, indent, indentText(indent), state);
}

function appendJsonObjectBlock(
  value: GraftJsonObject,
  depth: number,
  indent: number,
  prefix: string,
  state: ReviewPayloadRenderState,
): void {
  if (depth >= REVIEW_PAYLOAD_DEPTH_LIMIT) {
    appendLine(`${prefix}{...}`, state);
    return;
  }
  appendLine(`${prefix}{`, state);
  appendJsonObjectEntries(value, depth + 1, indent + INDENT_STEP, state);
  appendLine(`${indentText(indent)}}`, state);
}

function appendJsonProperty(
  key: string,
  value: GraftJsonValue | undefined,
  depth: number,
  indent: number,
  state: ReviewPayloadRenderState,
): void {
  const prefix = `${indentText(indent)}${JSON.stringify(key)}: `;
  if (value === undefined) {
    appendLine(`${prefix}null`, state);
    return;
  }
  if (isJsonArray(value)) {
    appendJsonArrayBlock(value, depth, indent, prefix, state);
    return;
  }
  if (isJsonObject(value)) {
    appendJsonObjectBlock(value, depth, indent, prefix, state);
    return;
  }
  appendLine(`${prefix}${formatScalar(value)}`, state);
}

function appendJsonArray(value: readonly GraftJsonValue[], depth: number, indent: number, state: ReviewPayloadRenderState): void {
  appendJsonArrayBlock(value, depth, indent, indentText(indent), state);
}

function appendJsonArrayBlock(
  value: readonly GraftJsonValue[],
  depth: number,
  indent: number,
  prefix: string,
  state: ReviewPayloadRenderState,
): void {
  if (depth >= REVIEW_PAYLOAD_DEPTH_LIMIT) {
    appendLine(`${prefix}[...]`, state);
    return;
  }
  appendLine(`${prefix}[`, state);
  appendJsonArrayEntries(value, depth + 1, indent + INDENT_STEP, state);
  appendLine(`${indentText(indent)}]`, state);
}

function appendJsonArrayEntries(
  value: readonly GraftJsonValue[],
  depth: number,
  indent: number,
  state: ReviewPayloadRenderState,
): void {
  const visibleItems = value.slice(0, REVIEW_PAYLOAD_ENTRY_LIMIT);
  for (const item of visibleItems) {
    if (state.truncated) {
      return;
    }
    appendJsonValue(item, depth, indent, state);
  }
  appendOmittedLine(value.length - visibleItems.length, 'items', indent, state);
}

function appendJsonObjectEntries(value: GraftJsonObject, depth: number, indent: number, state: ReviewPayloadRenderState): void {
  const keys = reviewPayloadObjectKeys(value);
  for (const key of keys.visibleKeys) {
    if (state.truncated) {
      return;
    }
    appendJsonProperty(key, value[key], depth, indent, state);
  }
  appendOmittedEntriesLine(keys, indent, state);
}

function reviewPayloadObjectKeys(value: GraftJsonObject): ReviewPayloadObjectKeys {
  const keys: string[] = [];
  let omittedIsLowerBound = false;
  let examinedKeyCount = 0;
  for (const key in value) {
    if (examinedKeyCount >= REVIEW_PAYLOAD_OBJECT_KEY_SCAN_LIMIT) {
      omittedIsLowerBound = true;
      break;
    }
    examinedKeyCount += 1;
    if (!OBJECT_HAS_OWN.call(value, key)) {
      continue;
    }
    keys.push(key);
  }
  keys.sort();
  const visibleKeys = keys.slice(0, REVIEW_PAYLOAD_ENTRY_LIMIT);
  return {
    visibleKeys,
    omittedCount: keys.length - visibleKeys.length + (omittedIsLowerBound ? 1 : 0),
    omittedIsLowerBound,
  };
}

function appendOmittedLine(omittedCount: number, noun: string, indent: number, state: ReviewPayloadRenderState): void {
  if (omittedCount > 0) {
    appendLine(`${indentText(indent)}... ${String(omittedCount)} more ${noun}`, state);
  }
}

function appendOmittedEntriesLine(
  keys: ReviewPayloadObjectKeys,
  indent: number,
  state: ReviewPayloadRenderState,
): void {
  if (keys.omittedCount === 0) {
    return;
  }
  const count = keys.omittedIsLowerBound
    ? `at least ${String(keys.omittedCount)}`
    : String(keys.omittedCount);
  appendLine(`${indentText(indent)}... ${count} more entries`, state);
}

function appendLine(line: string, state: ReviewPayloadRenderState): void {
  if (state.rows.length >= REVIEW_PAYLOAD_ROW_LIMIT) {
    state.truncated = true;
    return;
  }
  state.rows.push(limitReviewText(line));
}

function formatScalar(value: GraftJsonValue): string {
  return typeof value === 'string'
    ? limitReviewText(JSON.stringify(limitReviewString(value)))
    : limitReviewText(String(value));
}

function limitReviewString(value: string): string {
  return value.length <= REVIEW_PAYLOAD_STRING_RAW_TEXT
    ? value
    : `${value.slice(0, REVIEW_PAYLOAD_STRING_RAW_TEXT)}...`;
}

function limitReviewText(value: string): string {
  return value.length <= REVIEW_PAYLOAD_SCALAR_TEXT
    ? value
    : `${value.slice(0, REVIEW_PAYLOAD_SCALAR_TEXT)}...`;
}

function indentText(indent: number): string {
  return ' '.repeat(indent);
}

function isJsonArray(value: GraftJsonValue): value is readonly GraftJsonValue[] {
  return Array.isArray(value);
}

function isJsonObject(value: GraftJsonValue): value is GraftJsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
