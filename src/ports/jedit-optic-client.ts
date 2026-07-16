import type {
  MutationCreateBufferWorldlineRequest,
  MutationCreateCheckpointRequest,
  MutationReplaceRangeAsTickRequest,
  QueryCausalLineDiffRequest,
  QueryWhyRangeRequest,
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
import type { CausalLineDiffReadingEnvelope } from '../app/jedit-causal-line-diff-observer.js';
import type { WhyRangeReadingEnvelope } from '../app/jedit-why-range-observer.js';
import type { ReadBasisHandle, TextWindowRequest } from './text-buffer-session.js';
export type {
  ApplyIntentResult,
  BufferKey,
  BufferVersion,
  CausalLineDiffReading,
  CausalLineDiffRequest,
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
  TextWindowBasis,
  TextWindowRangeInput,
  TextWindowRequest,
  TextWindowReading,
} from './text-buffer-session.js';
export { READ_BASIS_HANDLE_KIND, REPLACE_RANGE_INTENT_KIND } from './text-buffer-session.js';

export interface OpenTextBufferExecution extends CreateBufferWorldlineExecution {
  readonly readBasisHandle: ReadBasisHandle;
}

export interface JeditMutationOpticClient {
  openTextBuffer(
    input: MutationCreateBufferWorldlineRequest['input'],
  ): Promise<OpenTextBufferExecution>;

  createBufferWorldline(
    input: MutationCreateBufferWorldlineRequest['input'],
  ): Promise<CreateBufferWorldlineExecution>;

  replaceRangeAsTick(
    session: JeditWorldlineSession,
    input: MutationReplaceRangeAsTickRequest['input'],
  ): Promise<ReplaceRangeAsTickExecution>;

  createCheckpoint(
    session: JeditWorldlineSession,
    input: MutationCreateCheckpointRequest['input'],
  ): Promise<CreateCheckpointExecution>;
}

export interface JeditObserverOpticClient {
  causalLineDiff(
    session: JeditWorldlineSession,
    frontierRef: string,
    input: QueryCausalLineDiffRequest['input'],
  ): Promise<CausalLineDiffReadingEnvelope>;

  whyRange(
    session: JeditWorldlineSession,
    frontierRef: string,
    input: QueryWhyRangeRequest['input'],
  ): Promise<WhyRangeReadingEnvelope>;

  worldlineSnapshot(
    session: JeditWorldlineSession,
    frontierRef: string,
    input: QueryWorldlineSnapshotRequest['input'],
  ): Promise<WorldlineSnapshotReadingEnvelope>;

  textWindow(
    session: JeditWorldlineSession,
    frontierRef: string,
    readBasisHandle: ReadBasisHandle,
    request: TextWindowRequest,
  ): Promise<TextWindowReadingEnvelope>;
}

export interface JeditOpticClientLifecycle {
  requestRunUntilIdle(): Promise<void>;
}

export interface JeditOpticClient
  extends JeditMutationOpticClient,
    JeditObserverOpticClient,
    JeditOpticClientLifecycle {}
