import type { QueryOperationMap } from '../generated/jedit/rope.types.generated.js';
import { fitLine } from './workspace-render.js';

const ZERO_INDEX = 0;
const MIN_VISIBLE_COUNT = 1;

type TextWindowReading = QueryOperationMap['textWindow']['result'];
type TextWindowLine = TextWindowReading['lines'][number];

export interface SourceWindowLine {
  readonly lineNumber: TextWindowLine['lineNumber'];
  readonly text: TextWindowLine['text'];
}

export interface SourceWindowReading {
  readonly startLine: TextWindowReading['startLine'];
  readonly lineCount: TextWindowReading['lineCount'];
  readonly totalLineCount: TextWindowReading['totalLineCount'];
  readonly hasMoreBefore: TextWindowReading['hasMoreBefore'];
  readonly hasMoreAfter: TextWindowReading['hasMoreAfter'];
  readonly lines: readonly SourceWindowLine[];
}

export interface CreateSourceWindowReadingInput {
  readonly lines: readonly string[];
  readonly startLine: number;
  readonly lineCount: number;
}

export function createSourceWindowReadingFromLines(
  input: CreateSourceWindowReadingInput,
): SourceWindowReading {
  const sourceLines = input.lines.length === ZERO_INDEX ? [''] : input.lines;
  const lineCount = Math.max(MIN_VISIBLE_COUNT, input.lineCount);
  const startLine = clampStartLine(input.startLine, sourceLines.length);
  const lines = sourceLines
    .slice(startLine, startLine + lineCount)
    .map((line, index) => ({
      lineNumber: startLine + index,
      text: line,
    }));

  return {
    startLine,
    lineCount: lines.length,
    totalLineCount: sourceLines.length,
    hasMoreBefore: startLine > ZERO_INDEX,
    hasMoreAfter: startLine + lines.length < sourceLines.length,
    lines,
  };
}

export function sourceWindowRows(
  reading: SourceWindowReading,
  scrollCol: number,
  width: number,
  height: number,
): readonly string[] {
  const safeScrollCol = Math.max(ZERO_INDEX, scrollCol);
  const safeWidth = Math.max(MIN_VISIBLE_COUNT, width);
  const safeHeight = Math.max(MIN_VISIBLE_COUNT, height);
  const rows: string[] = [];

  for (let row = ZERO_INDEX; row < safeHeight; row += 1) {
    const sourceLine = reading.lines[row]?.text ?? '';
    rows.push(fitLine(sourceLine.slice(safeScrollCol), safeWidth));
  }

  return rows;
}

function clampStartLine(startLine: number, totalLineCount: number): number {
  if (startLine < ZERO_INDEX) {
    return ZERO_INDEX;
  }
  return Math.min(startLine, Math.max(ZERO_INDEX, totalLineCount - MIN_VISIBLE_COUNT));
}
