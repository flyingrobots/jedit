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
  type JeditWorldlineSession,
} from './jedit-contract-runtime.js';
import {
  readWorldlineSnapshotWithObserverPlan,
  readTextWindowWithObserverPlan,
} from './jedit-observer-runtime.js';
import type {
  MutationOperationMap,
  QueryOperationMap,
} from '../generated/jedit/rope.types.generated.js';

type CreateBufferWorldlineInput = MutationOperationMap['createBufferWorldline']['input'];
type TextWindowInput = QueryOperationMap['textWindow']['input'];

// Until Wesley emits direct intent/observer clients, keep one narrow seam where
// generated GraphQL operation names are transmuted into app-owned runtime calls.
export function createInMemoryJeditOpticClient(runtime: HotTextRuntimePort, hash: HashPort): JeditOpticClient {
  const readBasisHandles = new ReadBasisHandleRegistry();
  return {
    openTextBuffer: async (input) => openTextBuffer(runtime, hash, readBasisHandles, input),
    createBufferWorldline: async (input) => createBufferWorldline(runtime, input, hash),
    replaceRangeAsTick: async (session, input) => replaceRangeAsTick(runtime, session, input, hash),
    createCheckpoint: async (session, input) => createCheckpoint(runtime, session, input, hash),
    worldlineSnapshot: async (session, frontierRef, input) => readWorldlineSnapshotWithObserverPlan(runtime, session, frontierRef, input, hash),
    textWindow: async (session, frontierRef, readBasisHandle, input) => readTextWindowWithObserverPlan(
      runtime,
      session,
      frontierRef,
      toTextWindowInput(readBasisHandles, session, readBasisHandle, input),
      hash,
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
  input: TextWindowRangeInput,
): TextWindowInput {
  return {
    ...input,
    worldlineId: readBasisHandles.resolveWorldlineId(session, readBasisHandle),
  };
}
