import type { HotTextRuntimePort } from '../ports/hot-text-runtime.js';
import type { JeditOpticClient } from '../ports/jedit-optic-client.js';
import {
  createBufferWorldline,
  createCheckpoint,
  replaceRangeAsTick,
  type CreateBufferWorldlineExecution,
  type CreateCheckpointExecution,
  type JeditWorldlineSession,
  type ReplaceRangeAsTickExecution,
} from './jedit-contract-runtime.js';
import {
  readWorldlineSnapshotWithObserverPlan,
  readTextWindowWithObserverPlan,
  type TextWindowReadingEnvelope,
  type WorldlineSnapshotReadingEnvelope,
} from './jedit-observer-runtime.js';
import type {
  CreateBufferWorldlineRequest,
  CreateCheckpointRequest,
  ReplaceRangeAsTickRequest,
  TextWindowRequest,
  WorldlineSnapshotRequest,
} from '../generated/jedit/hot-text-runtime.wesley.generated.js';

type CreateBufferWorldlineInput = CreateBufferWorldlineRequest['input'];
type ReplaceRangeAsTickInput = ReplaceRangeAsTickRequest['input'];
type CreateCheckpointInput = CreateCheckpointRequest['input'];
type WorldlineSnapshotInput = WorldlineSnapshotRequest['input'];
type TextWindowInput = TextWindowRequest['input'];

// Until Wesley emits direct intent/observer clients, keep one narrow seam where
// generated GraphQL operation names are transmuted into app-owned runtime calls.
export function createInMemoryJeditOpticClient(runtime: HotTextRuntimePort): JeditOpticClient {
  return {
    createBufferWorldline(input: CreateBufferWorldlineInput): CreateBufferWorldlineExecution {
      return createBufferWorldline(runtime, input);
    },
    replaceRangeAsTick(
      session: JeditWorldlineSession,
      input: ReplaceRangeAsTickInput,
    ): ReplaceRangeAsTickExecution {
      return replaceRangeAsTick(runtime, session, input);
    },
    createCheckpoint(
      session: JeditWorldlineSession,
      input: CreateCheckpointInput,
    ): CreateCheckpointExecution {
      return createCheckpoint(runtime, session, input);
    },
    worldlineSnapshot(
      session: JeditWorldlineSession,
      frontierRef: string,
      input: WorldlineSnapshotInput,
    ): WorldlineSnapshotReadingEnvelope {
      return readWorldlineSnapshotWithObserverPlan(runtime, session, frontierRef, input);
    },
    textWindow(
      session: JeditWorldlineSession,
      frontierRef: string,
      input: TextWindowInput,
    ): TextWindowReadingEnvelope {
      return readTextWindowWithObserverPlan(runtime, session, frontierRef, input);
    },
  };
}
