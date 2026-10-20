import { createSurface, stringToSurface, type Surface } from '@flyingrobots/bijou';
import { clipToWidth } from '@flyingrobots/bijou-tui';
import type { FileSearchState } from '../app/workspace/file-search.js';
import type { JeditTheme, JeditStyleToken } from './jedit-theme.js';
import { fitLine, visibleLineLength } from './fit-line.js';

const INPUT_HEIGHT = 1;
const MIN_INPUT_WIDTH = 1;
const EMPTY_INPUT = '';
const LABEL_SUFFIX = ': ';
const CHARACTER_STEP = 1;

export interface FileSearchInputOptions {
  readonly state: FileSearchState;
  readonly label: string;
  readonly placeholder: string;
  readonly focused: boolean;
  readonly width: number;
  readonly theme: JeditTheme;
}

interface FileSearchInputWindow {
  readonly prefix: string;
  readonly prefixWidth: number;
  readonly text: string;
  readonly startIndex: number;
  readonly cursorColumn: number;
}

export function renderFileSearchInput(options: FileSearchInputOptions): Surface {
  if (options.width <= 0) return createSurface(0, INPUT_HEIGHT);
  const window = inputWindow(options);
  const content = options.state.input.length === 0
    ? clipToWidth(options.placeholder, options.width - window.prefixWidth)
    : window.text;
  const surface = stringToSurface(fitLine(`${window.prefix}${content}`, options.width), options.width, INPUT_HEIGHT);
  applyInputToken(surface, fileSearchInputToken(options.theme));
  if (options.focused && window.cursorColumn < options.width) {
    const cell = surface.get(window.cursorColumn, 0);
    surface.set(window.cursorColumn, 0, { ...cell, ...inputCellStyle(options.theme.cursor.insert), empty: false });
  }
  return surface;
}

function inputWindow(options: FileSearchInputOptions): FileSearchInputWindow {
  const prefix = clipToWidth(`${options.label}${LABEL_SUFFIX}`, Math.max(0, options.width - MIN_INPUT_WIDTH));
  const prefixWidth = visibleLineLength(prefix);
  const capacity = Math.max(MIN_INPUT_WIDTH, options.width - prefixWidth);
  const characters = Array.from(options.state.input);
  const cursor = Math.max(0, Math.min(characters.length, options.state.cursorIndex));
  let startIndex = 0;
  while (startIndex < cursor && visibleLineLength(characters.slice(startIndex, cursor).join(EMPTY_INPUT)) >= capacity) {
    startIndex += CHARACTER_STEP;
  }
  return {
    prefix, prefixWidth, startIndex,
    text: clipToWidth(characters.slice(startIndex).join(EMPTY_INPUT), capacity),
    cursorColumn: prefixWidth + visibleLineLength(characters.slice(startIndex, cursor).join(EMPTY_INPUT)),
  };
}

export function fileSearchCursorAtColumn(options: FileSearchInputOptions, column: number): number {
  const window = inputWindow(options);
  const characters = Array.from(options.state.input);
  let position = window.prefixWidth;
  for (let index = window.startIndex; index < characters.length; index += CHARACTER_STEP) {
    if (column <= position) return index;
    position += visibleLineLength(characters[index] ?? EMPTY_INPUT);
  }
  return characters.length;
}

function applyInputToken(surface: Surface, token: JeditStyleToken): void {
  for (let x = 0; x < surface.width; x += CHARACTER_STEP) {
    surface.set(x, 0, { ...surface.get(x, 0), ...inputCellStyle(token), empty: false });
  }
}

function inputCellStyle(token: JeditStyleToken) {
  return { fg: token.fg, fgRGB: token.fgRGB, bg: token.bg, bgRGB: token.bgRGB, modifiers: token.modifiers == null ? undefined : [...token.modifiers] };
}

function fileSearchInputToken(theme: JeditTheme): JeditStyleToken {
  return theme.surface.currentLine.bg === theme.surface.drawer.bg
    ? theme.surface.workspace
    : theme.surface.currentLine;
}
