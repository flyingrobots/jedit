import type { HotTextRuntimePort } from '../ports/hot-text-runtime.js';
import type { JeditOpticClient } from '../ports/jedit-optic-client.js';
import type { HashPort } from '../ports/hash.js';
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
  MutationCreateBufferWorldlineRequest,
  MutationCreateCheckpointRequest,
  MutationReplaceRangeAsTickRequest,
  QueryTextWindowRequest,
  QueryWorldlineSnapshotRequest,
} from '../generated/jedit/hot-text-runtime.wesley.generated.js';

type CreateBufferWorldlineInput = MutationCreateBufferWorldlineRequest['input'];
type ReplaceRangeAsTickInput = MutationReplaceRangeAsTickRequest['input'];
type CreateCheckpointInput = MutationCreateCheckpointRequest['input'];
type WorldlineSnapshotInput = QueryWorldlineSnapshotRequest['input'];
type TextWindowInput = QueryTextWindowRequest['input'];

// Until Wesley emits direct intent/observer clients, keep one narrow seam where
// generated GraphQL operation names are transmuted into app-owned runtime calls.
export function createInMemoryJeditOpticClient(runtime: HotTextRuntimePort, hash: HashPort): JeditOpticClient {
  return {
    createBufferWorldline(input: CreateBufferWorldlineInput): CreateBufferWorldlineExecution {
      return createBufferWorldline(runtime, input, hash);
    },
    replaceRangeAsTick(
      session: JeditWorldlineSession,
      input: ReplaceRangeAsTickInput,
    ): ReplaceRangeAsTickExecution {
      return replaceRangeAsTick(runtime, session, input, hash);
    },
    createCheckpoint(
      session: JeditWorldlineSession,
      input: CreateCheckpointInput,
    ): CreateCheckpointExecution {
      return createCheckpoint(runtime, session, input, hash);
    },
    worldlineSnapshot(
      session: JeditWorldlineSession,
      frontierRef: string,
      input: WorldlineSnapshotInput,
    ): WorldlineSnapshotReadingEnvelope {
      return readWorldlineSnapshotWithObserverPlan(runtime, session, frontierRef, input, hash);
    },
    textWindow(
      session: JeditWorldlineSession,
      frontierRef: string,
      input: TextWindowInput,
    ): TextWindowReadingEnvelope {
      return readTextWindowWithObserverPlan(runtime, session, frontierRef, input, hash);
    },
  };
}
