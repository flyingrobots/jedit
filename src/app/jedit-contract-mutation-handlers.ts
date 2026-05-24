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
import { publishJeditContractSessionFacts } from './jedit-contract-state-port.js';
import {
  JEDIT_HOT_TEXT_MUTATION_OPERATION_NAMES,
  type JeditHotTextRequiredMutationOperationNames,
} from './jedit-contract-package.js';
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
import type { JeditContractStatePort } from '../ports/jedit-contract-state-port.js';

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
  readonly statePort?: JeditContractStatePort;
}

export interface JeditContractMutationHandlerRegistry {
  readonly mutationOperationNames: JeditHotTextRequiredMutationOperationNames;
  executeCreateBufferWorldlineMutation(
    request: JeditCreateBufferWorldlineMutationRequest,
  ): CreateBufferWorldlineExecution;
  executeReplaceRangeAsTickMutation(
    request: JeditReplaceRangeAsTickMutationRequest,
  ): ReplaceRangeAsTickExecution;
  executeCreateCheckpointMutation(
    request: JeditCreateCheckpointMutationRequest,
  ): CreateCheckpointExecution;
  executeMutation(
    request: JeditContractMutationHandlerRequest,
  ): JeditContractMutationHandlerResult;
}

export function createJeditContractMutationHandlerRegistry(
  options: JeditContractMutationHandlerRegistryOptions,
): JeditContractMutationHandlerRegistry {
  return Object.freeze({
    mutationOperationNames: JEDIT_HOT_TEXT_MUTATION_OPERATION_NAMES,
    executeCreateBufferWorldlineMutation(
      request: JeditCreateBufferWorldlineMutationRequest,
    ): CreateBufferWorldlineExecution {
      return executeCreateBufferWorldlineMutation(options, request);
    },
    executeReplaceRangeAsTickMutation(
      request: JeditReplaceRangeAsTickMutationRequest,
    ): ReplaceRangeAsTickExecution {
      return executeReplaceRangeAsTickMutation(options, request);
    },
    executeCreateCheckpointMutation(
      request: JeditCreateCheckpointMutationRequest,
    ): CreateCheckpointExecution {
      return executeCreateCheckpointMutation(options, request);
    },
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
      return executeCreateBufferWorldlineMutation(options, request);
    case mutationReplaceRangeAsTickOperation.fieldName:
      return executeReplaceRangeAsTickMutation(options, request);
    case mutationCreateCheckpointOperation.fieldName:
      return executeCreateCheckpointMutation(options, request);
  }
}

function executeCreateBufferWorldlineMutation(
  options: JeditContractMutationHandlerRegistryOptions,
  request: JeditCreateBufferWorldlineMutationRequest,
): CreateBufferWorldlineExecution {
  return publishExecution(options, createBufferWorldline(options.runtime, request.input, options.hash));
}

function executeReplaceRangeAsTickMutation(
  options: JeditContractMutationHandlerRegistryOptions,
  request: JeditReplaceRangeAsTickMutationRequest,
): ReplaceRangeAsTickExecution {
  return publishExecution(options, replaceRangeAsTick(
    options.runtime,
    request.session,
    request.input,
    options.hash,
  ));
}

function executeCreateCheckpointMutation(
  options: JeditContractMutationHandlerRegistryOptions,
  request: JeditCreateCheckpointMutationRequest,
): CreateCheckpointExecution {
  return publishExecution(options, createCheckpoint(
    options.runtime,
    request.session,
    request.input,
    options.hash,
  ));
}

function publishExecution<
  Execution extends JeditContractMutationHandlerResult,
>(
  options: JeditContractMutationHandlerRegistryOptions,
  execution: Execution,
): Execution {
  if (options.statePort != null) {
    publishJeditContractSessionFacts(options.statePort, execution.nextSession, options.hash);
  }

  return execution;
}
