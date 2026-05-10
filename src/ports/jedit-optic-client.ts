import type {
  CreateBufferWorldlineRequest,
  CreateCheckpointRequest,
  ReplaceRangeAsTickRequest,
  TextWindowRequest,
  WorldlineSnapshotRequest,
} from '../generated/jedit/hot-text-runtime.wesley.generated.js';
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
    input: CreateBufferWorldlineRequest['input'],
  ): CreateBufferWorldlineExecution;

  replaceRangeAsTick(
    session: JeditWorldlineSession,
    input: ReplaceRangeAsTickRequest['input'],
  ): ReplaceRangeAsTickExecution;

  createCheckpoint(
    session: JeditWorldlineSession,
    input: CreateCheckpointRequest['input'],
  ): CreateCheckpointExecution;
}

export interface JeditObserverOpticClient {
  worldlineSnapshot(
    session: JeditWorldlineSession,
    frontierRef: string,
    input: WorldlineSnapshotRequest['input'],
  ): WorldlineSnapshotReadingEnvelope;

  textWindow(
    session: JeditWorldlineSession,
    frontierRef: string,
    input: TextWindowRequest['input'],
  ): TextWindowReadingEnvelope;
}

export interface JeditOpticClient extends JeditMutationOpticClient, JeditObserverOpticClient {}
