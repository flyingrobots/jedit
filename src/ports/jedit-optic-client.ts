import type {
  MutationOperationMap,
  QueryOperationMap,
} from '../generated/jedit/hot-text-runtime.types.generated.js';
import type {
  CreateBufferWorldlineExecution,
  CreateCheckpointExecution,
  JeditWorldlineSession,
  ReplaceRangeAsTickExecution,
} from '../app/jedit-contract-runtime.js';
import type { WorldlineSnapshotReadingEnvelope } from '../app/jedit-observer-runtime.js';
import type { TextWindowReadingEnvelope } from '../app/jedit-observer-runtime.js';

export interface JeditMutationOpticClient {
  createBufferWorldline(
    input: MutationOperationMap['createBufferWorldline']['input'],
  ): CreateBufferWorldlineExecution;

  replaceRangeAsTick(
    session: JeditWorldlineSession,
    input: MutationOperationMap['replaceRangeAsTick']['input'],
  ): ReplaceRangeAsTickExecution;

  createCheckpoint(
    session: JeditWorldlineSession,
    input: MutationOperationMap['createCheckpoint']['input'],
  ): CreateCheckpointExecution;
}

export interface JeditObserverOpticClient {
  worldlineSnapshot(
    session: JeditWorldlineSession,
    frontierRef: string,
    input: QueryOperationMap['worldlineSnapshot']['input'],
  ): WorldlineSnapshotReadingEnvelope;

  textWindow(
    session: JeditWorldlineSession,
    frontierRef: string,
    input: QueryOperationMap['textWindow']['input'],
  ): TextWindowReadingEnvelope;
}

export interface JeditOpticClient extends JeditMutationOpticClient, JeditObserverOpticClient {}
