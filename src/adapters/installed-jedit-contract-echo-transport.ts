import {
  createJeditContractMutationHandlerRegistry,
} from '../app/jedit-contract-mutation-handlers.js';
import {
  createJeditContractQueryObserverRegistry,
} from '../app/jedit-contract-query-observers.js';
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
}

export function createInstalledJeditContractEchoTransport(
  options: InstalledJeditContractEchoTransportOptions = {},
): EchoWasmKernelTransport {
  const runtime = options.runtime ?? createInMemoryHotTextRuntime();
  const hash = options.hash ?? createHashPort();
  const mutations = createJeditContractMutationHandlerRegistry({ runtime, hash });
  const observers = createJeditContractQueryObserverRegistry({ runtime, hash });
  const host = createRecordingPackageHost();
  const install = installJeditContractPackage({ host });
  const info: EchoKernelInfo = {
    moduleSpecifier: options.moduleSpecifier ?? INSTALLED_CONTRACT_MODULE_SPECIFIER,
    codecId: INSTALLED_CONTRACT_CODEC_ID,
    registryVersion: INSTALLED_CONTRACT_REGISTRY_VERSION,
    schemaSha256Hex: INSTALLED_CONTRACT_SCHEMA_SHA256_HEX,
  };

  return {
    kernelInfo() {
      return info;
    },
    submitIntentBytes(intentBytes) {
      return encodeJeditIntentResponse(
        executeIntent(install.hostResult.status, mutations, decodeJeditIntentRequest(intentBytes)),
      );
    },
    observeBytes(requestBytes) {
      return encodeJeditObserveResponse(
        executeObserve(install.hostResult.status, observers, decodeJeditObserveRequest(requestBytes)),
      );
    },
    schedulerStatusBytes() {
      return encodeJeditSchedulerStatus({
        kind: JEDIT_SCHEDULER_STATUS_KIND,
        state: SCHEDULER_STATE_IDLE,
        host: INSTALLED_CONTRACT_HOST,
      });
    },
  };
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
