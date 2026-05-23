import type {
  BufferKey,
  ReadingId,
  TextBufferId,
  TextWindowLine,
} from './jedit-optic-client.js';

export interface EchoPoweredTextBufferWitnessRequest {
  readonly bufferKey: BufferKey;
  readonly initialText: string;
  readonly projectionPath?: string | null;
  readonly startByte: number;
  readonly endByte: number;
  readonly insertText: string;
  readonly cursorLine: number;
  readonly beforeLines: number;
  readonly viewportLineCount: number;
  readonly afterLines: number;
  readonly maxBytes: number;
}

export interface EchoPoweredTextBufferWitnessReport {
  readonly bufferId: TextBufferId;
  readonly bufferKey: BufferKey;
  readonly receiptId: string;
  readonly readingId: ReadingId;
  readonly text: string;
  readonly lines: readonly TextWindowLine[];
  readonly truncated: boolean;
}
