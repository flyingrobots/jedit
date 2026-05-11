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
