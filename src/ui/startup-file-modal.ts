import {
  colorHex,
  createSurface,
  stringToSurface,
  type Surface,
  type TokenValue,
} from "@flyingrobots/bijou";
import {
  browsableListSurface,
  drawer,
  type BrowsableListState,
} from "@flyingrobots/bijou-tui";
import type { FileEntry } from "../ports/file-system.js";
import {
  JEDIT_MARKDOWN_TOKEN,
  JEDIT_SOURCE_TOKEN,
  type JeditStyleToken,
  type JeditTheme,
} from "./jedit-theme.js";
import { fitLine } from "./fit-line.js";
import { formatTreeLine } from "./workspace-render.js";

export interface StartupFileModalRenderRow {
  readonly entry: FileEntry;
}

export interface StartupFileModalCopy {
  readonly title: string;
  readonly currentDirectory: string;
  readonly empty: string;
}

export interface RenderStartupFileModalOptions {
  readonly cwd: string;
  readonly rows: readonly StartupFileModalRenderRow[];
  readonly selectedIndex: number;
  readonly copy: StartupFileModalCopy;
  readonly theme: JeditTheme;
  readonly screenWidth: number;
  readonly screenHeight: number;
  readonly progress: number;
}

const STARTUP_MODAL_FALLBACK_FOREGROUND = "#e2e7ec";
const STARTUP_MODAL_FALLBACK_BACKGROUND = "#0e1116";
const STARTUP_MODAL_MAX_WIDTH = 72;
const STARTUP_MODAL_MIN_WIDTH = 36;
const STARTUP_MODAL_WIDTH_RATIO = 0.62;
const STARTUP_MODAL_BODY_MIN_WIDTH = 1;
const STARTUP_MODAL_BODY_HORIZONTAL_BORDER = 4;
const STARTUP_MODAL_CWD_ROW = 0;
const STARTUP_MODAL_LIST_LABEL_ROW = 2;
const STARTUP_MODAL_FIRST_FILE_ROW = 3;
const STARTUP_MODAL_SCROLLBAR_TRACK_CHAR = "│";
const STARTUP_MODAL_SCROLLBAR_THUMB_CHAR = "█";

export function renderStartupFileDrawer(
  options: RenderStartupFileModalOptions,
): Surface {
  const width = resolveStartupFileDrawerWidth(
    options.screenWidth,
    options.progress,
  );
  if (width <= 0 || options.screenHeight <= 0) {
    return createSurface(width, Math.max(0, options.screenHeight));
  }
  const body = createStartupFileModalBody({
    ...options,
    width: Math.max(
      STARTUP_MODAL_BODY_MIN_WIDTH,
      width - STARTUP_MODAL_BODY_HORIZONTAL_BORDER,
    ),
    height: Math.max(0, options.screenHeight - 2),
  });
  const overlay = drawer({
    anchor: "left",
    title: options.copy.title,
    content: body,
    screenWidth: options.screenWidth,
    screenHeight: options.screenHeight,
    width,
    borderToken: tokenValue(options.theme.chrome.activeEdge),
    bgToken: tokenValue(options.theme.surface.drawer),
  });
  return overlay.surface ?? createSurface(width, options.screenHeight);
}

function resolveStartupFileDrawerWidth(
  screenWidth: number,
  progress: number,
): number {
  return Math.round(
    resolveStartupFileDrawerMaxWidth(screenWidth) * clamp01(progress),
  );
}

function resolveStartupFileDrawerMaxWidth(screenWidth: number): number {
  const ratioWidth = Math.floor(screenWidth * STARTUP_MODAL_WIDTH_RATIO);
  return Math.min(
    STARTUP_MODAL_MAX_WIDTH,
    Math.max(STARTUP_MODAL_MIN_WIDTH, ratioWidth),
  );
}

function createStartupFileModalBody(
  options: RenderStartupFileModalOptions & {
    readonly width: number;
    readonly height: number;
  },
): Surface {
  const surface = createSurface(options.width, options.height);
  fillSurface(surface, options.theme.surface.drawer);
  paintText(
    surface,
    options.cwd,
    STARTUP_MODAL_CWD_ROW,
    options.theme.source.get(JEDIT_SOURCE_TOKEN.Comment) ??
      options.theme.surface.drawer,
  );
  paintText(
    surface,
    options.copy.currentDirectory,
    STARTUP_MODAL_LIST_LABEL_ROW,
    options.theme.markdown.get(JEDIT_MARKDOWN_TOKEN.HeadingSoft) ??
      options.theme.surface.drawer,
  );
  paintRows(surface, options);
  return surface;
}

function paintRows(
  surface: Surface,
  options: RenderStartupFileModalOptions,
): void {
  const visibleRowCount = startupFileVisibleRowCount(surface.height);
  if (options.rows.length === 0) {
    paintText(
      surface,
      options.copy.empty,
      STARTUP_MODAL_FIRST_FILE_ROW,
      options.theme.source.get(JEDIT_SOURCE_TOKEN.Comment) ??
        options.theme.surface.drawer,
    );
    return;
  }
  if (visibleRowCount === 0) {
    return;
  }
  const firstRow = firstVisibleRow(options, visibleRowCount);
  const listSurface = browsableListSurface(
    startupFileListState(options, firstRow, visibleRowCount),
    {
      width: surface.width,
      showScrollbar: options.rows.length > visibleRowCount,
      renderItem: ({ item, focused }) =>
        formatTreeLine(item.value.entry, { selected: focused }),
    },
  );
  applyToken(listSurface, options.theme.surface.drawer);
  applySelectedStartupFileRowToken(listSurface, options, firstRow);
  applyStartupFileScrollbarTokens(listSurface, options.theme);
  surface.blit(listSurface, 0, STARTUP_MODAL_FIRST_FILE_ROW);
}

function firstVisibleRow(
  options: Pick<RenderStartupFileModalOptions, "rows" | "selectedIndex">,
  visibleRowCount: number,
): number {
  const overflow = selectedStartupFileRowIndex(options) - visibleRowCount + 1;
  return Math.max(
    0,
    Math.min(Math.max(0, options.rows.length - visibleRowCount), overflow),
  );
}

function startupFileListState(
  options: Pick<RenderStartupFileModalOptions, "rows" | "selectedIndex">,
  firstRow: number,
  visibleRowCount: number,
): BrowsableListState<StartupFileModalRenderRow> {
  return {
    items: options.rows.map((row) => ({ label: row.entry.name, value: row })),
    focusIndex: selectedStartupFileRowIndex(options),
    scrollY: firstRow,
    height: visibleRowCount,
  };
}

function startupFileVisibleRowCount(height: number): number {
  return Math.max(0, height - STARTUP_MODAL_FIRST_FILE_ROW);
}

function selectedStartupFileRowIndex(
  options: Pick<RenderStartupFileModalOptions, "rows" | "selectedIndex">,
): number {
  return Math.max(
    0,
    Math.min(Math.max(0, options.rows.length - 1), options.selectedIndex),
  );
}

function applySelectedStartupFileRowToken(
  surface: Surface,
  options: Pick<
    RenderStartupFileModalOptions,
    "rows" | "selectedIndex" | "theme"
  >,
  firstRow: number,
): void {
  const selectedRow = selectedStartupFileRowIndex(options) - firstRow;
  if (selectedRow < 0 || selectedRow >= surface.height) {
    return;
  }
  applyRowToken(surface, selectedRow, options.theme.cursor.normal);
}

function applyStartupFileScrollbarTokens(
  surface: Surface,
  theme: JeditTheme,
): void {
  const x = Math.max(0, surface.width - 1);
  for (let y = 0; y < surface.height; y += 1) {
    const cell = surface.get(x, y);
    if (isStartupFileScrollbarChar(cell.char)) {
      surface.set(x, y, {
        ...cell,
        fg: theme.chrome.activeEdge.fg ?? cell.fg,
        fgRGB: theme.chrome.activeEdge.fgRGB ?? cell.fgRGB,
        bg: theme.surface.drawer.bg ?? cell.bg,
        bgRGB: theme.surface.drawer.bgRGB ?? cell.bgRGB,
        modifiers:
          theme.chrome.activeEdge.modifiers == null
            ? cell.modifiers
            : [...theme.chrome.activeEdge.modifiers],
        empty: false,
      });
    }
  }
}

function isStartupFileScrollbarChar(char: string): boolean {
  return (
    char === STARTUP_MODAL_SCROLLBAR_TRACK_CHAR ||
    char === STARTUP_MODAL_SCROLLBAR_THUMB_CHAR
  );
}

function applyRowToken(
  surface: Surface,
  row: number,
  token: JeditStyleToken,
): void {
  for (let x = 0; x < surface.width; x += 1) {
    const cell = surface.get(x, row);
    surface.set(x, row, {
      ...cell,
      fg: token.fg ?? cell.fg,
      fgRGB: token.fgRGB ?? cell.fgRGB,
      bg: token.bg ?? cell.bg,
      bgRGB: token.bgRGB ?? cell.bgRGB,
      modifiers:
        token.modifiers == null ? cell.modifiers : [...token.modifiers],
      empty: false,
    });
  }
}

function paintText(
  surface: Surface,
  text: string,
  y: number,
  token: JeditStyleToken,
): void {
  if (y < 0 || y >= surface.height) {
    return;
  }
  const line = stringToSurface(fitLine(text, surface.width), surface.width, 1);
  applyToken(line, token);
  surface.blit(line, 0, y);
}

function fillSurface(surface: Surface, token: JeditStyleToken): void {
  surface.fill({
    char: " ",
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
        modifiers:
          token.modifiers == null ? cell.modifiers : [...token.modifiers],
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

function clamp01(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
}
