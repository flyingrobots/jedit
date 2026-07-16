import {
  createJeditContractMutationHandlerRegistry,
} from '../app/jedit-contract-mutation-handlers.js';
import {
  createDefaultJeditHostingBoundaries,
  createJeditSubmissionId,
  JEDIT_HOT_TEXT_PACKAGE_ID,
  JeditContractStatePortError,
  recordAcceptedJeditSubmission,
} from '../app/jedit-hosting-boundaries.js';
import {
  invokeJeditHandlerWithAuthority,
  JEDIT_HANDLER_INVOCATION_SCHEDULER_AUTHORITY,
  JEDIT_HANDLER_INVOCATION_STATUS_BLOCKED,
  type JeditHandlerInvocationSink,
} from '../app/jedit-runtime-handler-invocation.js';
import {
  assertInstalledTextAuthorityAllowed,
  createGraphRopeHotTextAuthority,
  GraphRopeTextAuthorityObstructionError,
} from './installed-text-authority-guard.js';
import {
  installJeditContractPackage,
} from './jedit-echo-contract-package-installer.js';
import {
  ECHO_CONTRACT_PACKAGE_INSTALL_INSTALLED,
  type EchoContractPackageHostPort,
  type EchoContractPackageInstallRequest,
} from '../ports/echo-contract-package-host.js';
import type { EchoKernelInfo } from '../ports/echo-kernel-transport.js';
import type { HotTextRuntimePort } from '../ports/hot-text-runtime.js';
import type { EchoCausalAnchorAdmissionPort } from '../domain/graph-rope-contract.js';
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
  decodeJeditObserveRequest,
  encodeJeditIntentResponse,
  encodeJeditObserveResponse,
  encodeJeditSchedulerStatus,
  JEDIT_SCHEDULER_STATUS_KIND,
  JEDIT_TRANSPORT_STATUS_OBSTRUCTED,
  JEDIT_TRANSPORT_STATUS_OK,
  REPLACE_RANGE_AS_TICK_OPERATION,
  type JeditIntentRequest,
  type JeditIntentResponse,
  type JeditObserveRequest,
  type JeditObserveResponse,
  type JeditTransportObstruction,
} from './jedit-echo-optic-codec.js';
import {
  createJeditContractQueryObserverRegistry,
  executeInstalledJeditObserve,
} from './installed-jedit-contract-observe.js';
import type { JeditWorldlineSessionPort } from '../ports/jedit-worldline-session-port.js';
import type { JeditTransportSeam } from '../ports/jedit-transport-seam.js';
import {
  createInMemoryJeditWorldlineSessionPort,
  createInstalledJeditEintBridge,
  isDecodedEnvelopeObstructed,
  isResolvedIntentObstructed,
  type JeditEintBridge,
} from './installed-jedit-eint-bridge.js';

const INSTALLED_CONTRACT_MODULE_SPECIFIER = 'installed:jedit-hot-text-runtime';
const INSTALLED_CONTRACT_CODEC_ID = 'jedit.installed-contract+json';
const INSTALLED_CONTRACT_REGISTRY_VERSION = 'jedit-installed-contract-v1';
const INSTALLED_CONTRACT_SCHEMA_SHA256_HEX = 'jedit-installed-contract-schema';
const INSTALLED_CONTRACT_HOST = 'installed-jedit-contract';
const SCHEDULER_STATE_IDLE = 'IDLE';
const PACKAGE_NOT_INSTALLED_CODE = 'JEDIT_PACKAGE_NOT_INSTALLED';
const PACKAGE_NOT_INSTALLED_RECOVERY = 'install package through trusted host';
const STATE_MISSING_RECOVERY = 'publish jedit contract state before observing';
const QUERY_OBSERVER_RUNTIME_ERROR_CODE = 'JEDIT_QUERY_OBSERVER_RUNTIME_ERROR';
const QUERY_OBSERVER_RUNTIME_ERROR_RECOVERY = 'refresh the reading basis or fix query input';
const QUERY_OBSERVER_RUNTIME_ERROR_MESSAGE = 'Jedit query observer failed while producing the reading';
const TEXT_AUTHORITY_OBSTRUCTION_RECOVERY = 'resolve the text authority obstruction and retry against the current basis';

type InstalledHashPort = ReturnType<typeof createHashPort>;

export interface InstalledJeditContractEchoTransportOptions {
  readonly runtime?: HotTextRuntimePort;
  readonly causalAnchorAdmission?: EchoCausalAnchorAdmissionPort;
  readonly allowFullSnapshotTextAuthority?: true;
  readonly hash?: InstalledHashPort;
  readonly moduleSpecifier?: string;
  readonly workSink?: JeditRuntimeWorkSink;
  readonly handlerInvocationSink?: JeditHandlerInvocationSink;
  readonly statePort?: JeditContractStatePort;
  readonly submissionLedger?: JeditSubmissionLedgerPort;
  readonly ticketedWorkPort?: JeditTicketedWorkPort;
  readonly packageHost?: EchoContractPackageHostPort;
  readonly sessionPort?: JeditWorldlineSessionPort;
}

interface InstalledJeditContractEchoTransportContext {
  readonly info: EchoKernelInfo;
  readonly hash: InstalledHashPort;
  readonly isPackageInstalled: boolean;
  readonly mutations: ReturnType<typeof createJeditContractMutationHandlerRegistry>;
  readonly observers: ReturnType<typeof createJeditContractQueryObserverRegistry>;
  readonly workSink?: JeditRuntimeWorkSink;
  readonly handlerInvocationSink?: JeditHandlerInvocationSink;
  readonly submissionLedger: JeditSubmissionLedgerPort;
  readonly ticketedWorkPort: JeditTicketedWorkPort;
  readonly bridge: JeditEintBridge;
}

interface AcceptedSubmissionContext {
  readonly submissionId: string;
  readonly packageId: string;
  readonly operationName: string;
  readonly canonicalRequestBytesHex: string;
}

export function createInstalledJeditContractEchoTransport(
  options: InstalledJeditContractEchoTransportOptions = {},
): JeditTransportSeam {
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
    jeditSessionPort: context.bridge.sessionPort,
  };
}

/**
 * Resolve the session port at the transport-factory boundary. The bridge
 * itself rejects undefined (no private fallback); the responsibility for
 * constructing a default in-memory port lives here, at the seam between
 * caller and bridge. The same instance is exposed via the seam's
 * jeditSessionPort so the optic client adopts it via
 * resolveSharedSessionPort.
 */
function resolveTransportSessionPort(
  provided: JeditWorldlineSessionPort | undefined,
): JeditWorldlineSessionPort {
  return provided ?? createInMemoryJeditWorldlineSessionPort();
}

function createTransportContext(
  options: InstalledJeditContractEchoTransportOptions,
): InstalledJeditContractEchoTransportContext {
  const hash = options.hash ?? createHashPort();
  const runtime = resolveTransportRuntime(options, hash);
  const defaults = createDefaultJeditHostingBoundaries(hash);
  const statePort = options.statePort ?? defaults.statePort;
  const mutations = createJeditContractMutationHandlerRegistry({ runtime, hash, statePort });
  const observers = createJeditContractQueryObserverRegistry({ runtime, hash, statePort });
  const host = options.packageHost ?? createRecordingPackageHost();
  const install = installJeditContractPackage({ host });
  const isPackageInstalled = install.hostResult.status === ECHO_CONTRACT_PACKAGE_INSTALL_INSTALLED;
  const sessionPort = resolveTransportSessionPort(options.sessionPort);

  return {
    info: {
      moduleSpecifier: options.moduleSpecifier ?? INSTALLED_CONTRACT_MODULE_SPECIFIER,
      codecId: INSTALLED_CONTRACT_CODEC_ID,
      registryVersion: INSTALLED_CONTRACT_REGISTRY_VERSION,
      schemaSha256Hex: INSTALLED_CONTRACT_SCHEMA_SHA256_HEX,
    },
    hash,
    isPackageInstalled,
    mutations,
    observers,
    workSink: options.workSink,
    handlerInvocationSink: options.handlerInvocationSink,
    submissionLedger: options.submissionLedger ?? defaults.submissionLedger,
    ticketedWorkPort: options.ticketedWorkPort ?? defaults.ticketedWorkPort,
    bridge: createInstalledJeditEintBridge({ sessionPort }),
  };
}

function resolveTransportRuntime(
  options: InstalledJeditContractEchoTransportOptions,
  hash: InstalledHashPort,
): HotTextRuntimePort {
  const runtime = options.runtime ?? createGraphRopeHotTextAuthority({
    hash,
    causalAnchorAdmission: options.causalAnchorAdmission,
  });
  assertInstalledTextAuthorityAllowed(runtime, options);
  return runtime;
}

function submitInstalledIntent(
  context: InstalledJeditContractEchoTransportContext,
  intentBytes: Uint8Array,
): Uint8Array {
  // Stage 1: decode the envelope.
  const decodeResult = context.bridge.decodeEnvelope(intentBytes);
  if (isDecodedEnvelopeObstructed(decodeResult)) {
    return encodeJeditIntentResponse(decodeResult.response);
  }
  const envelope = decodeResult.decoded;
  // Stage 2: check package installation BEFORE resolving session. Package
  // not installed is more fundamental than session not registered, so it
  // must surface first; a session-aware caller hitting a stale transport
  // should not see the derived session error.
  if (!context.isPackageInstalled) {
    return encodeJeditIntentResponse({
      status: JEDIT_TRANSPORT_STATUS_OBSTRUCTED,
      operationName: envelope.operationName,
      obstruction: packageNotInstalledObstruction(),
    });
  }
  // Stage 3: resolve session via the port.
  const resolved = context.bridge.resolveSession(envelope);
  if (isResolvedIntentObstructed(resolved)) {
    return encodeJeditIntentResponse(resolved.response);
  }
  const request = resolved.request;
  // Stage 4: existing ticketed-work + handler-invocation pipeline.
  const submission = recordAcceptedSubmission(context, intentBytes, request);
  const ticketedWork = context.ticketedWorkPort.issueTicketedWork(submission);
  if (ticketedWork.status !== JEDIT_TICKETED_WORK_AVAILABLE) {
    return encodeJeditIntentResponse(obstructedIntent(request, ticketedWorkObstruction(ticketedWork)));
  }
  recordRuntimeWorkEnvelope(context.workSink, intentBytes, request, context.hash, submission.submissionId);
  try {
    return encodeJeditIntentResponse(executeIntent(context.mutations, context.handlerInvocationSink, request));
  } catch (error) {
    const obstruction = textAuthorityRuntimeObstruction(error instanceof Error ? error : undefined);
    if (obstruction === null) {
      throw error;
    }
    return encodeJeditIntentResponse(obstructedIntent(request, obstruction));
  }
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
  if (!context.isPackageInstalled) {
    return encodeJeditObserveResponse(obstructedObserve(request, packageNotInstalledObstruction()));
  }
  try {
    return encodeJeditObserveResponse(
      executeInstalledJeditObserve(context.observers, request),
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
  hash: InstalledHashPort,
  submissionId: string,
): void {
  workSink?.recordRuntimeWorkEnvelope(createJeditRuntimeWorkEnvelope({
    submissionId,
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
  mutations: ReturnType<typeof createJeditContractMutationHandlerRegistry>,
  invocationSink: JeditHandlerInvocationSink | undefined,
  request: JeditIntentRequest,
): JeditIntentResponse {
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
  invocationSink?.recordHandlerInvocationAuthority(JEDIT_HANDLER_INVOCATION_SCHEDULER_AUTHORITY);
  return invokeJeditHandlerWithAuthority(mutations, {
    authority: JEDIT_HANDLER_INVOCATION_SCHEDULER_AUTHORITY,
    invokeHandler,
  });
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

function textAuthorityRuntimeObstruction(error: Error | undefined): JeditTransportObstruction | null {
  if (!(error instanceof GraphRopeTextAuthorityObstructionError)) {
    return null;
  }
  return {
    code: error.obstructionCode,
    message: error.message,
    recovery: TEXT_AUTHORITY_OBSTRUCTION_RECOVERY,
  };
}

function observeErrorObstruction(error: Error | undefined): JeditTransportObstruction {
  const textAuthorityObstruction = textAuthorityRuntimeObstruction(error);
  if (textAuthorityObstruction != null) {
    return textAuthorityObstruction;
  }
  if (error instanceof JeditContractStatePortError) {
    return {
      code: error.code,
      message: error.message,
      recovery: STATE_MISSING_RECOVERY,
      worldlineId: error.worldlineId,
    };
  }

  return {
    code: QUERY_OBSERVER_RUNTIME_ERROR_CODE,
    message: error?.message ?? QUERY_OBSERVER_RUNTIME_ERROR_MESSAGE,
    recovery: QUERY_OBSERVER_RUNTIME_ERROR_RECOVERY,
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
