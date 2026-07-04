import { createSurface, stringToSurface, type Surface } from '@flyingrobots/bijou';
import { proseSurface } from '@flyingrobots/bijou-tui';
import {
  GRAFT_DIAGNOSTIC_STATUS,
  type GraftDiagnosticRow,
  type GraftDiagnosticsReport,
  type GraftDiagnosticStatus,
} from '../ports/graft-diagnostics.js';
import {
  JEDIT_MARKDOWN_TOKEN,
  JEDIT_SOURCE_TOKEN,
  type JeditStyleToken,
  type JeditTheme,
} from './jedit-theme.js';
import { fitLine } from './workspace-render.js';

const DIAGNOSTICS_PANEL_MIN_WIDTH = 36;
const DIAGNOSTICS_PANEL_MAX_WIDTH = 58;
const DIAGNOSTICS_PANEL_WIDTH_RATIO = 0.4;
const DIAGNOSTICS_HEADER_ROW = 1;
const DIAGNOSTICS_HINT_ROW = 2;
const DIAGNOSTICS_SUMMARY_ROW = 4;
const DIAGNOSTICS_SUMMARY_ROWS = 2;
const DIAGNOSTICS_FIRST_ROW = 7;
const DIAGNOSTICS_LEFT_PAD = 2;
const DIAGNOSTICS_DETAIL_INDENT = 2;
const DIAGNOSTICS_DETAIL_ROWS = 2;
const DIAGNOSTICS_ROW_HEIGHT = 3;
const DIAGNOSTICS_LABEL_SEPARATOR = ': ';
const DIAGNOSTICS_LOADING_TEXT = 'loading';
const DIAGNOSTICS_FALLBACK_TITLE = 'Graft diagnostics';
const DIAGNOSTICS_FALLBACK_SUMMARY = 'Open diagnostics to inspect Graft and Colorful.';
const DIAGNOSTICS_CLOSE_HINT = 'F2 close · Esc back · Enter refresh';
const DIAGNOSTICS_STATUS_LABEL_OK = 'ok';
const DIAGNOSTICS_STATUS_LABEL_WARNING = 'warn';
const DIAGNOSTICS_STATUS_LABEL_ERROR = 'error';

export interface RenderGraftDiagnosticsPanelOptions {
  readonly report?: GraftDiagnosticsReport;
  readonly loading: boolean;
  readonly theme: JeditTheme;
  readonly width: number;
  readonly height: number;
}

interface PaintProseOptions {
  readonly text: string;
  readonly x: number;
  readonly y: number;
  readonly maxRows: number;
  readonly token: JeditStyleToken;
}

export function resolveGraftDiagnosticsPanelWidth(columns: number): number {
  const boundedColumns = Math.max(DIAGNOSTICS_PANEL_MIN_WIDTH, columns);
  return Math.min(
    Math.max(DIAGNOSTICS_PANEL_MIN_WIDTH, Math.floor(boundedColumns * DIAGNOSTICS_PANEL_WIDTH_RATIO)),
    Math.max(DIAGNOSTICS_PANEL_MIN_WIDTH, boundedColumns - DIAGNOSTICS_LEFT_PAD),
    DIAGNOSTICS_PANEL_MAX_WIDTH,
  );
}

export function renderGraftDiagnosticsPanel(options: RenderGraftDiagnosticsPanelOptions): Surface {
  const surface = createSurface(options.width, options.height);
  fillSurface(surface, options.theme.surface.drawer);
  paintText(surface, panelTitle(options), DIAGNOSTICS_LEFT_PAD, DIAGNOSTICS_HEADER_ROW, titleToken(options));
  paintText(surface, DIAGNOSTICS_CLOSE_HINT, DIAGNOSTICS_LEFT_PAD, DIAGNOSTICS_HINT_ROW, hintToken(options));
  paintProse(surface, {
    text: panelSummary(options),
    x: DIAGNOSTICS_LEFT_PAD,
    y: DIAGNOSTICS_SUMMARY_ROW,
    maxRows: DIAGNOSTICS_SUMMARY_ROWS,
    token: summaryToken(options),
  });
  paintRows(surface, options);
  return surface;
}

function panelTitle(options: RenderGraftDiagnosticsPanelOptions): string {
  return options.report?.title ?? DIAGNOSTICS_FALLBACK_TITLE;
}

function panelSummary(options: RenderGraftDiagnosticsPanelOptions): string {
  if (options.loading) {
    return `${DIAGNOSTICS_LOADING_TEXT} ${options.report?.summary ?? DIAGNOSTICS_FALLBACK_SUMMARY}`;
  }
  return options.report?.summary ?? DIAGNOSTICS_FALLBACK_SUMMARY;
}

function paintRows(surface: Surface, options: RenderGraftDiagnosticsPanelOptions): void {
  const rows = options.report?.rows ?? [];
  rows.forEach((row, index) => paintRow(surface, row, DIAGNOSTICS_FIRST_ROW + (index * DIAGNOSTICS_ROW_HEIGHT), options));
}

function paintRow(
  surface: Surface,
  row: GraftDiagnosticRow,
  y: number,
  options: RenderGraftDiagnosticsPanelOptions,
): void {
  paintText(surface, rowLine(row), DIAGNOSTICS_LEFT_PAD, y, rowToken(options, row.status));
  if (row.detail != null) {
    paintProse(surface, {
      text: row.detail,
      x: DIAGNOSTICS_LEFT_PAD + DIAGNOSTICS_DETAIL_INDENT,
      y: y + 1,
      maxRows: DIAGNOSTICS_DETAIL_ROWS,
      token: hintToken(options),
    });
  }
}

function rowLine(row: GraftDiagnosticRow): string {
  return `${statusLabel(row.status)} ${row.label}${DIAGNOSTICS_LABEL_SEPARATOR}${row.value}`;
}

function statusLabel(status: GraftDiagnosticStatus): string {
  if (status === GRAFT_DIAGNOSTIC_STATUS.Ok) {
    return DIAGNOSTICS_STATUS_LABEL_OK;
  }
  if (status === GRAFT_DIAGNOSTIC_STATUS.Warning) {
    return DIAGNOSTICS_STATUS_LABEL_WARNING;
  }
  return DIAGNOSTICS_STATUS_LABEL_ERROR;
}

function titleToken(options: RenderGraftDiagnosticsPanelOptions): JeditStyleToken {
  return options.theme.markdown.get(JEDIT_MARKDOWN_TOKEN.Heading) ?? drawerToken(options);
}

function summaryToken(options: RenderGraftDiagnosticsPanelOptions): JeditStyleToken {
  return options.theme.markdown.get(JEDIT_MARKDOWN_TOKEN.HeadingSoft) ?? drawerToken(options);
}

function hintToken(options: RenderGraftDiagnosticsPanelOptions): JeditStyleToken {
  return options.theme.source.get(JEDIT_SOURCE_TOKEN.Comment) ?? drawerToken(options);
}

function rowToken(options: RenderGraftDiagnosticsPanelOptions, status: GraftDiagnosticStatus): JeditStyleToken {
  if (status === GRAFT_DIAGNOSTIC_STATUS.Error) {
    return options.theme.cursor.normal;
  }
  return drawerToken(options);
}

function drawerToken(options: RenderGraftDiagnosticsPanelOptions): JeditStyleToken {
  return options.theme.surface.drawer;
}

function paintText(surface: Surface, text: string, x: number, y: number, token: JeditStyleToken): void {
  if (y < 0 || y >= surface.height || x >= surface.width) {
    return;
  }
  const width = Math.max(1, surface.width - x);
  const line = stringToSurface(fitLine(text, width), width, 1);
  applyToken(line, token);
  surface.blit(line, x, y);
}

function paintProse(surface: Surface, options: PaintProseOptions): void {
  if (options.y < 0 || options.y >= surface.height || options.x >= surface.width) {
    return;
  }
  const prose = proseSurface(
    options.text,
    { width: Math.max(1, surface.width - options.x) },
  );
  applyToken(prose, options.token);
  surface.blit(
    prose,
    options.x,
    options.y,
    0,
    0,
    prose.width,
    Math.min(options.maxRows, prose.height),
  );
}

function fillSurface(surface: Surface, token: JeditStyleToken): void {
  surface.fill({
    char: ' ',
    fg: token.fg,
    fgRGB: token.fgRGB,
    bg: token.bg,
    bgRGB: token.bgRGB,
    empty: false,
  });
}

function applyToken(surface: Surface, token: JeditStyleToken): void {
  for (let y = 0; y < surface.height; y += 1) {
    for (let x = 0; x < surface.width; x += 1) {
      const cell = surface.get(x, y);
      surface.set(x, y, {
        ...cell,
        fg: token.fg,
        fgRGB: token.fgRGB,
        bg: token.bg,
        bgRGB: token.bgRGB,
        modifiers: token.modifiers == null ? undefined : [...token.modifiers],
        empty: false,
      });
    }
  }
}
