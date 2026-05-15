import type {
  ApplyIntentResult,
  BufferVersion,
  JeditOpticClient,
  Observed,
  OpticSession,
  ReadBasisHandle,
  ReplaceRangeIntent,
  SessionId,
  TextBuffer,
  TextBufferId,
  TextBufferOptic,
  TextWindowLine,
  TextWindowRangeInput,
  TextWindowReading,
} from '../ports/jedit-optic-client.js';
import { REPLACE_RANGE_INTENT_KIND } from '../ports/jedit-optic-client.js';
import type { JeditWorldlineSession } from './jedit-contract-runtime.js';
import type { TextWindowReadingEnvelope } from './jedit-observer-runtime.js';

const OPTIC_SESSION_ID: SessionId = 'optic-session:0';
const TEXT_BUFFER_ID_PREFIX = 'text-buffer:';
const TEXT_BUFFER_OPTIC_AUTHOR = 'jedit-text-buffer-optic';
const TEXT_BUFFER_OPTIC_FRONTIER_PREFIX = 'frontier:text-buffer-optic:';
const JEDIT_OPTIC_SESSION_CREATED_AT_EPOCH = '1970-01-01T00:00:00.000Z';
const FIRST_TEXT_BUFFER_SEQUENCE = 0;
const FIRST_BUFFER_VERSION: BufferVersion = 0;
const NEXT_BUFFER_VERSION_STEP = 1;
const EMPTY_BYTE_LENGTH = 0;
const TEXT_WINDOW_MIN_LINE_COUNT = 0;

interface CreateTextBufferInput {
  readonly bufferKey: string;
  readonly initialText: string;
  readonly projectionPath?: string | null;
}

interface TextBufferOpticRuntimeState {
  currentSession: JeditWorldlineSession;
  currentReadBasis: ReadBasisHandle;
  bufferVersion: BufferVersion;
}

export class TextBufferOpticError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'TextBufferOpticError';
  }
}

export function createTextBufferOpticSession(client: JeditOpticClient): OpticSession {
  let nextBufferId = FIRST_TEXT_BUFFER_SEQUENCE;
  const optics = new Map<TextBufferId, TextBufferOptic>();

  return {
    sessionId: OPTIC_SESSION_ID,
    async createBuffer(input: CreateTextBufferInput): Promise<TextBufferOptic> {
      const buffer = toTextBuffer(nextBufferId, input);
      nextBufferId += NEXT_BUFFER_VERSION_STEP;
      const opened = client.openTextBuffer({
        bufferKey: input.bufferKey,
        initialText: input.initialText,
        projectionPath: input.projectionPath ?? input.bufferKey,
        createInitialCheckpoint: false,
      });
      const optic = createTextBufferOptic(
        client,
        buffer,
        opened.nextSession,
        opened.readBasisHandle,
      );
      optics.set(buffer.bufferId, optic);
      return optic;
    },
    async getBufferOptic(bufferId: TextBufferId): Promise<TextBufferOptic | null> {
      return optics.get(bufferId) ?? null;
    },
    async listBuffers(): Promise<readonly TextBuffer[]> {
      return Array.from(optics.values(), (optic) => optic.buffer);
    },
  };
}

function createTextBufferOptic(
  client: JeditOpticClient,
  buffer: TextBuffer,
  initialSession: JeditWorldlineSession,
  initialReadBasis: ReadBasisHandle,
): TextBufferOptic {
  const state: TextBufferOpticRuntimeState = {
    currentSession: initialSession,
    currentReadBasis: initialReadBasis,
    bufferVersion: FIRST_BUFFER_VERSION,
  };

  return Object.freeze({
    buffer,
    currentReadBasis(): ReadBasisHandle {
      return state.currentReadBasis;
    },
    async applyIntent(intent: ReplaceRangeIntent): Promise<ApplyIntentResult> {
      return applyTextBufferIntent(client, buffer, state, intent);
    },
    async textWindow(
      readBasis: ReadBasisHandle,
      input: TextWindowRangeInput,
    ): Promise<Observed<TextWindowReading>> {
      return readTextBufferWindow(client, buffer, state, readBasis, input);
    },
  });
}

function applyTextBufferIntent(
  client: JeditOpticClient,
  buffer: TextBuffer,
  state: TextBufferOpticRuntimeState,
  intent: ReplaceRangeIntent,
): ApplyIntentResult {
  if (intent.kind !== REPLACE_RANGE_INTENT_KIND) {
    throw new TextBufferOpticError(`Unsupported text buffer intent: ${intent.kind}.`);
  }
  const execution = client.replaceRangeAsTick(state.currentSession, replaceRangeInput(state, intent));
  if (execution.result == null) {
    throw new TextBufferOpticError('Text buffer intent did not produce a runtime receipt.');
  }
  state.currentSession = execution.nextSession;
  state.bufferVersion += NEXT_BUFFER_VERSION_STEP;
  return {
    buffer,
    readBasis: state.currentReadBasis,
    bufferVersion: state.bufferVersion,
    receiptId: execution.result.receipt.receiptId,
  };
}

function replaceRangeInput(
  state: TextBufferOpticRuntimeState,
  intent: ReplaceRangeIntent,
): Parameters<JeditOpticClient['replaceRangeAsTick']>[1] {
  return {
    worldlineId: state.currentSession.worldline.worldlineId,
    baseHeadId: state.currentSession.worldline.canonicalHeadId,
    startByte: intent.startByte,
    endByte: intent.endByte,
    insertText: intent.insertText,
    author: TEXT_BUFFER_OPTIC_AUTHOR,
  };
}

function readTextBufferWindow(
  client: JeditOpticClient,
  buffer: TextBuffer,
  state: TextBufferOpticRuntimeState,
  readBasis: ReadBasisHandle,
  input: TextWindowRangeInput,
): Observed<TextWindowReading> {
  const envelope = client.textWindow(
    state.currentSession,
    toFrontierRef(buffer.bufferId, state.bufferVersion),
    readBasis,
    input,
  );
  return toObservedTextWindowReading(envelope, input);
}

function toTextBuffer(sequence: number, input: CreateTextBufferInput): TextBuffer {
  return Object.freeze({
    bufferId: `${TEXT_BUFFER_ID_PREFIX}${sequence}`,
    bufferKey: input.bufferKey,
    projectionPath: input.projectionPath ?? null,
    createdAt: JEDIT_OPTIC_SESSION_CREATED_AT_EPOCH,
  });
}

function toObservedTextWindowReading(
  envelope: TextWindowReadingEnvelope,
  input: TextWindowRangeInput,
): Observed<TextWindowReading> {
  const reading: TextWindowReading = {
    readingId: envelope.reading.readingId,
    lines: toTextWindowLines(envelope),
    byteLength: textWindowByteLength(envelope),
    lineCount: envelope.reading.lineCount,
    cursorLine: input.cursorLine,
    viewportLineCount: input.viewportLineCount,
    truncated: textWindowWasTruncated(envelope, input),
  };
  return {
    value: reading,
    evidence: {
      readingId: reading.readingId,
    },
  };
}

function toTextWindowLines(envelope: TextWindowReadingEnvelope): readonly TextWindowLine[] {
  return envelope.reading.lines.map((line) => ({
    lineNumber: line.lineNumber,
    startByte: line.startByte,
    endByte: line.endByte,
    text: line.text,
  }));
}

function textWindowByteLength(envelope: TextWindowReadingEnvelope): number {
  return envelope.reading.lines.reduce(
    (byteLength, line) => byteLength + line.endByte - line.startByte,
    EMPTY_BYTE_LENGTH,
  );
}

function textWindowWasTruncated(
  envelope: TextWindowReadingEnvelope,
  input: TextWindowRangeInput,
): boolean {
  const requestedLineCount = input.beforeLines + input.viewportLineCount + input.afterLines;
  const availableLineCount = Math.max(
    TEXT_WINDOW_MIN_LINE_COUNT,
    envelope.reading.totalLineCount - envelope.reading.startLine,
  );
  return envelope.reading.lineCount < Math.min(requestedLineCount, availableLineCount);
}

function toFrontierRef(bufferId: TextBufferId, bufferVersion: BufferVersion): string {
  return `${TEXT_BUFFER_OPTIC_FRONTIER_PREFIX}${bufferId}:${bufferVersion}`;
}
