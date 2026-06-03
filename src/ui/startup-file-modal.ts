import { colorHex, createSurface, stringToSurface, type Surface, type TokenValue } from '@flyingrobots/bijou';
import { modal, type Overlay } from '@flyingrobots/bijou-tui';
import type { FileEntry } from '../ports/file-system.js';
import { JEDIT_MARKDOWN_TOKEN, JEDIT_SOURCE_TOKEN, type JeditStyleToken, type JeditTheme } from './jedit-theme.js';
import { fitLine, formatTreeLine } from './workspace-render.js';

export interface StartupFileModalRenderRow {
  readonly entry: FileEntry;
}

export interface RenderStartupFileModalOptions {
  readonly cwd: string;
  readonly input: string;
  readonly rows: readonly StartupFileModalRenderRow[];
  readonly selectedIndex: number;
  readonly theme: JeditTheme;
  readonly screenWidth: number;
  readonly screenHeight: number;
}

const STARTUP_MODAL_TITLE = 'Open file';
const STARTUP_MODAL_HINT = 'Type filter · Enter open · Esc close';
const STARTUP_MODAL_INPUT_LABEL = 'Filter';
const STARTUP_MODAL_EMPTY_TEXT = 'No files in this directory';
const STARTUP_MODAL_NO_MATCH_TEXT = 'No files match';
const STARTUP_MODAL_FALLBACK_FOREGROUND = '#e2e7ec';
const STARTUP_MODAL_FALLBACK_BACKGROUND = '#0e1116';
const STARTUP_MODAL_MAX_WIDTH = 72;
const STARTUP_MODAL_MIN_WIDTH = 36;
const STARTUP_MODAL_WIDTH_RATIO = 0.62;
const STARTUP_MODAL_BODY_MIN_WIDTH = 1;
const STARTUP_MODAL_BODY_HORIZONTAL_BORDER = 4;
const STARTUP_MODAL_BODY_HEIGHT = 10;
const STARTUP_MODAL_CWD_ROW = 0;
const STARTUP_MODAL_INPUT_ROW = 1;
const STARTUP_MODAL_LIST_LABEL_ROW = 3;
const STARTUP_MODAL_FIRST_FILE_ROW = 4;
const STARTUP_MODAL_VISIBLE_ROW_COUNT = STARTUP_MODAL_BODY_HEIGHT - STARTUP_MODAL_FIRST_FILE_ROW;

export function renderStartupFileModal(options: RenderStartupFileModalOptions): Overlay {
  const width = resolveStartupFileModalWidth(options.screenWidth);
  const body = createStartupFileModalBody({
    ...options,
    width: Math.max(STARTUP_MODAL_BODY_MIN_WIDTH, width - STARTUP_MODAL_BODY_HORIZONTAL_BORDER),
  });
  return modal({
    title: STARTUP_MODAL_TITLE,
    body,
    hint: STARTUP_MODAL_HINT,
    screenWidth: options.screenWidth,
    screenHeight: options.screenHeight,
    width,
    borderToken: tokenValue(options.theme.chrome.activeEdge),
    bgToken: tokenValue(options.theme.surface.drawer),
  });
}

function resolveStartupFileModalWidth(screenWidth: number): number {
  const ratioWidth = Math.floor(screenWidth * STARTUP_MODAL_WIDTH_RATIO);
  return Math.min(STARTUP_MODAL_MAX_WIDTH, Math.max(STARTUP_MODAL_MIN_WIDTH, ratioWidth));
}

function createStartupFileModalBody(
  options: RenderStartupFileModalOptions & { readonly width: number },
): Surface {
  const surface = createSurface(options.width, STARTUP_MODAL_BODY_HEIGHT);
  fillSurface(surface, options.theme.surface.drawer);
  paintText(surface, options.cwd, STARTUP_MODAL_CWD_ROW, options.theme.source.get(JEDIT_SOURCE_TOKEN.Comment) ?? options.theme.surface.drawer);
  paintText(surface, inputLine(options.input), STARTUP_MODAL_INPUT_ROW, options.theme.cursor.insert);
  paintText(
    surface,
    'Current directory',
    STARTUP_MODAL_LIST_LABEL_ROW,
    options.theme.markdown.get(JEDIT_MARKDOWN_TOKEN.HeadingSoft) ?? options.theme.surface.drawer,
  );
  paintRows(surface, options);
  return surface;
}

function paintRows(
  surface: Surface,
  options: RenderStartupFileModalOptions,
): void {
  if (options.rows.length === 0) {
    paintText(
      surface,
      emptyText(options.input),
      STARTUP_MODAL_FIRST_FILE_ROW,
      options.theme.source.get(JEDIT_SOURCE_TOKEN.Comment) ?? options.theme.surface.drawer,
    );
    return;
  }
  const firstRow = firstVisibleRow(options);
  for (let index = firstRow; index < visibleRowEnd(options.rows.length, firstRow); index += 1) {
    const row = options.rows[index];
    if (row != null) {
      paintStartupFileRow(surface, options, row.entry, index);
    }
  }
}

function paintStartupFileRow(
  surface: Surface,
  options: RenderStartupFileModalOptions,
  entry: FileEntry,
  index: number,
): void {
  const selected = index === options.selectedIndex;
  const token = selected ? options.theme.cursor.normal : options.theme.surface.drawer;
  const row = STARTUP_MODAL_FIRST_FILE_ROW + (index - firstVisibleRow(options));
  paintText(surface, formatTreeLine(entry, { selected }), row, token);
}

function inputLine(input: string): string {
  return `${STARTUP_MODAL_INPUT_LABEL}: ${input}`;
}

function emptyText(input: string): string {
  return input.length === 0 ? STARTUP_MODAL_EMPTY_TEXT : STARTUP_MODAL_NO_MATCH_TEXT;
}

function firstVisibleRow(options: Pick<RenderStartupFileModalOptions, 'rows' | 'selectedIndex'>): number {
  const overflow = options.selectedIndex - STARTUP_MODAL_VISIBLE_ROW_COUNT + 1;
  return Math.max(0, Math.min(Math.max(0, options.rows.length - STARTUP_MODAL_VISIBLE_ROW_COUNT), overflow));
}

function visibleRowEnd(total: number, firstRow: number): number {
  return Math.min(total, firstRow + STARTUP_MODAL_VISIBLE_ROW_COUNT);
}

function paintText(surface: Surface, text: string, y: number, token: JeditStyleToken): void {
  const line = stringToSurface(fitLine(text, surface.width), surface.width, 1);
  applyToken(line, token);
  surface.blit(line, 0, y);
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
        fg: token.fg ?? cell.fg,
        fgRGB: token.fgRGB ?? cell.fgRGB,
        bg: token.bg ?? cell.bg,
        bgRGB: token.bgRGB ?? cell.bgRGB,
        modifiers: token.modifiers == null ? cell.modifiers : [...token.modifiers],
        empty: false,
      });
    }
  }
}

function tokenValue(token: JeditStyleToken): TokenValue {
  return {
    hex: colorHex(token.fg) ?? token.hex ?? STARTUP_MODAL_FALLBACK_FOREGROUND,
    bg: colorHex(token.bg) ?? STARTUP_MODAL_FALLBACK_BACKGROUND,
  };
}
