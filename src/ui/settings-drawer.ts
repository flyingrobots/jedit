import {
  colorHex,
  createSurface,
  stringToSurface,
  type Surface,
  type TokenValue,
} from '@flyingrobots/bijou';
import { drawer } from '@flyingrobots/bijou-tui';
import type { JeditSettingsRow } from '../app/settings-session.js';
import { JEDIT_SETTING_ROW_KIND } from '../app/settings-session.js';
import { JEDIT_SETTINGS_CLOSE_LABEL, JEDIT_SETTINGS_TOGGLE_LABEL } from '../app/keybindings.js';
import { JEDIT_MARKDOWN_TOKEN, JEDIT_SOURCE_TOKEN, type JeditStyleToken, type JeditTheme } from './jedit-theme.js';
import { fitLine } from './fit-line.js';

const SETTINGS_DRAWER_MIN_WIDTH = 28;
const SETTINGS_DRAWER_MAX_WIDTH = 42;
const SETTINGS_DRAWER_WIDTH_RATIO = 0.3;
const SETTINGS_HINT_ROW = 1;
const SETTINGS_FIRST_ROW = 3;
const SETTINGS_LEFT_PAD = 0;
const SETTINGS_ROW_GAP = 1;
const SETTINGS_ROW_HEIGHT = 2;
const SETTINGS_SELECTED_MARK = '›';
const SETTINGS_UNSELECTED_MARK = ' ';
const SETTINGS_CHOICE_MARK = '↻';
const SETTINGS_OPTION_SELECTED_MARK = '[x]';
const SETTINGS_OPTION_MARK = '[ ]';
const SETTINGS_CHECKED_MARK = '☑';
const SETTINGS_UNCHECKED_MARK = '☐';
const SETTINGS_CLOSE_HINT = `${JEDIT_SETTINGS_TOGGLE_LABEL.toUpperCase()}/Esc/${JEDIT_SETTINGS_CLOSE_LABEL} close`;
const SETTINGS_TITLE = 'Settings';
const SETTINGS_FALLBACK_FOREGROUND = '#e2e7ec';
const SETTINGS_FALLBACK_BACKGROUND = '#0e1116';
const SETTINGS_BODY_HORIZONTAL_BORDER = 4;
const SETTINGS_BODY_VERTICAL_BORDER = 2;
const SETTINGS_FALLBACK_CONTENT_X = 2;
const SETTINGS_FALLBACK_CONTENT_Y = 1;

export interface RenderSettingsDrawerOptions {
  readonly rows: readonly JeditSettingsRow[];
  readonly selectedIndex: number;
  readonly theme: JeditTheme;
  readonly width: number;
  readonly height: number;
}

interface PaintSettingsRowOptions {
  readonly row: JeditSettingsRow;
  readonly selected: boolean;
  readonly x: number;
  readonly y: number;
  readonly theme: JeditTheme;
}

interface SettingsRowLayout {
  readonly index: number;
  readonly row: JeditSettingsRow;
  readonly section?: string;
  readonly sectionY?: number;
  readonly rowY: number;
}

export function resolveSettingsDrawerWidth(columns: number): number {
  const boundedColumns = Math.max(SETTINGS_DRAWER_MIN_WIDTH, columns);
  return Math.min(
    Math.max(SETTINGS_DRAWER_MIN_WIDTH, Math.floor(boundedColumns * SETTINGS_DRAWER_WIDTH_RATIO)),
    Math.max(SETTINGS_DRAWER_MIN_WIDTH, boundedColumns - SETTINGS_LEFT_PAD),
    SETTINGS_DRAWER_MAX_WIDTH,
  );
}

export function renderSettingsDrawer(options: RenderSettingsDrawerOptions): Surface {
  if (options.width <= 0 || options.height <= 0) {
    return createSurface(Math.max(0, options.width), Math.max(0, options.height));
  }
  const content = renderSettingsDrawerBody({
    ...options,
    width: Math.max(1, options.width - SETTINGS_BODY_HORIZONTAL_BORDER),
    height: Math.max(0, options.height - SETTINGS_BODY_VERTICAL_BORDER),
  });
  const overlay = drawer({
    anchor: 'left',
    title: SETTINGS_TITLE,
    content,
    screenWidth: options.width,
    screenHeight: options.height,
    width: options.width,
    borderToken: tokenValue(options.theme.chrome.activeEdge),
    bgToken: tokenValue(options.theme.surface.drawer),
  });
  return overlay.surface ?? renderSettingsDrawerFallback(options, content);
}

function renderSettingsDrawerFallback(options: RenderSettingsDrawerOptions, content: Surface): Surface {
  const surface = createSurface(options.width, options.height);
  fillSurface(surface, options.theme.surface.drawer);
  surface.blit(content, SETTINGS_FALLBACK_CONTENT_X, SETTINGS_FALLBACK_CONTENT_Y);
  return surface;
}

function renderSettingsDrawerBody(options: RenderSettingsDrawerOptions): Surface {
  const surface = createSurface(options.width, options.height);
  fillSurface(surface, options.theme.surface.drawer);
  paintText(surface, SETTINGS_CLOSE_HINT, SETTINGS_LEFT_PAD, SETTINGS_HINT_ROW, settingsHintToken(options));
  const firstVisibleRow = firstVisibleSettingsRow(options.rows, options.selectedIndex, options.height);
  for (const layout of settingsRowLayouts(options.rows, firstVisibleRow)) {
    if (layout.section != null && layout.sectionY != null) {
      paintText(
        surface,
        layout.section,
        SETTINGS_LEFT_PAD,
        layout.sectionY,
        settingsDrawerTextToken(
          options.theme,
          options.theme.markdown.get(JEDIT_MARKDOWN_TOKEN.HeadingSoft) ?? options.theme.surface.drawer,
        ),
      );
    }
    paintSettingsRow(surface, {
      row: layout.row,
      selected: layout.index === options.selectedIndex,
      x: SETTINGS_LEFT_PAD,
      y: layout.rowY,
      theme: options.theme,
    });
    if (layout.rowY >= options.height) {
      break;
    }
  }
  return surface;
}

function paintSettingsRow(surface: Surface, options: PaintSettingsRowOptions): void {
  if (options.y >= surface.height) {
    return;
  }
  const label = fitLine(settingsRowLabel(options), Math.max(1, surface.width - options.x));
  const labelToken = options.selected
    ? options.theme.cursor.normal
    : options.theme.surface.drawer;
  paintText(surface, label, options.x, options.y, labelToken);

  if (options.y + 1 < surface.height) {
    const descriptionToken = settingsDrawerTextToken(
      options.theme,
      options.theme.source.get(JEDIT_SOURCE_TOKEN.Comment) ?? options.theme.surface.drawer,
    );
    paintText(surface, `  ${options.row.description}`, options.x, options.y + 1, descriptionToken);
  }
}

function settingsHintToken(options: RenderSettingsDrawerOptions): JeditStyleToken {
  return settingsDrawerTextToken(
    options.theme,
    options.theme.source.get(JEDIT_SOURCE_TOKEN.Comment) ?? options.theme.surface.drawer,
  );
}

function settingsDrawerTextToken(
  theme: JeditTheme,
  foreground: JeditStyleToken,
): JeditStyleToken {
  return {
    ...foreground,
    bg: theme.surface.drawer.bg,
    bgRGB: theme.surface.drawer.bgRGB,
  };
}

function settingsRowLabel(options: PaintSettingsRowOptions): string {
  const mark = options.selected ? SETTINGS_SELECTED_MARK : SETTINGS_UNSELECTED_MARK;
  const value = options.row.valueLabel.length > 0 ? ` ${options.row.valueLabel}` : '';
  return `${mark} ${rowMark(options.row)} ${options.row.label}${value}`;
}

function rowMark(row: JeditSettingsRow): string {
  if (row.kind === JEDIT_SETTING_ROW_KIND.Choice) {
    return SETTINGS_CHOICE_MARK;
  }
  if (row.kind === JEDIT_SETTING_ROW_KIND.Option) {
    return row.checked === true ? SETTINGS_OPTION_SELECTED_MARK : SETTINGS_OPTION_MARK;
  }
  return row.checked === true ? SETTINGS_CHECKED_MARK : SETTINGS_UNCHECKED_MARK;
}

function firstVisibleSettingsRow(
  rows: readonly JeditSettingsRow[],
  selectedIndex: number,
  height: number,
): number {
  const selected = clampedSettingsRowIndex(rows, selectedIndex);
  let first = selected;
  while (first > 0 && selectedSettingsRowFits(rows, first - 1, selected, height)) {
    first -= 1;
  }
  return first;
}

function clampedSettingsRowIndex(rows: readonly JeditSettingsRow[], selectedIndex: number): number {
  return Math.max(0, Math.min(selectedIndex, rows.length - 1));
}

function selectedSettingsRowFits(
  rows: readonly JeditSettingsRow[],
  firstIndex: number,
  selectedIndex: number,
  height: number,
): boolean {
  return selectedSettingsRowBottom(rows, firstIndex, selectedIndex) <= height;
}

function selectedSettingsRowBottom(
  rows: readonly JeditSettingsRow[],
  firstIndex: number,
  selectedIndex: number,
): number {
  const selectedLayout = settingsRowLayouts(rows, firstIndex, selectedIndex)
    .find((layout) => layout.index === selectedIndex);
  return selectedLayout == null ? SETTINGS_FIRST_ROW : selectedLayout.rowY + SETTINGS_ROW_HEIGHT;
}

function settingsRowLayouts(
  rows: readonly JeditSettingsRow[],
  firstIndex: number,
  lastIndex = rows.length - 1,
): readonly SettingsRowLayout[] {
  const layouts: SettingsRowLayout[] = [];
  let y = SETTINGS_FIRST_ROW;
  let section = '';
  for (let index = firstIndex; index < rows.length && index <= lastIndex; index += 1) {
    const row = rows[index];
    if (row == null) {
      continue;
    }
    let sectionY: number | undefined;
    let sectionTitle: string | undefined;
    if (row.section !== section) {
      section = row.section;
      sectionTitle = section;
      sectionY = y;
      y += SETTINGS_ROW_GAP;
    }
    layouts.push(sectionTitle == null || sectionY == null
      ? { index, row, rowY: y }
      : { index, row, section: sectionTitle, sectionY, rowY: y });
    y += SETTINGS_ROW_HEIGHT;
  }
  return layouts;
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

function tokenValue(token: JeditStyleToken): TokenValue {
  return {
    hex: colorHex(token.fg) ?? token.hex ?? SETTINGS_FALLBACK_FOREGROUND,
    bg: colorHex(token.bg) ?? SETTINGS_FALLBACK_BACKGROUND,
  };
}
