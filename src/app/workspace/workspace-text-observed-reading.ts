import {
  workspaceTextReadingCoverage,
  type WorkspaceTextReadingCache,
} from './workspace-text-reading-cache.js';
import type { HotTextWindowProjection } from '../../ports/text-window-projection.js';
import type { TextWindowBasis } from '../../ports/text-authority-evidence.js';
import type { JeditTextWindowMaterializationProvenance } from '../../ports/jedit-text-window-materialization.js';
import { jeditTextWindowMaterializationProvenanceMatchesProjection } from '../jedit-text-window-materialization-cache.js';

const FIRST_READING_LINE = 0;
const UTF8_ENCODER = new TextEncoder();

export interface WorkspaceTextObservedReading {
  readonly readingId: string;
  readonly textBasis: TextWindowBasis;
  readonly projection?: HotTextWindowProjection;
  readonly materialization: JeditTextWindowMaterializationProvenance;
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
    textBasis: reading.textBasis,
    projection: validatedProjection(reading),
    materialization: reading.materialization,
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

function validatedProjection(reading: WorkspaceTextObservedReading): HotTextWindowProjection | undefined {
  if (reading.projection == null) {
    return undefined;
  }
  const lines = reading.lines.map((line) => line.text);
  if (!workspaceTextProjectionMatchesLines(reading.projection, lines)
    || !jeditTextWindowMaterializationProvenanceMatchesProjection(
      reading.materialization,
      reading.projection,
    )) {
    throw new WorkspaceTextProjectionError();
  }
  return reading.projection;
}

export function workspaceTextProjectionMatchesLines(
  projection: HotTextWindowProjection,
  lines: readonly string[],
): boolean {
  return projection.text === lines.join('\n')
    && validProjectionRange(projection)
    && projection.support.every((support) => supportWithinProjection(support.byteRange, projection.byteRange));
}

function validProjectionRange(projection: HotTextWindowProjection): boolean {
  const { startByte, endByte } = projection.byteRange;
  return projection.basisHeadId.length > 0
    && Number.isInteger(startByte)
    && Number.isInteger(endByte)
    && startByte >= FIRST_READING_LINE
    && startByte <= endByte
    && UTF8_ENCODER.encode(projection.text).length === endByte - startByte;
}

function supportWithinProjection(
  support: HotTextWindowProjection['byteRange'],
  projection: HotTextWindowProjection['byteRange'],
): boolean {
  return Number.isInteger(support.startByte)
    && Number.isInteger(support.endByte)
    && support.startByte >= projection.startByte
    && support.startByte <= support.endByte
    && support.endByte <= projection.endByte;
}

export class WorkspaceTextProjectionError extends Error {
  public constructor() {
    super('Workspace text cache projection does not match its rendered lines.');
    this.name = 'WorkspaceTextProjectionError';
  }
}

function readingStartLine(reading: WorkspaceTextObservedReading): number {
  return reading.startLine
    ?? reading.lines[0]?.lineNumber
    ?? FIRST_READING_LINE;
}
