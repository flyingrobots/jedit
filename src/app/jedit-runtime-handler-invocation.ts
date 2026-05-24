import type {
  JeditContractMutationHandlerRegistry,
  JeditContractMutationHandlerRequest,
  JeditContractMutationHandlerResult,
} from './jedit-contract-mutation-handlers.js';

export const JEDIT_HANDLER_INVOCATION_AUTHORITY_SCHEDULER = 'ECHO_SCHEDULER';
export const JEDIT_HANDLER_INVOCATION_AUTHORITY_APPLICATION = 'APPLICATION';
export const JEDIT_HANDLER_INVOCATION_AUTHORITY_KIND = 'jedit-handler-invocation-authority';
export const JEDIT_HANDLER_INVOCATION_STATUS_INVOKED = 'INVOKED';
export const JEDIT_HANDLER_INVOCATION_STATUS_BLOCKED = 'BLOCKED';
export const JEDIT_HANDLER_INVOCATION_BLOCKED_CODE = 'JEDIT_HANDLER_INVOCATION_REQUIRES_SCHEDULER';

export const JEDIT_HANDLER_INVOCATION_SCHEDULER_AUTHORITY = Object.freeze({
  kind: JEDIT_HANDLER_INVOCATION_AUTHORITY_KIND,
  label: JEDIT_HANDLER_INVOCATION_AUTHORITY_SCHEDULER,
});
export const JEDIT_HANDLER_INVOCATION_APPLICATION_AUTHORITY = Object.freeze({
  kind: JEDIT_HANDLER_INVOCATION_AUTHORITY_KIND,
  label: JEDIT_HANDLER_INVOCATION_AUTHORITY_APPLICATION,
});

export type JeditHandlerInvocationAuthority =
  | typeof JEDIT_HANDLER_INVOCATION_SCHEDULER_AUTHORITY
  | typeof JEDIT_HANDLER_INVOCATION_APPLICATION_AUTHORITY;

export type JeditHandlerInvocationOutcome =
  | JeditHandlerInvocationInvoked<JeditContractMutationHandlerResult>
  | JeditHandlerInvocationBlocked;

export type JeditHandlerInvocationCallOutcome<Result> =
  | JeditHandlerInvocationInvoked<Result>
  | JeditHandlerInvocationBlocked;

export interface JeditHandlerInvocationRequest {
  readonly authority: JeditHandlerInvocationAuthority;
  readonly mutation: JeditContractMutationHandlerRequest;
}

export interface JeditHandlerInvocationCall<Result> {
  readonly authority: JeditHandlerInvocationAuthority;
  invokeHandler(registry: JeditContractMutationHandlerRegistry): Result;
}

export interface JeditHandlerInvocationSink {
  recordHandlerInvocationAuthority(authority: JeditHandlerInvocationAuthority): void;
}

export interface JeditHandlerInvocationInvoked<Result> {
  readonly status: typeof JEDIT_HANDLER_INVOCATION_STATUS_INVOKED;
  readonly result: Result;
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
  return invokeJeditHandlerWithAuthority(registry, {
    authority: request.authority,
    invokeHandler(targetRegistry) {
      return targetRegistry.executeMutation(request.mutation);
    },
  });
}

export function invokeJeditHandlerWithAuthority<Result>(
  registry: JeditContractMutationHandlerRegistry,
  request: JeditHandlerInvocationCall<Result>,
): JeditHandlerInvocationCallOutcome<Result> {
  if (!isSchedulerAuthority(request.authority)) {
    return blockedInvocation();
  }

  return {
    status: JEDIT_HANDLER_INVOCATION_STATUS_INVOKED,
    result: request.invokeHandler(registry),
  };
}

function isSchedulerAuthority(authority: JeditHandlerInvocationAuthority): boolean {
  return authority === JEDIT_HANDLER_INVOCATION_SCHEDULER_AUTHORITY;
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
