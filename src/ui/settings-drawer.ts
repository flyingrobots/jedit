import { createSurface, stringToSurface, type Surface } from '@flyingrobots/bijou';
import type { JeditSettingsRow } from '../app/settings-session.js';
import { JEDIT_SETTING_ROW_KIND } from '../app/settings-session.js';
import { JEDIT_SETTINGS_TOGGLE_LABEL } from '../app/keybindings.js';
import { JEDIT_MARKDOWN_TOKEN, JEDIT_SOURCE_TOKEN, type JeditStyleToken, type JeditTheme } from './jedit-theme.js';
import { fitLine } from './workspace-render.js';

const SETTINGS_DRAWER_MIN_WIDTH = 28;
const SETTINGS_DRAWER_MAX_WIDTH = 42;
const SETTINGS_DRAWER_WIDTH_RATIO = 0.3;
const SETTINGS_HEADER_ROW = 1;
const SETTINGS_HINT_ROW = 2;
const SETTINGS_FIRST_ROW = 4;
const SETTINGS_LEFT_PAD = 2;
const SETTINGS_ROW_GAP = 1;
const SETTINGS_ROW_HEIGHT = 2;
const SETTINGS_SELECTED_MARK = '›';
const SETTINGS_UNSELECTED_MARK = ' ';
const SETTINGS_CHOICE_MARK = '↻';
const SETTINGS_CHECKED_MARK = '☑';
const SETTINGS_UNCHECKED_MARK = '☐';
const SETTINGS_CLOSE_HINT = `${JEDIT_SETTINGS_TOGGLE_LABEL.toUpperCase()}/Esc close`;
const SETTINGS_TITLE = 'Settings';

export interface RenderSettingsDrawerOptions {
  readonly rows: readonly JeditSettingsRow[];
  readonly selectedIndex: number;
  readonly theme: JeditTheme;
  readonly width: number;
  readonly height: number;
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
  const surface = createSurface(options.width, options.height);
  fillSurface(surface, options.theme.surface.drawer);
  paintText(surface, SETTINGS_TITLE, SETTINGS_LEFT_PAD, SETTINGS_HEADER_ROW, options.theme.markdown.get(JEDIT_MARKDOWN_TOKEN.Heading) ?? options.theme.surface.drawer);
  paintText(surface, SETTINGS_CLOSE_HINT, SETTINGS_LEFT_PAD, SETTINGS_HINT_ROW, options.theme.source.get(JEDIT_SOURCE_TOKEN.Comment) ?? options.theme.surface.drawer);

  let y = SETTINGS_FIRST_ROW;
  let section = '';
  for (let index = 0; index < options.rows.length && y < options.height; index += 1) {
    const row = options.rows[index];
    if (row == null) {
      continue;
    }
    if (row.section !== section) {
      section = row.section;
      paintText(surface, section, SETTINGS_LEFT_PAD, y, options.theme.markdown.get(JEDIT_MARKDOWN_TOKEN.HeadingSoft) ?? options.theme.surface.drawer);
      y += SETTINGS_ROW_GAP;
    }
    paintSettingsRow(surface, row, index === options.selectedIndex, SETTINGS_LEFT_PAD, y, options.theme);
    y += SETTINGS_ROW_HEIGHT;
  }
  return surface;
}

function paintSettingsRow(surface: Surface, row: JeditSettingsRow, selected: boolean, x: number, y: number, theme: JeditTheme): void {
  if (y >= surface.height) {
    return;
  }
  const label = fitLine(`${selected ? SETTINGS_SELECTED_MARK : SETTINGS_UNSELECTED_MARK} ${rowMark(row)} ${row.label} ${row.valueLabel}`, Math.max(1, surface.width - x));
  const labelToken = selected ? theme.cursor.normal : theme.surface.drawer;
  paintText(surface, label, x, y, labelToken);

  if (y + 1 < surface.height) {
    const descriptionToken = theme.source.get(JEDIT_SOURCE_TOKEN.Comment) ?? theme.surface.drawer;
    paintText(surface, `  ${row.description}`, x, y + 1, descriptionToken);
  }
}

function rowMark(row: JeditSettingsRow): string {
  if (row.kind === JEDIT_SETTING_ROW_KIND.Choice) {
    return SETTINGS_CHOICE_MARK;
  }
  return row.checked === true ? SETTINGS_CHECKED_MARK : SETTINGS_UNCHECKED_MARK;
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
