import type { HotTextRuntimePort } from '../ports/hot-text-runtime.js';
import {
  READ_BASIS_HANDLE_KIND,
  type JeditOpticClient,
  type OpenTextBufferExecution,
  type ReadBasisHandle,
  type TextWindowRangeInput,
} from '../ports/jedit-optic-client.js';
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
const READ_BASIS_HANDLE_ID_PREFIX = 'text-buffer:';

// Until Wesley emits direct intent/observer clients, keep one narrow seam where
// generated GraphQL operation names are transmuted into app-owned runtime calls.
export function createInMemoryJeditOpticClient(runtime: HotTextRuntimePort): JeditOpticClient {
  return {
    openTextBuffer(input: CreateBufferWorldlineInput): OpenTextBufferExecution {
      const execution = createBufferWorldline(runtime, input);
      return {
        ...execution,
        readBasisHandle: createReadBasisHandle(execution.nextSession),
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
        toTextWindowInput(session, readBasisHandle, input),
      );
    },
  };
}

function createReadBasisHandle(session: JeditWorldlineSession): ReadBasisHandle {
  return Object.freeze({
    kind: READ_BASIS_HANDLE_KIND,
    id: `${READ_BASIS_HANDLE_ID_PREFIX}${session.worldline.bufferKey}`,
  });
}

function toTextWindowInput(
  session: JeditWorldlineSession,
  readBasisHandle: ReadBasisHandle,
  input: TextWindowRangeInput,
): TextWindowInput {
  return {
    ...input,
    worldlineId: resolveReadBasisWorldlineId(session, readBasisHandle),
  };
}

function resolveReadBasisWorldlineId(
  session: JeditWorldlineSession,
  readBasisHandle: ReadBasisHandle,
): string {
  const expected = createReadBasisHandle(session);
  if (readBasisHandle.kind !== READ_BASIS_HANDLE_KIND || readBasisHandle.id !== expected.id) {
    throw new Error('ReadBasisHandle does not belong to the supplied jedit session.');
  }
  return session.worldline.worldlineId;
}
