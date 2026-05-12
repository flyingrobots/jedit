import type { HotTextRuntimePort } from '../ports/hot-text-runtime.js';
import type { HashPort } from '../ports/hash.js';
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
  MutationOperationMap,
  QueryOperationMap,
} from '../generated/jedit/hot-text-runtime.types.generated.js';

type CreateBufferWorldlineInput = MutationOperationMap['createBufferWorldline']['input'];
type ReplaceRangeAsTickInput = MutationOperationMap['replaceRangeAsTick']['input'];
type CreateCheckpointInput = MutationOperationMap['createCheckpoint']['input'];
type WorldlineSnapshotInput = QueryOperationMap['worldlineSnapshot']['input'];
type TextWindowInput = QueryOperationMap['textWindow']['input'];

// Until Wesley emits direct intent/observer clients, keep one narrow seam where
// generated GraphQL operation names are transmuted into app-owned runtime calls.
export function createInMemoryJeditOpticClient(runtime: HotTextRuntimePort, hash: HashPort): JeditOpticClient {
  const readBasisHandles = new ReadBasisHandleRegistry();
  return {
    openTextBuffer(input: CreateBufferWorldlineInput): OpenTextBufferExecution {
      const execution = createBufferWorldline(runtime, input, hash);
      return {
        ...execution,
        readBasisHandle: readBasisHandles.createForSession(execution.nextSession),
      };
    },
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
      readBasisHandle: ReadBasisHandle,
      input: TextWindowRangeInput,
    ): TextWindowReadingEnvelope {
      return readTextWindowWithObserverPlan(
        runtime,
        session,
        frontierRef,
        toTextWindowInput(readBasisHandles, session, readBasisHandle, input),
        hash,
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
