import { segmentGraphemes, type Surface } from '@flyingrobots/bijou';
import type { SourceHighlightReading } from '../ports/source-highlighter.js';
import type { JeditTheme } from './jedit-theme.js';
import { visibleLineLength } from './fit-line.js';
import { sourceHighlightStyleAt } from './source-highlight.js';

export interface PreviewSyntaxPaintOptions {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly theme: JeditTheme;
}

export function paintPreviewSyntax(
  surface: Surface,
  lines: readonly string[],
  highlight: SourceHighlightReading | undefined,
  options: PreviewSyntaxPaintOptions,
): void {
  lines.slice(0, options.height).forEach((line, row) => paintSyntaxLine(surface, line, row, highlight, options));
}

function paintSyntaxLine(
  surface: Surface,
  line: string,
  row: number,
  highlight: SourceHighlightReading | undefined,
  options: PreviewSyntaxPaintOptions,
): void {
  let column = 0;
  let sourceColumn = 0;
  for (const grapheme of segmentGraphemes(line)) {
    const width = visibleLineLength(grapheme);
    const style = sourceHighlightStyleAt(highlight?.spans ?? [], row, sourceColumn, options.theme);
    for (let cell = 0; cell < width && column + cell < options.width; cell += 1) {
      const x = options.x + column + cell;
      const y = options.y + row;
      surface.set(x, y, { ...surface.get(x, y), ...style });
    }
    sourceColumn += grapheme.length;
    column += width;
    if (column >= options.width) break;
  }
}
