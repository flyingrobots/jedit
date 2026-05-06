import type { Cell, Surface } from '@flyingrobots/bijou';
import type { SourceHighlightReading, SourceHighlightRole, SourceHighlightSpan } from '../ports/source-highlighter.js';
import type { JeditStyleToken, JeditTheme } from './jedit-theme.js';
import type { SourceWindowReading } from './source-window.js';

const ZERO_INDEX = 0;
const MIN_RENDER_SIZE = 1;

type CellStyle = Pick<Cell, 'fg' | 'bg' | 'fgRGB' | 'bgRGB' | 'modifiers'>;

export interface PaintHighlightedSourceWindowOptions {
  readonly x: number;
  readonly y: number;
  readonly scrollCol: number;
  readonly width: number;
  readonly height: number;
  readonly theme: JeditTheme;
}

export function paintHighlightedSourceWindow(
  surface: Surface,
  reading: SourceWindowReading,
  highlight: SourceHighlightReading | undefined,
  options: PaintHighlightedSourceWindowOptions,
): void {
  const safeScrollCol = Math.max(ZERO_INDEX, options.scrollCol);
  const safeWidth = Math.max(MIN_RENDER_SIZE, options.width);
  const safeHeight = Math.max(MIN_RENDER_SIZE, options.height);

  for (let row = ZERO_INDEX; row < safeHeight; row += 1) {
    const sourceLine = reading.lines[row];
    const sourceText = sourceLine?.text ?? '';
    const sourceRow = sourceLine?.lineNumber ?? reading.startLine + row;

    for (let col = ZERO_INDEX; col < safeWidth; col += 1) {
      const sourceCol = safeScrollCol + col;
      const char = sourceText[sourceCol] ?? ' ';
      const style = styleAt(highlight?.spans ?? [], sourceRow, sourceCol, options.theme);
      surface.set(options.x + col, options.y + row, {
        char,
        ...style,
        empty: false,
      });
    }
  }
}

function styleAt(
  spans: readonly SourceHighlightSpan[],
  row: number,
  column: number,
  theme: JeditTheme,
): CellStyle {
  for (const span of spans) {
    if (spanContainsCell(span, row, column)) {
      return styleForRole(span.role, theme);
    }
  }
  return {};
}

function spanContainsCell(span: SourceHighlightSpan, row: number, column: number): boolean {
  if (row < span.range.start.row || row > span.range.end.row) {
    return false;
  }
  if (row === span.range.start.row && column < span.range.start.column) {
    return false;
  }
  if (row === span.range.end.row && column >= span.range.end.column) {
    return false;
  }
  return true;
}

function styleForRole(role: SourceHighlightRole, theme: JeditTheme): CellStyle {
  const sourceToken = theme.sourceRoleMap.get(role);
  if (sourceToken == null) {
    return {};
  }
  const token = theme.source.get(sourceToken);
  return token == null ? {} : tokenStyle(token);
}

function tokenStyle(token: JeditStyleToken): CellStyle {
  return {
    fg: token.fg,
    bg: token.bg,
    fgRGB: token.fgRGB,
    bgRGB: token.bgRGB,
    modifiers: token.modifiers == null ? undefined : [...token.modifiers],
  };
}
