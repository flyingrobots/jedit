import {
  createJeditContractMutationHandlerRegistry,
} from '../app/jedit-contract-mutation-handlers.js';
import {
  createJeditContractQueryObserverRegistry,
} from '../app/jedit-contract-query-observers.js';
import { JEDIT_HOT_TEXT_PACKAGE_ID } from '../app/jedit-contract-package.js';
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

export interface InstalledJeditContractEchoTransportOptions {
  readonly runtime?: HotTextRuntimePort;
  readonly hash?: HashPort;
  readonly moduleSpecifier?: string;
  readonly workSink?: JeditRuntimeWorkSink;
}

interface InstalledJeditContractEchoTransportContext {
  readonly info: EchoKernelInfo;
  readonly hash: HashPort;
  readonly installStatus: string;
  readonly mutations: ReturnType<typeof createJeditContractMutationHandlerRegistry>;
  readonly observers: ReturnType<typeof createJeditContractQueryObserverRegistry>;
  readonly workSink?: JeditRuntimeWorkSink;
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
  const mutations = createJeditContractMutationHandlerRegistry({ runtime, hash });
  const observers = createJeditContractQueryObserverRegistry({ runtime, hash });
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
  };
}

function submitInstalledIntent(
  context: InstalledJeditContractEchoTransportContext,
  intentBytes: Uint8Array,
): Uint8Array {
  const request = decodeJeditIntentRequest(intentBytes);
  recordRuntimeWorkEnvelope(context.workSink, intentBytes, request, context.hash);
  return encodeJeditIntentResponse(
    executeIntent(context.installStatus, context.mutations, request),
  );
}

function observeInstalledRequest(
  context: InstalledJeditContractEchoTransportContext,
  requestBytes: Uint8Array,
): Uint8Array {
  return encodeJeditObserveResponse(
    executeObserve(context.installStatus, context.observers, decodeJeditObserveRequest(requestBytes)),
  );
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

function executeIntent(
  installStatus: string,
  mutations: ReturnType<typeof createJeditContractMutationHandlerRegistry>,
  request: JeditIntentRequest,
): JeditIntentResponse {
  if (installStatus !== ECHO_CONTRACT_PACKAGE_INSTALL_INSTALLED) {
    return obstructedIntent(request, packageNotInstalledObstruction());
  }

  switch (request.operationName) {
    case CREATE_BUFFER_WORLDLINE_OPERATION:
      return {
        status: JEDIT_TRANSPORT_STATUS_OK,
        operationName: CREATE_BUFFER_WORLDLINE_OPERATION,
        execution: mutations.executeCreateBufferWorldlineMutation(request),
      };
    case REPLACE_RANGE_AS_TICK_OPERATION:
      return {
        status: JEDIT_TRANSPORT_STATUS_OK,
        operationName: REPLACE_RANGE_AS_TICK_OPERATION,
        execution: mutations.executeReplaceRangeAsTickMutation(request),
      };
    case CREATE_CHECKPOINT_OPERATION:
      return {
        status: JEDIT_TRANSPORT_STATUS_OK,
        operationName: CREATE_CHECKPOINT_OPERATION,
        execution: mutations.executeCreateCheckpointMutation(request),
      };
  }
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
