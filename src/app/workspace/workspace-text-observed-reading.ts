import {
  workspaceTextReadingCoverage,
  type WorkspaceTextReadingCache,
} from './workspace-text-reading-cache.js';

const FIRST_READING_LINE = 0;

export interface WorkspaceTextObservedReading {
  readonly readingId: string;
  readonly lines: readonly { readonly lineNumber?: number; readonly text: string }[];
  readonly startLine?: number;
  readonly lineCount: number;
  readonly totalLineCount?: number;
  readonly hasMoreBefore?: boolean;
  readonly hasMoreAfter?: boolean;
  readonly cursorLine: number;
  readonly viewportLineCount: number;
  readonly truncated: boolean;
}

export function readingCache(
  bufferId: string,
  reading: WorkspaceTextObservedReading,
): WorkspaceTextReadingCache {
  const returnedLineCount = reading.lines.length;
  const startLine = readingStartLine(reading);
  const totalLineCount = reading.totalLineCount ?? Math.max(reading.lineCount, startLine + returnedLineCount);
  const hasMoreBefore = reading.hasMoreBefore ?? startLine > FIRST_READING_LINE;
  const hasMoreAfter = reading.hasMoreAfter ?? startLine + returnedLineCount < totalLineCount;
  return {
    bufferId,
    readingId: reading.readingId,
    lines: reading.lines.map((line) => line.text),
    coverage: workspaceTextReadingCoverage({
      startLine,
      returnedLineCount,
      totalLineCount,
      hasMoreBefore,
      hasMoreAfter,
      truncated: reading.truncated,
    }),
    lineCount: totalLineCount,
    startLine,
    returnedLineCount,
    totalLineCount,
    hasMoreBefore,
    hasMoreAfter,
    cursorLine: reading.cursorLine,
    viewportLineCount: reading.viewportLineCount,
    truncated: reading.truncated,
  };
}

function readingStartLine(reading: WorkspaceTextObservedReading): number {
  return reading.startLine
    ?? reading.lines[0]?.lineNumber
    ?? FIRST_READING_LINE;
}
