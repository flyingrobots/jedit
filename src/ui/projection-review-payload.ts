import type { GraftJsonObject, GraftJsonValue } from '../ports/graft-session.js';

const REVIEW_PAYLOAD_HEADER = 'review payload:';
const REVIEW_PAYLOAD_ROW_LIMIT = 12;
const REVIEW_PAYLOAD_DEPTH_LIMIT = 4;
const REVIEW_PAYLOAD_SCALAR_TEXT = 120;
const INDENT_STEP = 2;

interface ReviewPayloadRenderState {
  readonly rows: string[];
  truncated: boolean;
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
  if (depth >= REVIEW_PAYLOAD_DEPTH_LIMIT) {
    appendLine(`${indentText(indent)}{...}`, state);
    return;
  }
  appendLine(`${indentText(indent)}{`, state);
  for (const key of Object.keys(value).sort()) {
    appendJsonProperty(key, value[key], depth + 1, indent + INDENT_STEP, state);
  }
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
    appendLine(`${prefix}[`, state);
    appendJsonArrayEntries(value, depth, indent + INDENT_STEP, state);
    appendLine(`${indentText(indent)}]`, state);
    return;
  }
  if (isJsonObject(value)) {
    appendLine(`${prefix}{`, state);
    appendJsonObjectEntries(value, depth, indent + INDENT_STEP, state);
    appendLine(`${indentText(indent)}}`, state);
    return;
  }
  appendLine(`${prefix}${formatScalar(value)}`, state);
}

function appendJsonArray(value: readonly GraftJsonValue[], depth: number, indent: number, state: ReviewPayloadRenderState): void {
  if (depth >= REVIEW_PAYLOAD_DEPTH_LIMIT) {
    appendLine(`${indentText(indent)}[...]`, state);
    return;
  }
  appendLine(`${indentText(indent)}[`, state);
  appendJsonArrayEntries(value, depth + 1, indent + INDENT_STEP, state);
  appendLine(`${indentText(indent)}]`, state);
}

function appendJsonArrayEntries(
  value: readonly GraftJsonValue[],
  depth: number,
  indent: number,
  state: ReviewPayloadRenderState,
): void {
  for (const item of value) {
    appendJsonValue(item, depth, indent, state);
  }
}

function appendJsonObjectEntries(value: GraftJsonObject, depth: number, indent: number, state: ReviewPayloadRenderState): void {
  for (const key of Object.keys(value).sort()) {
    appendJsonProperty(key, value[key], depth, indent, state);
  }
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
    ? limitReviewText(JSON.stringify(value))
    : limitReviewText(String(value));
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
