import type { Cell, Surface, Theme, TokenValue } from '@flyingrobots/bijou';
import { SOURCE_HIGHLIGHT_ROLE, type SourceHighlightReading, type SourceHighlightRole, type SourceHighlightSpan } from '../ports/source-highlighter.js';
import type { SourceWindowReading } from './source-window.js';

const ZERO_INDEX = 0;
const MIN_RENDER_SIZE = 1;
const BOLD_MODIFIERS = ['bold'];
const DIM_MODIFIERS = ['dim'];

type CellStyle = Pick<Cell, 'fg' | 'bg' | 'fgRGB' | 'bgRGB' | 'modifiers'>;

type SourceHighlightTheme = Pick<Theme, 'semantic' | 'surface'>;

export interface PaintHighlightedSourceWindowOptions {
  readonly x: number;
  readonly y: number;
  readonly scrollCol: number;
  readonly width: number;
  readonly height: number;
  readonly theme: SourceHighlightTheme;
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
  theme: SourceHighlightTheme,
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

function styleForRole(role: SourceHighlightRole, theme: SourceHighlightTheme): CellStyle {
  if (role === SOURCE_HIGHLIGHT_ROLE.Comment) {
    return tokenStyle(theme.semantic.muted, DIM_MODIFIERS);
  }
  if (role === SOURCE_HIGHLIGHT_ROLE.Keyword) {
    return tokenStyle(theme.semantic.accent, BOLD_MODIFIERS);
  }
  if (role === SOURCE_HIGHLIGHT_ROLE.String || role === SOURCE_HIGHLIGHT_ROLE.Number) {
    return tokenStyle(theme.semantic.info);
  }
  if (role === SOURCE_HIGHLIGHT_ROLE.Function || role === SOURCE_HIGHLIGHT_ROLE.Type) {
    return tokenStyle(theme.semantic.accent);
  }
  if (role === SOURCE_HIGHLIGHT_ROLE.Property || role === SOURCE_HIGHLIGHT_ROLE.Variable) {
    return tokenStyle(theme.semantic.primary);
  }
  if (role === SOURCE_HIGHLIGHT_ROLE.Operator || role === SOURCE_HIGHLIGHT_ROLE.Punctuation) {
    return tokenStyle(theme.semantic.warning);
  }
  return {};
}

function tokenStyle(token: TokenValue, modifiers?: readonly string[]): CellStyle {
  return {
    fg: token.hex,
    bg: token.bg,
    fgRGB: token.fgRGB,
    bgRGB: token.bgRGB,
    modifiers: modifiers == null ? token.modifiers : [...modifiers],
  };
}
