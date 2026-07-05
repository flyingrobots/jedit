import { fitLine } from './fit-line.js';
import { formatGraftOutlineLine, graftOutlineScroll } from './workspace-render.js';
import {
  GraftProjectionPostures,
  GraftProjectionSources,
  type GraftJsonObject,
  type GraftJsonValue,
  type GraftObstructionReceiptProjection,
  type GraftProjectionPosture,
  type GraftProjectionSource,
} from '../ports/graft-session.js';
import type { GraftDiagnosticsReport } from '../ports/graft-diagnostics.js';
import type { SourceHighlightReading } from '../ports/source-highlighter.js';

const GRAFT_CHANGE_ROWS = 5;
const GRAFT_RECEIPT_PAYLOAD_ROWS = 3;
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

function obstructionReceiptLines(info: GraftDrawerInfo): readonly string[] {
  const receipt = info.obstructionReceipt;
  if (receipt == null) {
    return [];
  }

  return [
    'receipt',
    `outcome: ${receipt.outcomeKind}`,
    `target: ${targetIrReceiptLabel(receipt)}`,
    ...(receipt.reasonKind == null ? [] : [`reason: ${receipt.reasonKind}`]),
    ...(receipt.reasonPayload == null ? [] : reasonPayloadLines(receipt.reasonPayload)),
  ];
}

function targetIrReceiptLabel(receipt: GraftObstructionReceiptProjection): string {
  return receipt.targetIrDomain == null
    ? receipt.targetIrDigest
    : `${receipt.targetIrDomain} ${receipt.targetIrDigest}`;
}

function formatJsonObject(value: GraftJsonObject): string {
  const entries = formatJsonObjectEntries(value);
  return entries.length === 0 ? '{}' : entries.join(', ');
}

function reasonPayloadLines(value: GraftJsonObject): readonly string[] {
  const entries = formatJsonObjectEntries(value);
  if (entries.length === 0) {
    return ['payload: {}'];
  }
  const visibleEntries = entries.slice(0, GRAFT_RECEIPT_PAYLOAD_ROWS);
  const omittedEntries = entries.length - visibleEntries.length;
  const visibleLines = visibleEntries.map((entry) => `payload: ${entry}`);
  return omittedEntries === 0
    ? visibleLines
    : [
      ...visibleLines,
      `payload: ... ${String(omittedEntries)} more`,
    ];
}

function formatJsonObjectEntries(value: GraftJsonObject): readonly string[] {
  return Object.keys(value)
    .sort()
    .map((key) => `${key}=${formatJsonValue(value[key])}`);
}

function formatJsonValue(value: GraftJsonValue | undefined): string {
  if (value === undefined || value === null) {
    return 'null';
  }
  if (isJsonArray(value)) {
    return `[${value.map((item) => formatJsonValue(item)).join(', ')}]`;
  }
  if (isJsonObject(value)) {
    const objectText = formatJsonObject(value);
    return objectText === '{}'
      ? objectText
      : `{${objectText}}`;
  }
  return String(value);
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
