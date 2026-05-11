import type { HotTextRuntimePort } from '../ports/hot-text-runtime.js';
import {
  type JeditOpticClient,
  type OpenTextBufferExecution,
  type ReadBasisHandle,
  type TextWindowRangeInput,
} from '../ports/jedit-optic-client.js';
import { ReadBasisHandleRegistry } from './read-basis-handle-registry.js';
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
export function createInMemoryJeditOpticClient(runtime: HotTextRuntimePort): JeditOpticClient {
  const readBasisHandles = new ReadBasisHandleRegistry();
  return {
    openTextBuffer(input: CreateBufferWorldlineInput): OpenTextBufferExecution {
      const execution = createBufferWorldline(runtime, input);
      return {
        ...execution,
        readBasisHandle: readBasisHandles.createForSession(execution.nextSession),
      };
    },
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
      readBasisHandle: ReadBasisHandle,
      input: TextWindowRangeInput,
    ): TextWindowReadingEnvelope {
      return readTextWindowWithObserverPlan(
        runtime,
        session,
        frontierRef,
        toTextWindowInput(readBasisHandles, session, readBasisHandle, input),
      );
    },
  };
}

function toTextWindowInput(
  readBasisHandles: ReadBasisHandleRegistry,
  session: JeditWorldlineSession,
  readBasisHandle: ReadBasisHandle,
  input: TextWindowRangeInput,
): TextWindowInput {
  return {
    ...input,
    worldlineId: readBasisHandles.resolveWorldlineId(session, readBasisHandle),
  };
}
