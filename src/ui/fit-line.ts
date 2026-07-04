import { clipToWidth, visibleLength } from '@flyingrobots/bijou-tui';

const LINE_PAD_CHAR = ' ';
const EMPTY_LINE = '';

export function fitLine(text: string, width: number): string {
  if (width <= 0) {
    return EMPTY_LINE;
  }
  const clipped = clipToWidth(text, width);
  const visible = visibleLineLength(clipped);
  if (visible >= width) {
    return clipped;
  }
  return `${clipped}${LINE_PAD_CHAR.repeat(width - visible)}`;
}

export function visibleLineLength(text: string): number {
  return visibleLength(text);
}
