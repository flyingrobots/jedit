import { fitLine } from './fit-line.js';
import { formatGraftOutlineLine, graftOutlineScroll } from './workspace-render.js';
import {
  GraftProjectionPostures,
  GraftProjectionSources,
  type GraftEchoTargetIrProjectionLane,
  type GraftEdictProjectionLane,
  type GraftJsonObject,
  type GraftJsonValue,
  type GraftObstructionReceiptProjection,
  type GraftProjectionPanelLane,
  type GraftProjectionPosture,
  type GraftProjectionSource,
} from '../ports/graft-session.js';
import { graftProjectionPanelLanes } from '../ports/graft-projection-lanes.js';
import type { GraftDiagnosticsReport } from '../ports/graft-diagnostics.js';
import type { SourceHighlightReading } from '../ports/source-highlighter.js';

const GRAFT_CHANGE_ROWS = 5;
const GRAFT_RECEIPT_PAYLOAD_ROWS = 3;
const GRAFT_RECEIPT_VALUE_ITEMS = 3;
const GRAFT_RECEIPT_VALUE_DEPTH = 2;
const GRAFT_RECEIPT_VALUE_TEXT = 120;
const COLORFUL_ACTIVE_SUMMARY = 'Colorful prose projection is active.';

export interface GraftDrawerOutlineItem {
  readonly kind: string;
  readonly name: string;
  readonly startLine: number;
}

export interface GraftDrawerInfo {
  readonly path?: string;
  readonly relativePath: string;
  readonly projectionSource?: GraftProjectionSource;
  readonly projectionPosture?: GraftProjectionPosture;
  readonly outlineItems: readonly GraftDrawerOutlineItem[];
  readonly changeLines: readonly string[];
  readonly projectionLanes?: readonly GraftProjectionPanelLane[];
  readonly edictCoreProjection?: GraftEdictProjectionLane;
  readonly echoTargetIrProjection?: GraftEchoTargetIrProjectionLane;
  readonly obstructionReceipt?: GraftObstructionReceiptProjection;
  readonly notice?: string;
  readonly error?: string;
}

export interface GraftDrawerState {
  readonly editor?: object;
  readonly graftInfo?: GraftDrawerInfo;
  readonly graftLoading: boolean;
  readonly graftSelectedIndex: number;
  readonly graftDiagnostics?: GraftDiagnosticsReport;
  readonly sourceHighlight?: SourceHighlightReading;
}

export function renderGraftDrawerLines(model: GraftDrawerState, width: number, height: number): readonly string[] {
  const info = model.graftInfo;
  if (model.editor == null) {
    return fitGraftDrawerLines(['graft', '', 'open a file to inspect it'], width);
  }

  if (info == null) {
    return fitGraftDrawerLines([
      'graft',
      '',
      model.graftLoading ? 'loading...' : 'no graft data loaded',
    ], width);
  }

  return renderLoadedGraftDrawerLines(model, info, width, height);
}

function renderLoadedGraftDrawerLines(
  model: GraftDrawerState,
  info: GraftDrawerInfo,
  width: number,
  height: number,
): readonly string[] {
  const metaLines = [
    'graft',
    info.relativePath,
    `source: ${projectionSourceForInfo(info)}`,
    `posture: ${projectionPostureForInfo(info)}`,
    model.graftLoading ? 'loading...' : (info.notice ?? ''),
    info.error == null ? '' : `error: ${info.error}`,
    ...projectionLaneLines(info),
    ...obstructionReceiptLines(info),
    'outline',
  ];
  const changeLines = ['', 'changes', ...info.changeLines];
  const outlineHeight = Math.max(1, height - metaLines.length - Math.min(GRAFT_CHANGE_ROWS, changeLines.length));
  const outlineStart = graftOutlineScroll(model.graftSelectedIndex, info.outlineItems.length, outlineHeight);
  const outlineLines = info.outlineItems.length === 0
    ? emptyOutlineLines(model, info)
    : info.outlineItems
      .slice(outlineStart, outlineStart + outlineHeight)
      .map((item, index) => formatGraftOutlineLine(item, {
        selected: outlineStart + index === model.graftSelectedIndex,
      }));

  return [
    ...metaLines.map((line) => fitLine(line, width)),
    ...outlineLines.map((line) => fitLine(line, width)),
    ...changeLines.slice(0, Math.max(0, height - metaLines.length - outlineLines.length)).map((line) => fitLine(line, width)),
  ];
}

function fitGraftDrawerLines(lines: readonly string[], width: number): readonly string[] {
  return lines.map((line) => fitLine(line, width));
}

function projectionSourceForInfo(info: GraftDrawerInfo): GraftProjectionSource {
  return info.projectionSource ?? GraftProjectionSources.SavedFile;
}

function projectionPostureForInfo(info: GraftDrawerInfo): GraftProjectionPosture {
  if (info.projectionPosture != null) {
    return info.projectionPosture;
  }
  return info.error == null ? GraftProjectionPostures.Current : GraftProjectionPostures.Obstructed;
}

function projectionLaneLines(info: GraftDrawerInfo): readonly string[] {
  return graftProjectionPanelLanes(info)
    .flatMap(renderProjectionLane);
}

function renderProjectionLane(lane: GraftProjectionPanelLane): readonly string[] {
  return [
    lane.title,
    `state: ${formatReceiptScalar(lane.state)}`,
    ...(lane.digest == null ? [] : [`${lane.digest.label}: ${formatReceiptScalar(lane.digest.value)}`]),
    ...lane.metadata.map((entry) => `${entry.label}: ${formatReceiptScalar(entry.value)}`),
    ...lane.summaryLines.map(formatReceiptScalar),
  ];
}

function obstructionReceiptLines(info: GraftDrawerInfo): readonly string[] {
  const receipt = info.obstructionReceipt;
  if (receipt == null) {
    return [];
  }

  return [
    'receipt',
    `outcome: ${formatReceiptScalar(receipt.outcomeKind)}`,
    `target: ${targetIrReceiptLabel(receipt)}`,
    ...(receipt.reasonKind == null ? [] : [`reason: ${formatReceiptScalar(receipt.reasonKind)}`]),
    ...(receipt.reasonPayload == null ? [] : reasonPayloadLines(receipt.reasonPayload)),
  ];
}

function targetIrReceiptLabel(receipt: GraftObstructionReceiptProjection): string {
  const digest = formatReceiptScalar(receipt.targetIrDigest);
  return receipt.targetIrDomain == null
    ? digest
    : `${formatReceiptScalar(receipt.targetIrDomain)} ${digest}`;
}

function formatReceiptScalar(value: string): string {
  return limitReceiptText(JSON.stringify(value).slice(1, -1));
}

function formatJsonObject(value: GraftJsonObject, childDepth: number): string {
  const keys = sortedJsonObjectKeys(value);
  if (keys.length === 0) {
    return '{}';
  }

  const visibleKeys = keys.slice(0, GRAFT_RECEIPT_VALUE_ITEMS);
  const omittedEntries = keys.length - visibleKeys.length;
  const entries = formatJsonObjectEntries(value, visibleKeys, childDepth);
  return omittedEntries === 0
    ? entries.join(', ')
    : `${entries.join(', ')}, ... ${String(omittedEntries)} more`;
}

function reasonPayloadLines(value: GraftJsonObject): readonly string[] {
  const keys = sortedJsonObjectKeys(value);
  if (keys.length === 0) {
    return ['payload: {}'];
  }
  const visibleKeys = keys.slice(0, GRAFT_RECEIPT_PAYLOAD_ROWS);
  const omittedEntries = keys.length - visibleKeys.length;
  const visibleEntries = formatJsonObjectEntries(value, visibleKeys, 0);
  const visibleLines = visibleEntries.map((entry) => `payload: ${entry}`);
  return omittedEntries === 0
    ? visibleLines
    : [
      ...visibleLines,
      `payload: ... ${String(omittedEntries)} more`,
    ];
}

function sortedJsonObjectKeys(value: GraftJsonObject): readonly string[] {
  return Object.keys(value)
    .sort();
}

function formatJsonObjectEntries(value: GraftJsonObject, keys: readonly string[], childDepth: number): readonly string[] {
  return keys
    .map((key) => `${formatJsonKey(key)}=${formatJsonValue(value[key], childDepth)}`);
}

function formatJsonKey(value: string): string {
  return limitReceiptText(JSON.stringify(value));
}

function formatJsonValue(value: GraftJsonValue | undefined, depth: number): string {
  if (value === undefined || value === null) {
    return 'null';
  }
  if (isJsonArray(value)) {
    return formatJsonArray(value, depth);
  }
  if (isJsonObject(value)) {
    return formatNestedJsonObject(value, depth);
  }
  if (typeof value === 'string') {
    return limitReceiptText(JSON.stringify(value));
  }
  return limitReceiptText(String(value));
}

function formatJsonArray(value: readonly GraftJsonValue[], depth: number): string {
  if (depth >= GRAFT_RECEIPT_VALUE_DEPTH) {
    return '[...]';
  }

  const visibleItems = value.slice(0, GRAFT_RECEIPT_VALUE_ITEMS);
  const omittedItems = value.length - visibleItems.length;
  const entries = visibleItems.map((item) => formatJsonValue(item, depth + 1));
  const text = omittedItems === 0
    ? `[${entries.join(', ')}]`
    : `[${entries.join(', ')}, ... ${String(omittedItems)} more]`;
  return limitReceiptText(text);
}

function formatNestedJsonObject(value: GraftJsonObject, depth: number): string {
  if (depth >= GRAFT_RECEIPT_VALUE_DEPTH) {
    return '{...}';
  }

  const objectText = formatJsonObject(value, depth + 1);
  return objectText === '{}'
    ? objectText
    : limitReceiptText(`{${objectText}}`);
}

function limitReceiptText(value: string): string {
  return value.length <= GRAFT_RECEIPT_VALUE_TEXT
    ? value
    : `${value.slice(0, GRAFT_RECEIPT_VALUE_TEXT)}...`;
}

function isJsonArray(value: GraftJsonValue): value is readonly GraftJsonValue[] {
  return Array.isArray(value);
}

function isJsonObject(value: GraftJsonValue): value is GraftJsonObject {
  return typeof value === 'object' && !Array.isArray(value);
}

function emptyOutlineLines(model: GraftDrawerState, info: GraftDrawerInfo): readonly string[] {
  if (colorfulProseProjectionAvailable(model, info)) {
    return [
      'prose projection active',
      'structural outline unavailable for this file type',
    ];
  }

  return ['structural outline unavailable'];
}

function colorfulProseProjectionAvailable(model: GraftDrawerState, info: GraftDrawerInfo): boolean {
  if (!isPlainTextPath(info.relativePath)) {
    return false;
  }
  if (projectionSourceForInfo(info) === GraftProjectionSources.ColorfulProse) {
    return true;
  }
  if (model.graftDiagnostics?.summary === COLORFUL_ACTIVE_SUMMARY) {
    return true;
  }

  const sourceHighlight = model.sourceHighlight;
  return sourceHighlight != null && sourceHighlight.path === info.path && sourceHighlight.error == null;
}

function isPlainTextPath(filePath: string): boolean {
  return filePath.toLowerCase().endsWith('.txt');
}
