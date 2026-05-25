import type {
  CheckpointKind,
  QueryTextWindowRequest,
} from '../generated/jedit/hot-text-runtime.wesley.generated.js';
import type { JeditRetainedEvidenceInventory } from './jedit-retained-evidence.js';

export const READ_BASIS_HANDLE_KIND = 'read-basis-handle';
export const REPLACE_RANGE_INTENT_KIND = 'replaceRange';

export type TextBufferId = string;
export type BufferKey = string;
export type ReadingId = string;
export type BufferVersion = number;
export type SessionId = string;

export const TEXT_BUFFER_CHECKPOINT_KIND_MANUAL_SAVE: CheckpointKind = 'MANUAL_SAVE';

export interface ReadBasisHandle {
  readonly kind: typeof READ_BASIS_HANDLE_KIND;
  readonly id: string;
}

export interface TextBuffer {
  readonly bufferId: TextBufferId;
  readonly bufferKey: BufferKey;
  readonly projectionPath: string | null;
  readonly createdAt: string;
}

export interface ReplaceRangeIntent {
  readonly kind: typeof REPLACE_RANGE_INTENT_KIND;
  readonly startByte: number;
  readonly endByte: number;
  readonly insertText: string;
}

export interface TextWindowLine {
  readonly lineNumber: number;
  readonly startByte: number;
  readonly endByte: number;
  readonly text: string;
}

export interface TextWindowReading {
  readonly readingId: ReadingId;
  readonly lines: readonly TextWindowLine[];
  readonly byteLength: number;
  readonly lineCount: number;
  readonly cursorLine: number;
  readonly viewportLineCount: number;
  readonly truncated: boolean;
}

export interface ApplyIntentResult {
  readonly buffer: TextBuffer;
  readonly readBasis: ReadBasisHandle;
  readonly bufferVersion: BufferVersion;
  readonly receiptId: string;
}

export interface CreateTextBufferCheckpointRequest {
  readonly kind: CheckpointKind;
  readonly label?: string | null;
}

export interface CreateTextBufferCheckpointResult {
  readonly buffer: TextBuffer;
  readonly readBasis: ReadBasisHandle;
  readonly bufferVersion: BufferVersion;
  readonly checkpointId: string;
  readonly checkpointKind: CheckpointKind;
}

export interface Observed<T> {
  readonly value: T;
  readonly evidence: {
    readonly readingId: string;
    readonly receiptId?: string;
    readonly retainedEvidence?: JeditRetainedEvidenceInventory;
  };
}

export interface TextBufferOptic {
  readonly buffer: TextBuffer;

  currentReadBasis(): ReadBasisHandle;

  applyIntent(intent: ReplaceRangeIntent): Promise<ApplyIntentResult>;

  createCheckpoint(
    request: CreateTextBufferCheckpointRequest,
  ): Promise<CreateTextBufferCheckpointResult>;

  textWindow(
    readBasis: ReadBasisHandle,
    input: TextWindowRangeInput,
  ): Promise<Observed<TextWindowReading>>;
}

export interface CreateTextBufferRequest {
  readonly bufferKey: BufferKey;
  readonly initialText: string;
  readonly projectionPath?: string | null;
}

export interface TextBufferSessionPort {
  readonly sessionId: SessionId;

  createBuffer(input: CreateTextBufferRequest): Promise<TextBufferOptic>;

  getBufferOptic(bufferId: TextBufferId): Promise<TextBufferOptic | null>;

  listBuffers(): Promise<readonly TextBuffer[]>;
}

export type TextWindowRangeInput = Omit<QueryTextWindowRequest['input'], 'worldlineId'>;
