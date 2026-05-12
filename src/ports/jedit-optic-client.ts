import type {
  MutationCreateBufferWorldlineRequest,
  MutationCreateCheckpointRequest,
  MutationReplaceRangeAsTickRequest,
  QueryTextWindowRequest,
  QueryWorldlineSnapshotRequest,
} from '../generated/jedit/hot-text-runtime.wesley.generated.js';
import type {
  CreateBufferWorldlineExecution,
  CreateCheckpointExecution,
  JeditWorldlineSession,
  ReplaceRangeAsTickExecution,
} from '../app/jedit-contract-runtime.js';
import type { WorldlineSnapshotReadingEnvelope } from '../app/jedit-observer-runtime.js';
import type { TextWindowReadingEnvelope } from '../app/jedit-observer-runtime.js';

export const READ_BASIS_HANDLE_KIND = 'read-basis-handle';

export interface ReadBasisHandle {
  readonly kind: typeof READ_BASIS_HANDLE_KIND;
  readonly id: string;
}

export const REPLACE_RANGE_INTENT_KIND = 'replaceRange';

export type TextBufferId = string;
export type BufferKey = string;
export type ReadingId = string;
export type BufferVersion = number;
export type SessionId = string;

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

export interface Observed<T> {
  readonly value: T;
  readonly evidence: {
    readonly readingId: string;
    readonly receiptId?: string;
  };
}

export interface TextBufferOptic {
  readonly buffer: TextBuffer;

  currentReadBasis(): ReadBasisHandle;

  applyIntent(intent: ReplaceRangeIntent): Promise<ApplyIntentResult>;

  textWindow(
    readBasis: ReadBasisHandle,
    input: TextWindowRangeInput,
  ): Promise<Observed<TextWindowReading>>;
}

export interface OpticSession {
  readonly sessionId: SessionId;

  createBuffer(input: {
    readonly bufferKey: BufferKey;
    readonly initialText: string;
    readonly projectionPath?: string | null;
  }): Promise<TextBufferOptic>;

  getBufferOptic(bufferId: TextBufferId): Promise<TextBufferOptic | null>;

  listBuffers(): Promise<readonly TextBuffer[]>;
}

export interface OpenTextBufferExecution extends CreateBufferWorldlineExecution {
  readonly readBasisHandle: ReadBasisHandle;
}

export type TextWindowRangeInput = Omit<QueryTextWindowRequest['input'], 'worldlineId'>;

export interface JeditMutationOpticClient {
  openTextBuffer(
    input: MutationCreateBufferWorldlineRequest['input'],
  ): OpenTextBufferExecution;

  createBufferWorldline(
    input: MutationCreateBufferWorldlineRequest['input'],
  ): CreateBufferWorldlineExecution;

  replaceRangeAsTick(
    session: JeditWorldlineSession,
    input: MutationReplaceRangeAsTickRequest['input'],
  ): ReplaceRangeAsTickExecution;

  createCheckpoint(
    session: JeditWorldlineSession,
    input: MutationCreateCheckpointRequest['input'],
  ): CreateCheckpointExecution;
}

export interface JeditObserverOpticClient {
  worldlineSnapshot(
    session: JeditWorldlineSession,
    frontierRef: string,
    input: QueryWorldlineSnapshotRequest['input'],
  ): WorldlineSnapshotReadingEnvelope;

  textWindow(
    session: JeditWorldlineSession,
    frontierRef: string,
    readBasisHandle: ReadBasisHandle,
    input: TextWindowRangeInput,
  ): TextWindowReadingEnvelope;
}

export interface JeditOpticClient extends JeditMutationOpticClient, JeditObserverOpticClient {}
