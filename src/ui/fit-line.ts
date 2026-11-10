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

const WORD_SEPARATOR = ' ';
const GRAPHEMES = new Intl.Segmenter(undefined, { granularity: 'grapheme' });

interface WrapState {
  readonly rows: string[];
  row: string;
}

/** Word-wrap one line to the given cell width; words wider than a row break between graphemes. */
export function wrapLine(text: string, width: number): readonly string[] {
  if (width <= 0) return [EMPTY_LINE];
  const state: WrapState = { rows: [], row: EMPTY_LINE };
  for (const word of text.split(WORD_SEPARATOR)) appendWord(state, word, width);
  return [...state.rows, state.row];
}

function appendWord(state: WrapState, word: string, width: number): void {
  const candidate = state.row.length === 0 ? word : `${state.row}${WORD_SEPARATOR}${word}`;
  if (visibleLineLength(candidate) <= width) {
    state.row = candidate;
    return;
  }
  if (state.row.length > 0) state.rows.push(state.row);
  state.row = EMPTY_LINE;
  for (const { segment } of GRAPHEMES.segment(word)) appendGrapheme(state, segment, width);
}

function appendGrapheme(state: WrapState, grapheme: string, width: number): void {
  if (state.row.length > 0 && visibleLineLength(`${state.row}${grapheme}`) > width) {
    state.rows.push(state.row);
    state.row = EMPTY_LINE;
  }
  state.row = `${state.row}${grapheme}`;
}
