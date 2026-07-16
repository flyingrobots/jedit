import {
  createSurface,
  stringToSurface,
  type Surface,
} from "@flyingrobots/bijou";
import type { JeditStyleToken, JeditTheme } from "./jedit-theme.js";
import {
  foregroundTokenFromThemeVariable,
  JEDIT_THEME_VARIABLE_TOKEN,
} from "./theme-variable-token.js";
import { fitLine } from "./fit-line.js";

export const WHY_INLINE_PANEL_TONE = Object.freeze({
  Info: "info",
  Warning: "warning",
} as const);

export type WhyInlinePanelTone =
  (typeof WHY_INLINE_PANEL_TONE)[keyof typeof WHY_INLINE_PANEL_TONE];

export interface RenderWhyInlinePanelOptions {
  readonly title: string;
  readonly message: string;
  readonly detailRows?: readonly string[];
  readonly tone: WhyInlinePanelTone;
  readonly theme: JeditTheme;
  readonly width: number;
  readonly maxRows: number;
}

const WHY_PANEL_MIN_WIDTH = 1;
const WHY_PANEL_FIRST_ROW = 0;
const WHY_PANEL_TEXT_X = 2;
const WHY_PANEL_RULE_X = 0;
const WHY_PANEL_TITLE_PREFIX = "i ";
const WHY_PANEL_WARNING_PREFIX = "! ";
const WHY_PANEL_WORD_SEPARATOR = " ";
const WHY_PANEL_EMPTY_TEXT = "";
const WHY_PANEL_ROW_STEP = 1;
const WHY_PANEL_MIN_ROWS = 1;

export function renderWhyInlinePanel(
  options: RenderWhyInlinePanelOptions,
): Surface {
  const width = Math.max(WHY_PANEL_MIN_WIDTH, Math.floor(options.width));
  const rows = whyPanelRows(options, width);
  const surface = createSurface(width, rows.length);
  fillSurface(surface, options.theme.surface.drawer);
  paintRule(surface, whyPanelToneToken(options));
  rows.forEach((row, y) => paintText(surface, row, y, options.theme.surface.drawer));
  return surface;
}

function whyPanelRows(
  options: RenderWhyInlinePanelOptions,
  width: number,
): readonly string[] {
  const textWidth = Math.max(WHY_PANEL_MIN_WIDTH, width - WHY_PANEL_TEXT_X);
  const title = `${whyPanelTitlePrefix(options.tone)}${options.title}`;
  const messageRows = wrapWhyPanelMessage(options.message, textWidth);
  const detailRows = (options.detailRows ?? []).flatMap(row => wrapWhyPanelMessage(row, textWidth));
  const rows = detailRows.length === 0
    ? [title, ...messageRows]
    : [title, messageRows[WHY_PANEL_FIRST_ROW] ?? WHY_PANEL_EMPTY_TEXT, ...detailRows];
  return rows.slice(
    WHY_PANEL_FIRST_ROW,
    Math.max(WHY_PANEL_MIN_ROWS, options.maxRows),
  );
}

function whyPanelTitlePrefix(tone: RenderWhyInlinePanelOptions["tone"]): string {
  return tone === WHY_INLINE_PANEL_TONE.Warning
    ? WHY_PANEL_WARNING_PREFIX
    : WHY_PANEL_TITLE_PREFIX;
}

function wrapWhyPanelMessage(message: string, width: number): readonly string[] {
  const rows: string[] = [];
  for (const rawLine of message.split("\n")) {
    rows.push(...wrapWhyPanelLine(rawLine, width));
  }
  return rows.length === 0 ? [WHY_PANEL_EMPTY_TEXT] : rows;
}

function wrapWhyPanelLine(line: string, width: number): readonly string[] {
  const words = line
    .split(/\s+/)
    .filter((word) => word.length > 0)
    .flatMap(word => chunkWhyPanelWord(word, width));
  if (words.length === 0) {
    return [WHY_PANEL_EMPTY_TEXT];
  }
  const rows: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current.length === 0
      ? word
      : `${current}${WHY_PANEL_WORD_SEPARATOR}${word}`;
    if ([...candidate].length <= width) {
      current = candidate;
    } else if (current.length === 0) {
      rows.push(word);
    } else {
      rows.push(current);
      current = word;
    }
  }
  if (current.length > 0) {
    rows.push(current);
  }
  return rows;
}

function chunkWhyPanelWord(word: string, width: number): readonly string[] {
  const characters = [...word];
  const chunks: string[] = [];
  for (let offset = 0; offset < characters.length; offset += width) {
    chunks.push(characters.slice(offset, offset + width).join(WHY_PANEL_EMPTY_TEXT));
  }
  return chunks;
}

function fillSurface(surface: Surface, token: JeditStyleToken): void {
  surface.fill({
    char: " ",
    fg: token.fg,
    fgRGB: token.fgRGB,
    bg: token.bg,
    bgRGB: token.bgRGB,
    modifiers: token.modifiers == null ? undefined : [...token.modifiers],
    empty: false,
  });
}

function paintRule(surface: Surface, token: JeditStyleToken): void {
  for (let y = 0; y < surface.height; y += WHY_PANEL_ROW_STEP) {
    const cell = surface.get(WHY_PANEL_RULE_X, y);
    surface.set(WHY_PANEL_RULE_X, y, {
      ...cell,
      char: token.char ?? "│",
      fg: token.fg,
      fgRGB: token.fgRGB,
      bg: token.bg,
      bgRGB: token.bgRGB,
      modifiers: token.modifiers == null ? undefined : [...token.modifiers],
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
  const width = Math.max(WHY_PANEL_MIN_WIDTH, surface.width - WHY_PANEL_TEXT_X);
  const line = stringToSurface(fitLine(text, width), width, WHY_PANEL_MIN_ROWS);
  applyToken(line, token);
  surface.blit(line, WHY_PANEL_TEXT_X, y);
}

function whyPanelToneToken(options: RenderWhyInlinePanelOptions): JeditStyleToken {
  const baseToken = whyPanelAccentBaseToken(options.theme);
  return options.tone === WHY_INLINE_PANEL_TONE.Warning
    ? foregroundTokenFromThemeVariable(
        options.theme,
        JEDIT_THEME_VARIABLE_TOKEN.Warning,
        baseToken,
      )
    : foregroundTokenFromThemeVariable(
        options.theme,
        JEDIT_THEME_VARIABLE_TOKEN.Info,
        baseToken,
      );
}

function whyPanelAccentBaseToken(theme: JeditTheme): JeditStyleToken {
  return {
    ...theme.chrome.activeEdge,
    bg: theme.surface.drawer.bg,
    bgRGB: theme.surface.drawer.bgRGB,
    backgroundEffect: theme.surface.drawer.backgroundEffect,
    backgroundVariables: theme.surface.drawer.backgroundVariables,
  };
}

function applyToken(surface: Surface, token: JeditStyleToken): void {
  for (let y = 0; y < surface.height; y += WHY_PANEL_ROW_STEP) {
    for (let x = 0; x < surface.width; x += WHY_PANEL_ROW_STEP) {
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
