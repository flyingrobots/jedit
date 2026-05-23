import type {
  JeditContractMutationHandlerRegistry,
  JeditContractMutationHandlerRequest,
  JeditContractMutationHandlerResult,
} from './jedit-contract-mutation-handlers.js';

export const JEDIT_HANDLER_INVOCATION_AUTHORITY_SCHEDULER = 'ECHO_SCHEDULER';
export const JEDIT_HANDLER_INVOCATION_AUTHORITY_APPLICATION = 'APPLICATION';
export const JEDIT_HANDLER_INVOCATION_STATUS_INVOKED = 'INVOKED';
export const JEDIT_HANDLER_INVOCATION_STATUS_BLOCKED = 'BLOCKED';
export const JEDIT_HANDLER_INVOCATION_BLOCKED_CODE = 'JEDIT_HANDLER_INVOCATION_REQUIRES_SCHEDULER';

export type JeditHandlerInvocationAuthority =
  | typeof JEDIT_HANDLER_INVOCATION_AUTHORITY_SCHEDULER
  | typeof JEDIT_HANDLER_INVOCATION_AUTHORITY_APPLICATION;

export type JeditHandlerInvocationOutcome =
  | JeditHandlerInvocationInvoked
  | JeditHandlerInvocationBlocked;

export interface JeditHandlerInvocationRequest {
  readonly authority: JeditHandlerInvocationAuthority;
  readonly mutation: JeditContractMutationHandlerRequest;
}

export interface JeditHandlerInvocationInvoked {
  readonly status: typeof JEDIT_HANDLER_INVOCATION_STATUS_INVOKED;
  readonly result: JeditContractMutationHandlerResult;
}

export interface JeditHandlerInvocationBlocked {
  readonly status: typeof JEDIT_HANDLER_INVOCATION_STATUS_BLOCKED;
  readonly obstruction: JeditHandlerInvocationObstruction;
}

export interface JeditHandlerInvocationObstruction {
  readonly code: typeof JEDIT_HANDLER_INVOCATION_BLOCKED_CODE;
  readonly message: string;
}

export function invokeJeditMutationHandler(
  registry: JeditContractMutationHandlerRegistry,
  request: JeditHandlerInvocationRequest,
): JeditHandlerInvocationOutcome {
  if (request.authority !== JEDIT_HANDLER_INVOCATION_AUTHORITY_SCHEDULER) {
    return blockedInvocation();
  }

  return {
    status: JEDIT_HANDLER_INVOCATION_STATUS_INVOKED,
    result: registry.executeMutation(request.mutation),
  };
}

function blockedInvocation(): JeditHandlerInvocationBlocked {
  return {
    status: JEDIT_HANDLER_INVOCATION_STATUS_BLOCKED,
    obstruction: {
      code: JEDIT_HANDLER_INVOCATION_BLOCKED_CODE,
      message: JEDIT_HANDLER_INVOCATION_BLOCKED_CODE,
    },
  };
}
