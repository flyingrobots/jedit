import type { Cell, Surface } from '@flyingrobots/bijou';
import type { SourceHighlightReading } from '../ports/source-highlighter.js';
import type {
  JeditStyleToken,
  JeditTheme,
  JeditThemeGutterTokenSet,
} from './jedit-theme.js';
import {
  SOURCE_LINE_NUMBER_MODE,
  type SourceLineNumberMode,
} from './source-line-number-mode.js';
import { createSourceWindowReadingFromLines, type SourceWindowReading } from './source-window.js';
import { paintHighlightedSourceWindow } from './source-highlight.js';

const NORMAL_MODE = 'normal';
const INSERT_MODE = 'insert';
const FIRST_VISIBLE_LINE_NUMBER = 1;
const GUTTER_DELETION_MARKER_WIDTH = 1;
const GUTTER_LINE_MARKER_WIDTH = 1;
const GUTTER_RULE_WIDTH = 1;
const GUTTER_RULE_GAP = 1;
const SIGN_CHARACTER_WIDTH = 1;
const GUTTER_RULE = '│';
const GUTTER_LINE_MARKER_CHAR = Object.freeze({
  inserted: '+',
  modified: '~',
  pending: '?',
  obstructed: '!',
} as const);
const MIN_TEXT_VIEWPORT_WIDTH = 1;
const DEFAULT_LINE_NUMBER_MODE = SOURCE_LINE_NUMBER_MODE.Absolute;
const CURRENT_LINE_RELATIVE_NUMBER = 0;

export type SourceViewerMode = typeof NORMAL_MODE | typeof INSERT_MODE;

export interface SourceViewerEditor {
  readonly lines: readonly string[];
  readonly cursorRow: number;
  readonly cursorCol: number;
  readonly scrollRow: number;
  readonly scrollCol: number;
  readonly mode: SourceViewerMode;
}

export interface SourceViewerViewport {
  readonly width: number;
  readonly height: number;
}

export interface SourceGutterLineMarker {
  readonly lineNumber: number;
  readonly kind: keyof typeof GUTTER_LINE_MARKER_CHAR;
}

export interface SourceGutterDeletionMarker {
  readonly boundaryLineNumber: number;
  readonly deletedLineCount: number;
}

export interface SourceViewerOptions {
  readonly viewport: SourceViewerViewport;
  readonly leftPad: number;
  readonly topPad: number;
  readonly theme: JeditTheme;
  readonly lineNumberMode?: SourceLineNumberMode;
  readonly gutterDimmed?: boolean;
  readonly lineMarkers?: readonly SourceGutterLineMarker[];
  readonly deletionMarkers?: readonly SourceGutterDeletionMarker[];
  readonly reading?: SourceWindowReading;
}

export function renderSourceViewer(
  surface: Surface,
  editor: SourceViewerEditor,
  highlight: SourceHighlightReading | undefined,
  options: SourceViewerOptions,
): Surface {
  const sourceWindow = options.reading ?? createSourceWindowReadingFromLines({
    lines: editor.lines,
    startLine: editor.scrollRow,
    lineCount: options.viewport.height,
  });
  const lineNumberMode = options.lineNumberMode ?? DEFAULT_LINE_NUMBER_MODE;
  const gutter = sourceViewerGutter(
    sourceWindow.totalLineCount,
    editor.cursorRow,
    lineNumberMode,
  );
  paintSourceViewerGutter(surface, {
    reading: sourceWindow,
    options,
    gutter,
    cursorRow: editor.cursorRow,
    mode: lineNumberMode,
  });
  const viewport = sourceTextViewport(options, gutter, editor.scrollCol);
  paintHighlightedSourceWindow(surface, sourceWindow, highlight, viewport);
  paintSourceViewerCursor(surface, editor, options, viewport, sourceWindow.startLine);

  return surface;
}

function paintSourceViewerCursor(
  surface: Surface,
  editor: SourceViewerEditor,
  options: SourceViewerOptions,
  viewport: ReturnType<typeof sourceTextViewport>,
  windowStartLine: number,
): void {
  const cursor = cursorDisplayPosition(editor);
  const cursorY = options.topPad + (cursor.row - windowStartLine);
  const cursorX = viewport.x + (cursor.col - editor.scrollCol);
  if (
    cursorY >= options.topPad
    && cursorY < options.topPad + options.viewport.height
    && cursorX >= viewport.x
    && cursorX < viewport.x + viewport.width
  ) {
    const cell = surface.get(cursorX, cursorY);
    const token = editor.mode === NORMAL_MODE ? options.theme.cursor.normal : options.theme.cursor.insert;
    surface.set(cursorX, cursorY, {
      ...cell,
      char: cell.char.length > 0 ? cell.char : cursorFallbackChar(editor.mode),
      ...cellStyle(token),
      empty: false,
    });
  }
}

interface SourceViewerGutter {
  readonly numberWidth: number;
  readonly width: number;
}

interface SourceViewerGutterPaintContext {
  readonly reading: ReturnType<typeof createSourceWindowReadingFromLines>;
  readonly options: SourceViewerOptions;
  readonly gutter: SourceViewerGutter;
  readonly cursorRow: number;
  readonly mode: SourceLineNumberMode;
}

export function sourceViewerGutterWidth(
  totalLineCount: number,
  cursorRow: number = CURRENT_LINE_RELATIVE_NUMBER,
  mode: SourceLineNumberMode = DEFAULT_LINE_NUMBER_MODE,
): number {
  return sourceViewerGutter(totalLineCount, cursorRow, mode).width;
}

function sourceViewerGutter(
  totalLineCount: number,
  cursorRow: number,
  mode: SourceLineNumberMode,
): SourceViewerGutter {
  const numberWidth = lineNumberLabelWidth(totalLineCount, cursorRow, mode);
  return {
    numberWidth,
    width: numberWidth
      + GUTTER_DELETION_MARKER_WIDTH
      + GUTTER_LINE_MARKER_WIDTH
      + GUTTER_RULE_WIDTH
      + GUTTER_RULE_GAP,
  };
}

function sourceTextViewport(
  options: SourceViewerOptions,
  gutter: SourceViewerGutter,
  scrollCol: number,
) {
  return {
    x: options.leftPad + gutter.width,
    y: options.topPad,
    scrollCol,
    width: Math.max(MIN_TEXT_VIEWPORT_WIDTH, options.viewport.width - gutter.width),
    height: options.viewport.height,
    theme: options.theme,
  };
}

function paintSourceViewerGutter(
  surface: Surface,
  context: SourceViewerGutterPaintContext,
): void {
  const { reading, options, gutter, cursorRow, mode } = context;
  const tokens = options.gutterDimmed
    ? options.theme.gutter.dimmed
    : options.theme.gutter.normal;
  const deletionX = options.leftPad + gutter.numberWidth;
  const markerX = deletionX + GUTTER_DELETION_MARKER_WIDTH;
  const ruleX = markerX + GUTTER_LINE_MARKER_WIDTH;
  const markers = new Map(options.lineMarkers?.map(marker => [marker.lineNumber, marker]));
  const deletions = deletionMarkersByLine(options.deletionMarkers, reading.totalLineCount);
  for (let row = 0; row < options.viewport.height; row += 1) {
    const sourceLine = reading.lines[row];
    const y = options.topPad + row;
    const label = sourceLine == null
      ? ''
      : sourceLineNumberLabel(sourceLine.lineNumber, mode, cursorRow).padStart(
          gutter.numberWidth,
          ' ',
        );
    const numberToken = sourceLine?.lineNumber === cursorRow
      ? tokens.currentLineNumber
      : tokens.lineNumber;
    paintGutterText(surface, label, options.leftPad, y, numberToken);
    paintGutterDeletion(surface, deletionX, y, sourceLine == null
      ? undefined
      : deletions.get(sourceLine.lineNumber), tokens);
    paintGutterMarker(surface, markerX, y, sourceLine == null
      ? undefined
      : markers.get(sourceLine.lineNumber), tokens);
    paintGutterCell(surface, ruleX, y, GUTTER_RULE, tokens.rule);
    paintGutterRuleGap(surface, ruleX, y, tokens.background);
  }
}

function deletionMarkersByLine(
  markers: readonly SourceGutterDeletionMarker[] | undefined,
  totalLineCount: number,
): ReadonlyMap<number, SourceGutterDeletionMarker> {
  return new Map(markers?.map(marker => [
    deletionMarkerLineNumber(marker.boundaryLineNumber, totalLineCount),
    marker,
  ]));
}

function deletionMarkerLineNumber(boundaryLineNumber: number, totalLineCount: number): number {
  const lastLineNumber = Math.max(0, totalLineCount - 1);
  return Math.min(Math.max(0, boundaryLineNumber), lastLineNumber);
}

function paintGutterDeletion(
  surface: Surface,
  x: number,
  y: number,
  marker: SourceGutterDeletionMarker | undefined,
  tokens: JeditThemeGutterTokenSet,
): void {
  const token = marker == null ? tokens.background : tokens.deleted;
  paintGutterCell(surface, x, y, marker == null ? ' ' : '-', token);
}

function paintGutterMarker(
  surface: Surface,
  x: number,
  y: number,
  marker: SourceGutterLineMarker | undefined,
  tokens: JeditThemeGutterTokenSet,
): void {
  if (marker == null) {
    paintGutterCell(surface, x, y, ' ', tokens.background);
    return;
  }
  paintGutterCell(
    surface,
    x,
    y,
    GUTTER_LINE_MARKER_CHAR[marker.kind],
    tokens[marker.kind],
  );
}

function sourceLineNumberLabel(
  lineNumber: number,
  mode: SourceLineNumberMode,
  cursorRow: number,
): string {
  if (mode === SOURCE_LINE_NUMBER_MODE.Absolute) {
    return String(lineNumber + FIRST_VISIBLE_LINE_NUMBER);
  }
  const relative = lineNumber - cursorRow;
  return relative > CURRENT_LINE_RELATIVE_NUMBER
    ? `+${relative}`
    : String(relative);
}

function lineNumberLabelWidth(
  totalLineCount: number,
  cursorRow: number,
  mode: SourceLineNumberMode,
): number {
  const absoluteWidth = String(Math.max(FIRST_VISIBLE_LINE_NUMBER, totalLineCount)).length;
  if (mode === SOURCE_LINE_NUMBER_MODE.Absolute) {
    return absoluteWidth;
  }
  const maxRelative = Math.max(
    Math.abs(cursorRow),
    Math.abs(totalLineCount - FIRST_VISIBLE_LINE_NUMBER - cursorRow),
  );
  return Math.max(absoluteWidth, signedLineNumberWidth(maxRelative));
}

function signedLineNumberWidth(value: number): number {
  return value <= CURRENT_LINE_RELATIVE_NUMBER
    ? String(CURRENT_LINE_RELATIVE_NUMBER).length
    : String(value).length + SIGN_CHARACTER_WIDTH;
}

function paintGutterRuleGap(
  surface: Surface,
  ruleX: number,
  y: number,
  token: JeditStyleToken,
): void {
  for (let gap = 0; gap < GUTTER_RULE_GAP; gap += 1) {
    paintGutterCell(surface, ruleX + gap + 1, y, ' ', token);
  }
}

function paintGutterText(
  surface: Surface,
  text: string,
  x: number,
  y: number,
  token: JeditStyleToken,
): void {
  for (let index = 0; index < text.length; index += 1) {
    paintGutterCell(surface, x + index, y, text[index] ?? ' ', token);
  }
}

function paintGutterCell(
  surface: Surface,
  x: number,
  y: number,
  char: string,
  token: JeditStyleToken,
): void {
  if (x < 0 || y < 0 || x >= surface.width || y >= surface.height) {
    return;
  }
  const cell = surface.get(x, y);
  surface.set(x, y, {
    ...cell,
    char,
    ...cellStyle(token),
    empty: false,
  });
}

function cursorDisplayPosition(editor: SourceViewerEditor): { readonly row: number; readonly col: number } {
  if (editor.mode === INSERT_MODE) {
    return {
      row: editor.cursorRow,
      col: editor.cursorCol,
    };
  }

  const line = editor.lines[editor.cursorRow] ?? '';
  return {
    row: editor.cursorRow,
    col: line.length === 0 ? 0 : Math.min(editor.cursorCol, line.length - 1),
  };
}

function cursorFallbackChar(mode: SourceViewerMode): string {
  return mode === NORMAL_MODE ? ' ' : '│';
}

function cellStyle(token: JeditStyleToken): Pick<Cell, 'fg' | 'bg' | 'fgRGB' | 'bgRGB' | 'modifiers'> {
  return {
    fg: token.fg,
    bg: token.bg,
    fgRGB: token.fgRGB,
    bgRGB: token.bgRGB,
    modifiers: token.modifiers == null ? undefined : [...token.modifiers],
  };
}
