import type { TextByteRange } from '../domain/graph-rope-types.js';
import type { HotTextWindowProjection } from './text-window-projection.js';
import type { JeditTextWindowMaterializationProvenance } from './jedit-text-window-materialization.js';

export type CheckpointKind = 'INITIAL' | 'MANUAL_SAVE' | 'AUTO_SAVE';

export interface TextBuffer {
  readonly bufferId: string;
  readonly bufferKey: string;
  readonly projectionPath: string | null;
  readonly createdAt: string;
}

export interface TextWindowLine {
  readonly lineNumber: number;
  readonly startByte: number;
  readonly endByte: number;
  readonly text: string;
}

export interface TextWindowReading {
  readonly readingId: string;
  readonly textBasis: TextWindowBasis;
  readonly projection: HotTextWindowProjection;
  readonly materialization: JeditTextWindowMaterializationProvenance;
  readonly lines: readonly TextWindowLine[];
  readonly byteLength: number;
  readonly lineCount: number;
  readonly startLine: number;
  readonly totalLineCount: number;
  readonly hasMoreBefore: boolean;
  readonly hasMoreAfter: boolean;
  readonly cursorLine: number;
  readonly viewportLineCount: number;
  readonly truncated: boolean;
}

export interface ApplyIntentResult {
  readonly buffer: TextBuffer;
  readonly textBasis: TextWindowBasis;
  readonly bufferVersion: number;
  readonly receiptId: string;
  readonly causalTransition?: TextBufferCausalTransition;
}

export interface TextBufferCausalTransition {
  readonly admittedTickId: string;
  readonly nextHeadId: string;
}

export interface CreateTextBufferCheckpointResult {
  readonly buffer: TextBuffer;
  readonly textBasis: TextWindowBasis;
  readonly bufferVersion: number;
  readonly checkpointId: string;
  readonly checkpointKind: CheckpointKind;
}

export interface CausalLineMarkerReading {
  readonly lineNumber: number;
  readonly kind: 'INSERTED' | 'MODIFIED';
  readonly tickReceiptIds: readonly string[];
  readonly rewriteIds: readonly string[];
  readonly diffIds: readonly string[];
}

export interface CausalLineDeletionMarkerReading {
  readonly boundaryLineNumber: number;
  readonly deletedLineCount: number;
  readonly tickReceiptIds: readonly string[];
  readonly rewriteIds: readonly string[];
  readonly diffIds: readonly string[];
}

export interface CausalLineDiffReading {
  readonly worldlineId: string;
  readonly basisHeadId: string;
  readonly nextHeadId: string;
  readonly insertedLineCount: number;
  readonly deletedLineCount: number;
  readonly tickReceiptIds: readonly string[];
  readonly rewriteIds: readonly string[];
  readonly diffIds: readonly string[];
  readonly markers: readonly CausalLineMarkerReading[];
  readonly deletions: readonly CausalLineDeletionMarkerReading[];
  readonly observerVersion: string;
}

export interface Observed<T> {
  readonly value: T;
  readonly evidence: {
    readonly readingId: string;
    readonly receiptId?: string;
  };
}

export interface TextWindowBasis {
  readonly basisHeadId: string;
  readonly byteRange: TextByteRange;
}

export interface TextWindowRangeInput {
  readonly cursorLine: number;
  readonly viewportLineCount: number;
  readonly beforeLines: number;
  readonly afterLines: number;
  readonly maxBytes: number;
}
