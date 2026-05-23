import type {
  CreateBufferWorldlineExecution,
  CreateCheckpointExecution,
  JeditWorldlineSession,
  ReplaceRangeAsTickExecution,
} from './jedit-contract-runtime.js';
import {
  createBufferWorldline,
  createCheckpoint,
  replaceRangeAsTick,
} from './jedit-contract-runtime.js';
import type {
  MutationOperationMap,
} from '../generated/jedit/hot-text-runtime.types.generated.js';
import {
  mutationCreateBufferWorldlineOperation,
  mutationCreateCheckpointOperation,
  mutationReplaceRangeAsTickOperation,
} from '../generated/jedit/hot-text-runtime.wesley.generated.js';
import type { HashPort } from '../ports/hash.js';
import type { HotTextRuntimePort } from '../ports/hot-text-runtime.js';

type CreateBufferWorldlineInput = MutationOperationMap['createBufferWorldline']['input'];
type ReplaceRangeAsTickInput = MutationOperationMap['replaceRangeAsTick']['input'];
type CreateCheckpointInput = MutationOperationMap['createCheckpoint']['input'];

export type JeditContractMutationHandlerRequest =
  | JeditCreateBufferWorldlineMutationRequest
  | JeditReplaceRangeAsTickMutationRequest
  | JeditCreateCheckpointMutationRequest;

export type JeditContractMutationHandlerResult =
  | CreateBufferWorldlineExecution
  | ReplaceRangeAsTickExecution
  | CreateCheckpointExecution;

export interface JeditCreateBufferWorldlineMutationRequest {
  readonly operationName: typeof mutationCreateBufferWorldlineOperation.fieldName;
  readonly input: CreateBufferWorldlineInput;
}

export interface JeditReplaceRangeAsTickMutationRequest {
  readonly operationName: typeof mutationReplaceRangeAsTickOperation.fieldName;
  readonly session: JeditWorldlineSession;
  readonly input: ReplaceRangeAsTickInput;
}

export interface JeditCreateCheckpointMutationRequest {
  readonly operationName: typeof mutationCreateCheckpointOperation.fieldName;
  readonly session: JeditWorldlineSession;
  readonly input: CreateCheckpointInput;
}

export interface JeditContractMutationHandlerRegistryOptions {
  readonly runtime: HotTextRuntimePort;
  readonly hash: HashPort;
}

export interface JeditContractMutationHandlerRegistry {
  readonly mutationOperationNames: readonly string[];
  executeMutation(
    request: JeditContractMutationHandlerRequest,
  ): JeditContractMutationHandlerResult;
}

export function createJeditContractMutationHandlerRegistry(
  options: JeditContractMutationHandlerRegistryOptions,
): JeditContractMutationHandlerRegistry {
  return Object.freeze({
    mutationOperationNames: Object.freeze([
      mutationCreateBufferWorldlineOperation.fieldName,
      mutationReplaceRangeAsTickOperation.fieldName,
      mutationCreateCheckpointOperation.fieldName,
    ]),
    executeMutation(
      request: JeditContractMutationHandlerRequest,
    ): JeditContractMutationHandlerResult {
      return executeJeditMutation(options, request);
    },
  });
}

function executeJeditMutation(
  options: JeditContractMutationHandlerRegistryOptions,
  request: JeditContractMutationHandlerRequest,
): JeditContractMutationHandlerResult {
  switch (request.operationName) {
    case mutationCreateBufferWorldlineOperation.fieldName:
      return createBufferWorldline(options.runtime, request.input, options.hash);
    case mutationReplaceRangeAsTickOperation.fieldName:
      return replaceRangeAsTick(
        options.runtime,
        request.session,
        request.input,
        options.hash,
      );
    case mutationCreateCheckpointOperation.fieldName:
      return createCheckpoint(
        options.runtime,
        request.session,
        request.input,
        options.hash,
      );
  }
}
