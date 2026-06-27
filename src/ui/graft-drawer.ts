import { fitLine, formatGraftOutlineLine, graftOutlineScroll } from './workspace-render.js';
import {
  GraftProjectionPostures,
  GraftProjectionSources,
  type GraftProjectionPosture,
  type GraftProjectionSource,
} from '../ports/graft-session.js';
import type { GraftDiagnosticsReport } from '../ports/graft-diagnostics.js';
import type { SourceHighlightReading } from '../ports/source-highlighter.js';

const GRAFT_CHANGE_ROWS = 5;
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
