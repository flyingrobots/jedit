import type {
  MutationCreateBufferWorldlineRequest,
  MutationCreateCheckpointRequest,
  MutationReplaceRangeAsTickRequest,
  QueryWorldlineSnapshotRequest,
} from '../generated/jedit/rope.wesley.generated.js';
import type {
  CreateBufferWorldlineExecution,
  CreateCheckpointExecution,
  JeditWorldlineSession,
  ReplaceRangeAsTickExecution,
} from '../app/jedit-contract-runtime.js';
import type { WorldlineSnapshotReadingEnvelope } from '../app/jedit-observer-runtime.js';
import type { TextWindowReadingEnvelope } from '../app/jedit-observer-runtime.js';
import type { ReadBasisHandle, TextWindowRangeInput } from './text-buffer-session.js';
export type {
  ApplyIntentResult,
  BufferKey,
  BufferVersion,
  CreateTextBufferRequest,
  Observed,
  ReadBasisHandle,
  ReadingId,
  ReplaceRangeIntent,
  SessionId,
  TextBuffer,
  TextBufferId,
  TextBufferOptic,
  TextBufferSessionPort,
  TextWindowLine,
  TextWindowRangeInput,
  TextWindowReading,
} from './text-buffer-session.js';
export { READ_BASIS_HANDLE_KIND, REPLACE_RANGE_INTENT_KIND } from './text-buffer-session.js';

export interface OpenTextBufferExecution extends CreateBufferWorldlineExecution {
  readonly readBasisHandle: ReadBasisHandle;
}

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
