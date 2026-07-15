import type { HotTextRuntimePort } from '../ports/hot-text-runtime.js';
import type { HashPort } from '../ports/hash.js';
import {
  type JeditOpticClient,
  type OpenTextBufferExecution,
  type ReadBasisHandle,
  type TextWindowRequest,
} from '../ports/jedit-optic-client.js';
import { ReadBasisHandleRegistry } from './read-basis-handle-registry.js';
import {
  createBufferWorldline,
  createCheckpoint,
  replaceRangeAsTick,
  type JeditWorldlineSession,
} from './jedit-contract-runtime.js';
import {
  createJeditTextWindowObserver,
  readWorldlineSnapshotWithObserverPlan,
} from './jedit-observer-runtime.js';
import type {
  MutationOperationMap,
  QueryOperationMap,
} from '../generated/jedit/rope.types.generated.js';
import { serializeJeditTextWindowInput } from './jedit-text-window-input.js';

type CreateBufferWorldlineInput = MutationOperationMap['createBufferWorldline']['input'];

// Until Wesley emits direct intent/observer clients, keep one narrow seam where
// generated GraphQL operation names are transmuted into app-owned runtime calls.
export function createInMemoryJeditOpticClient(runtime: HotTextRuntimePort, hash: HashPort): JeditOpticClient {
  const readBasisHandles = new ReadBasisHandleRegistry();
  const textWindowObserver = createJeditTextWindowObserver(runtime, hash);
  return {
    openTextBuffer: async (input) => openTextBuffer(runtime, hash, readBasisHandles, input),
    createBufferWorldline: async (input) => createBufferWorldline(runtime, input, hash),
    replaceRangeAsTick: async (session, input) => replaceRangeAsTick(runtime, session, input, hash),
    createCheckpoint: async (session, input) => createCheckpoint(runtime, session, input, hash),
    worldlineSnapshot: async (session, frontierRef, input) => readWorldlineSnapshotWithObserverPlan(runtime, session, frontierRef, input, hash),
    textWindow: async (session, frontierRef, readBasisHandle, request) => textWindowObserver.read(
      session,
      frontierRef,
      toTextWindowInput(readBasisHandles, session, readBasisHandle, request),
    ),
    requestRunUntilIdle: async () => {
      await Promise.resolve();
    },
  };
}

function openTextBuffer(
  runtime: HotTextRuntimePort,
  hash: HashPort,
  readBasisHandles: ReadBasisHandleRegistry,
  input: CreateBufferWorldlineInput,
): OpenTextBufferExecution {
  const execution = createBufferWorldline(runtime, input, hash);
  return {
    ...execution,
    readBasisHandle: readBasisHandles.createForSession(execution.nextSession),
  };
}

function toTextWindowInput(
  readBasisHandles: ReadBasisHandleRegistry,
  session: JeditWorldlineSession,
  readBasisHandle: ReadBasisHandle,
  request: TextWindowRequest,
): QueryOperationMap['textWindow']['input'] {
  return serializeJeditTextWindowInput(
    readBasisHandles.resolveWorldlineId(session, readBasisHandle),
    request,
  );
}
