import {
  createJeditContractMutationHandlerRegistry,
} from '../app/jedit-contract-mutation-handlers.js';
import {
  createJeditContractQueryObserverRegistry,
} from '../app/jedit-contract-query-observers.js';
import { JEDIT_HOT_TEXT_PACKAGE_ID } from '../app/jedit-contract-package.js';
import {
  createInMemoryJeditContractStatePort,
  JeditContractStatePortError,
} from '../app/jedit-contract-state-port.js';
import {
  createInMemoryJeditSubmissionLedgerPort,
  createJeditSubmissionId,
  recordAcceptedJeditSubmission,
} from '../app/jedit-submission-ledger.js';
import { createInMemoryJeditTicketedWorkPort } from '../app/jedit-ticketed-work-boundary.js';
import {
  invokeJeditHandlerWithAuthority,
  JEDIT_HANDLER_INVOCATION_AUTHORITY_SCHEDULER,
  JEDIT_HANDLER_INVOCATION_STATUS_BLOCKED,
  type JeditHandlerInvocationSink,
} from '../app/jedit-runtime-handler-invocation.js';
import { createInMemoryHotTextRuntime } from './in-memory-hot-text-runtime.js';
import {
  installJeditContractPackage,
} from './jedit-echo-contract-package-installer.js';
import {
  ECHO_CONTRACT_PACKAGE_INSTALL_INSTALLED,
  type EchoContractPackageHostPort,
  type EchoContractPackageInstallRequest,
} from '../ports/echo-contract-package-host.js';
import type { EchoKernelInfo, EchoWasmKernelTransport } from '../ports/echo-kernel-transport.js';
import type { HashPort } from '../ports/hash.js';
import type { HotTextRuntimePort } from '../ports/hot-text-runtime.js';
import type { JeditContractStatePort } from '../ports/jedit-contract-state-port.js';
import type { JeditSubmissionLedgerPort } from '../ports/jedit-submission-ledger.js';
import {
  JEDIT_TICKETED_WORK_AVAILABLE,
  type JeditTicketedWorkPort,
  type JeditTicketedWorkResult,
} from '../ports/jedit-ticketed-work-boundary.js';
import {
  createJeditRuntimeWorkEnvelope,
  JEDIT_RUNTIME_WORK_OPERATION_KIND_MUTATION,
  type JeditRuntimeWorkSink,
} from '../ports/jedit-runtime-work-envelope.js';
import { createHashPort } from './hash.js';
import {
  CREATE_BUFFER_WORLDLINE_OPERATION,
  CREATE_CHECKPOINT_OPERATION,
  decodeJeditIntentRequest,
  decodeJeditObserveRequest,
  encodeJeditIntentResponse,
  encodeJeditObserveResponse,
  encodeJeditSchedulerStatus,
  JEDIT_SCHEDULER_STATUS_KIND,
  JEDIT_TRANSPORT_STATUS_OBSTRUCTED,
  JEDIT_TRANSPORT_STATUS_OK,
  REPLACE_RANGE_AS_TICK_OPERATION,
  TEXT_WINDOW_OPERATION,
  WORLDLINE_SNAPSHOT_OPERATION,
  type JeditIntentRequest,
  type JeditIntentResponse,
  type JeditObserveRequest,
  type JeditObserveResponse,
  type JeditTransportObstruction,
} from './jedit-echo-optic-codec.js';

const INSTALLED_CONTRACT_MODULE_SPECIFIER = 'installed:jedit-hot-text-runtime';
const INSTALLED_CONTRACT_CODEC_ID = 'jedit.installed-contract+json';
const INSTALLED_CONTRACT_REGISTRY_VERSION = 'jedit-installed-contract-v1';
const INSTALLED_CONTRACT_SCHEMA_SHA256_HEX = 'jedit-installed-contract-schema';
const INSTALLED_CONTRACT_HOST = 'installed-jedit-contract';
const SCHEDULER_STATE_IDLE = 'IDLE';
const PACKAGE_NOT_INSTALLED_CODE = 'JEDIT_PACKAGE_NOT_INSTALLED';
const PACKAGE_NOT_INSTALLED_RECOVERY = 'install package through trusted host';
const STATE_MISSING_RECOVERY = 'publish jedit contract state before observing';

export interface InstalledJeditContractEchoTransportOptions {
  readonly runtime?: HotTextRuntimePort;
  readonly hash?: HashPort;
  readonly moduleSpecifier?: string;
  readonly workSink?: JeditRuntimeWorkSink;
  readonly handlerInvocationSink?: JeditHandlerInvocationSink;
  readonly statePort?: JeditContractStatePort;
  readonly submissionLedger?: JeditSubmissionLedgerPort;
  readonly ticketedWorkPort?: JeditTicketedWorkPort;
}

interface InstalledJeditContractEchoTransportContext {
  readonly info: EchoKernelInfo;
  readonly hash: HashPort;
  readonly installStatus: string;
  readonly mutations: ReturnType<typeof createJeditContractMutationHandlerRegistry>;
  readonly observers: ReturnType<typeof createJeditContractQueryObserverRegistry>;
  readonly workSink?: JeditRuntimeWorkSink;
  readonly handlerInvocationSink?: JeditHandlerInvocationSink;
  readonly submissionLedger: JeditSubmissionLedgerPort;
  readonly ticketedWorkPort: JeditTicketedWorkPort;
}

interface AcceptedSubmissionContext {
  readonly submissionId: string;
  readonly packageId: string;
  readonly operationName: string;
  readonly canonicalRequestBytesHex: string;
}

export function createInstalledJeditContractEchoTransport(
  options: InstalledJeditContractEchoTransportOptions = {},
): EchoWasmKernelTransport {
  const context = createTransportContext(options);

  return {
    kernelInfo() {
      return context.info;
    },
    submitIntentBytes(intentBytes) {
      return submitInstalledIntent(context, intentBytes);
    },
    observeBytes(requestBytes) {
      return observeInstalledRequest(context, requestBytes);
    },
    schedulerStatusBytes() {
      return encodeInstalledSchedulerStatus();
    },
  };
}

function createTransportContext(
  options: InstalledJeditContractEchoTransportOptions,
): InstalledJeditContractEchoTransportContext {
  const runtime = options.runtime ?? createInMemoryHotTextRuntime();
  const hash = options.hash ?? createHashPort();
  const statePort = options.statePort ?? createInMemoryJeditContractStatePort();
  const mutations = createJeditContractMutationHandlerRegistry({ runtime, hash, statePort });
  const observers = createJeditContractQueryObserverRegistry({ runtime, hash, statePort });
  const host = createRecordingPackageHost();
  const install = installJeditContractPackage({ host });

  return {
    info: {
      moduleSpecifier: options.moduleSpecifier ?? INSTALLED_CONTRACT_MODULE_SPECIFIER,
      codecId: INSTALLED_CONTRACT_CODEC_ID,
      registryVersion: INSTALLED_CONTRACT_REGISTRY_VERSION,
      schemaSha256Hex: INSTALLED_CONTRACT_SCHEMA_SHA256_HEX,
    },
    hash,
    installStatus: install.hostResult.status,
    mutations,
    observers,
    workSink: options.workSink,
    handlerInvocationSink: options.handlerInvocationSink,
    submissionLedger: options.submissionLedger ?? createInMemoryJeditSubmissionLedgerPort(),
    ticketedWorkPort: options.ticketedWorkPort ?? createInMemoryJeditTicketedWorkPort(hash),
  };
}

function submitInstalledIntent(
  context: InstalledJeditContractEchoTransportContext,
  intentBytes: Uint8Array,
): Uint8Array {
  const request = decodeJeditIntentRequest(intentBytes);
  recordRuntimeWorkEnvelope(context.workSink, intentBytes, request, context.hash);
  const submission = recordAcceptedSubmission(context, intentBytes, request);
  const ticketedWork = context.ticketedWorkPort.issueTicketedWork(submission);
  if (ticketedWork.status !== JEDIT_TICKETED_WORK_AVAILABLE) {
    return encodeJeditIntentResponse(obstructedIntent(request, ticketedWorkObstruction(ticketedWork)));
  }

  return encodeJeditIntentResponse(
    executeIntent(context.installStatus, context.mutations, context.handlerInvocationSink, request),
  );
}

function recordAcceptedSubmission(
  context: InstalledJeditContractEchoTransportContext,
  intentBytes: Uint8Array,
  request: JeditIntentRequest,
): AcceptedSubmissionContext {
  const canonicalRequestBytesHex = bytesToHex(intentBytes);
  const submission = {
    submissionId: createJeditSubmissionId(canonicalRequestBytesHex, context.hash),
    packageId: JEDIT_HOT_TEXT_PACKAGE_ID,
    operationName: request.operationName,
    canonicalRequestBytesHex,
  };
  recordAcceptedJeditSubmission(context.submissionLedger, submission);
  return submission;
}

function observeInstalledRequest(
  context: InstalledJeditContractEchoTransportContext,
  requestBytes: Uint8Array,
): Uint8Array {
  const request = decodeJeditObserveRequest(requestBytes);
  try {
    return encodeJeditObserveResponse(
      executeObserve(context.installStatus, context.observers, request),
    );
  } catch (error) {
    return encodeJeditObserveResponse(
      obstructedObserve(request, observeErrorObstruction(error instanceof Error ? error : undefined)),
    );
  }
}

function encodeInstalledSchedulerStatus(): Uint8Array {
  return encodeJeditSchedulerStatus({
    kind: JEDIT_SCHEDULER_STATUS_KIND,
    state: SCHEDULER_STATE_IDLE,
    host: INSTALLED_CONTRACT_HOST,
  });
}

function recordRuntimeWorkEnvelope(
  workSink: JeditRuntimeWorkSink | undefined,
  intentBytes: Uint8Array,
  request: JeditIntentRequest,
  hash: HashPort,
): void {
  workSink?.recordRuntimeWorkEnvelope(createJeditRuntimeWorkEnvelope({
    packageId: JEDIT_HOT_TEXT_PACKAGE_ID,
    operationName: request.operationName,
    operationKind: JEDIT_RUNTIME_WORK_OPERATION_KIND_MUTATION,
    canonicalRequestBytes: intentBytes,
  }, hash));
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function executeIntent(
  installStatus: string,
  mutations: ReturnType<typeof createJeditContractMutationHandlerRegistry>,
  invocationSink: JeditHandlerInvocationSink | undefined,
  request: JeditIntentRequest,
): JeditIntentResponse {
  if (installStatus !== ECHO_CONTRACT_PACKAGE_INSTALL_INSTALLED) {
    return obstructedIntent(request, packageNotInstalledObstruction());
  }

  switch (request.operationName) {
    case CREATE_BUFFER_WORLDLINE_OPERATION:
      return executeCreateBufferIntent(mutations, invocationSink, request);
    case REPLACE_RANGE_AS_TICK_OPERATION:
      return executeReplaceRangeIntent(mutations, invocationSink, request);
    case CREATE_CHECKPOINT_OPERATION:
      return executeCreateCheckpointIntent(mutations, invocationSink, request);
  }
}

function executeCreateBufferIntent(
  mutations: ReturnType<typeof createJeditContractMutationHandlerRegistry>,
  invocationSink: JeditHandlerInvocationSink | undefined,
  request: Extract<JeditIntentRequest, { readonly operationName: typeof CREATE_BUFFER_WORLDLINE_OPERATION }>,
): JeditIntentResponse {
  const invocation = invokeSchedulerHandler(mutations, invocationSink, (registry) => (
    registry.executeCreateBufferWorldlineMutation(request)
  ));
  if (invocation.status === JEDIT_HANDLER_INVOCATION_STATUS_BLOCKED) {
    return obstructedIntent(request, invocation.obstruction);
  }
  return {
    status: JEDIT_TRANSPORT_STATUS_OK,
    operationName: CREATE_BUFFER_WORLDLINE_OPERATION,
    execution: invocation.result,
  };
}

function executeReplaceRangeIntent(
  mutations: ReturnType<typeof createJeditContractMutationHandlerRegistry>,
  invocationSink: JeditHandlerInvocationSink | undefined,
  request: Extract<JeditIntentRequest, { readonly operationName: typeof REPLACE_RANGE_AS_TICK_OPERATION }>,
): JeditIntentResponse {
  const invocation = invokeSchedulerHandler(mutations, invocationSink, (registry) => (
    registry.executeReplaceRangeAsTickMutation(request)
  ));
  if (invocation.status === JEDIT_HANDLER_INVOCATION_STATUS_BLOCKED) {
    return obstructedIntent(request, invocation.obstruction);
  }
  return {
    status: JEDIT_TRANSPORT_STATUS_OK,
    operationName: REPLACE_RANGE_AS_TICK_OPERATION,
    execution: invocation.result,
  };
}

function executeCreateCheckpointIntent(
  mutations: ReturnType<typeof createJeditContractMutationHandlerRegistry>,
  invocationSink: JeditHandlerInvocationSink | undefined,
  request: Extract<JeditIntentRequest, { readonly operationName: typeof CREATE_CHECKPOINT_OPERATION }>,
): JeditIntentResponse {
  const invocation = invokeSchedulerHandler(mutations, invocationSink, (registry) => (
    registry.executeCreateCheckpointMutation(request)
  ));
  if (invocation.status === JEDIT_HANDLER_INVOCATION_STATUS_BLOCKED) {
    return obstructedIntent(request, invocation.obstruction);
  }
  return {
    status: JEDIT_TRANSPORT_STATUS_OK,
    operationName: CREATE_CHECKPOINT_OPERATION,
    execution: invocation.result,
  };
}

function invokeSchedulerHandler<Result>(
  mutations: ReturnType<typeof createJeditContractMutationHandlerRegistry>,
  invocationSink: JeditHandlerInvocationSink | undefined,
  invokeHandler: (registry: ReturnType<typeof createJeditContractMutationHandlerRegistry>) => Result,
) {
  invocationSink?.recordHandlerInvocationAuthority(JEDIT_HANDLER_INVOCATION_AUTHORITY_SCHEDULER);
  return invokeJeditHandlerWithAuthority(mutations, {
    authority: JEDIT_HANDLER_INVOCATION_AUTHORITY_SCHEDULER,
    invokeHandler,
  });
}

function executeObserve(
  installStatus: string,
  observers: ReturnType<typeof createJeditContractQueryObserverRegistry>,
  request: JeditObserveRequest,
): JeditObserveResponse {
  if (installStatus !== ECHO_CONTRACT_PACKAGE_INSTALL_INSTALLED) {
    return obstructedObserve(request, packageNotInstalledObstruction());
  }

  switch (request.operationName) {
    case WORLDLINE_SNAPSHOT_OPERATION:
      return {
        status: JEDIT_TRANSPORT_STATUS_OK,
        operationName: WORLDLINE_SNAPSHOT_OPERATION,
        envelope: observers.observeWorldlineSnapshot(request),
      };
    case TEXT_WINDOW_OPERATION:
      return {
        status: JEDIT_TRANSPORT_STATUS_OK,
        operationName: TEXT_WINDOW_OPERATION,
        envelope: observers.observeTextWindow(request),
      };
  }
}

function obstructedIntent(
  request: JeditIntentRequest,
  obstruction: JeditTransportObstruction,
): JeditIntentResponse {
  return {
    status: JEDIT_TRANSPORT_STATUS_OBSTRUCTED,
    operationName: request.operationName,
    obstruction,
  };
}

function obstructedObserve(
  request: JeditObserveRequest,
  obstruction: JeditTransportObstruction,
): JeditObserveResponse {
  return {
    status: JEDIT_TRANSPORT_STATUS_OBSTRUCTED,
    operationName: request.operationName,
    obstruction,
  };
}

function packageNotInstalledObstruction(): JeditTransportObstruction {
  return {
    code: PACKAGE_NOT_INSTALLED_CODE,
    message: PACKAGE_NOT_INSTALLED_CODE,
    recovery: PACKAGE_NOT_INSTALLED_RECOVERY,
  };
}

function ticketedWorkObstruction(
  ticketedWork: Exclude<JeditTicketedWorkResult, { readonly status: typeof JEDIT_TICKETED_WORK_AVAILABLE }>,
): JeditTransportObstruction {
  return {
    code: ticketedWork.obstruction.code,
    message: ticketedWork.obstruction.reason,
    recovery: 'issue ticketed work before handler invocation',
  };
}

function observeErrorObstruction(error: Error | undefined): JeditTransportObstruction {
  if (error instanceof JeditContractStatePortError) {
    return {
      code: error.code,
      message: error.message,
      recovery: STATE_MISSING_RECOVERY,
      worldlineId: error.worldlineId,
    };
  }

  return {
    code: PACKAGE_NOT_INSTALLED_CODE,
    message: PACKAGE_NOT_INSTALLED_CODE,
    recovery: PACKAGE_NOT_INSTALLED_RECOVERY,
  };
}

function createRecordingPackageHost(): EchoContractPackageHostPort {
  return {
    installContractPackage(request: EchoContractPackageInstallRequest) {
      return {
        status: ECHO_CONTRACT_PACKAGE_INSTALL_INSTALLED,
        packageId: request.packageId,
      };
    },
  };
}
