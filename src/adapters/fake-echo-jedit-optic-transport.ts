import {
  createBufferWorldline,
  createCheckpoint,
  JeditContractRuntimeError,
  replaceRangeAsTick,
} from '../app/jedit-contract-runtime.js';
import {
  readTextWindowWithObserverPlan,
  readWorldlineSnapshotWithObserverPlan,
} from '../app/jedit-observer-runtime.js';
import { createInMemoryHotTextRuntime } from './in-memory-hot-text-runtime.js';
import type { EchoKernelInfo, EchoWasmKernelTransport } from '../ports/echo-kernel-transport.js';
import type { HotTextRuntimePort } from '../ports/hot-text-runtime.js';
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

const FAKE_ECHO_JEDIT_MODULE_SPECIFIER = 'fake:echo-jedit-optic';
const FAKE_ECHO_JEDIT_CODEC_ID = 'jedit.fake-echo-optic+json';
const FAKE_ECHO_JEDIT_REGISTRY_VERSION = 'jedit-fake-v1';
const FAKE_ECHO_JEDIT_SCHEMA_SHA256_HEX = 'fake-jedit-schema';
const FAKE_ECHO_JEDIT_HOST = 'fake-echo-jedit-optic';
const SCHEDULER_STATE_IDLE = 'IDLE';
const JEDIT_CONTRACT_RUNTIME_ERROR_CODE = 'JEDIT_CONTRACT_RUNTIME_ERROR';
const JEDIT_FAKE_HOST_ERROR_CODE = 'JEDIT_FAKE_HOST_ERROR';
const RECOVERY_REFRESH_READING = 'refresh reading and retry';

export interface CreateFakeEchoJeditOpticTransportOptions {
  readonly runtime?: HotTextRuntimePort;
  readonly moduleSpecifier?: string;
}

export function createFakeEchoJeditOpticTransport(
  options: CreateFakeEchoJeditOpticTransportOptions = {},
): EchoWasmKernelTransport {
  const runtime = options.runtime ?? createInMemoryHotTextRuntime();
  const info: EchoKernelInfo = {
    moduleSpecifier: options.moduleSpecifier ?? FAKE_ECHO_JEDIT_MODULE_SPECIFIER,
    codecId: FAKE_ECHO_JEDIT_CODEC_ID,
    registryVersion: FAKE_ECHO_JEDIT_REGISTRY_VERSION,
    schemaSha256Hex: FAKE_ECHO_JEDIT_SCHEMA_SHA256_HEX,
  };

  return {
    kernelInfo() {
      return info;
    },
    submitIntentBytes(intentBytes) {
      return encodeJeditIntentResponse(executeIntent(runtime, decodeJeditIntentRequest(intentBytes)));
    },
    observeBytes(requestBytes) {
      return encodeJeditObserveResponse(executeObserve(runtime, decodeJeditObserveRequest(requestBytes)));
    },
    schedulerStatusBytes() {
      return encodeJeditSchedulerStatus({
        kind: JEDIT_SCHEDULER_STATUS_KIND,
        state: SCHEDULER_STATE_IDLE,
        host: FAKE_ECHO_JEDIT_HOST,
      });
    },
  };
}

function executeIntent(runtime: HotTextRuntimePort, request: JeditIntentRequest): JeditIntentResponse {
  try {
    switch (request.operationName) {
      case CREATE_BUFFER_WORLDLINE_OPERATION:
        return {
          status: JEDIT_TRANSPORT_STATUS_OK,
          operationName: CREATE_BUFFER_WORLDLINE_OPERATION,
          execution: createBufferWorldline(runtime, request.input),
        };
      case REPLACE_RANGE_AS_TICK_OPERATION:
        return {
          status: JEDIT_TRANSPORT_STATUS_OK,
          operationName: REPLACE_RANGE_AS_TICK_OPERATION,
          execution: replaceRangeAsTick(runtime, request.session, request.input),
        };
      case CREATE_CHECKPOINT_OPERATION:
        return {
          status: JEDIT_TRANSPORT_STATUS_OK,
          operationName: CREATE_CHECKPOINT_OPERATION,
          execution: createCheckpoint(runtime, request.session, request.input),
        };
    }
  } catch (error) {
    return {
      status: JEDIT_TRANSPORT_STATUS_OBSTRUCTED,
      operationName: request.operationName,
      obstruction: toIntentObstruction(request, error instanceof Error ? error : undefined),
    };
  }
}

function executeObserve(runtime: HotTextRuntimePort, request: JeditObserveRequest): JeditObserveResponse {
  try {
    switch (request.operationName) {
      case WORLDLINE_SNAPSHOT_OPERATION:
        return {
          status: JEDIT_TRANSPORT_STATUS_OK,
          operationName: WORLDLINE_SNAPSHOT_OPERATION,
          envelope: readWorldlineSnapshotWithObserverPlan(
            runtime,
            request.session,
            request.frontierRef,
            request.input,
          ),
        };
      case TEXT_WINDOW_OPERATION:
        return {
          status: JEDIT_TRANSPORT_STATUS_OK,
          operationName: TEXT_WINDOW_OPERATION,
          envelope: readTextWindowWithObserverPlan(
            runtime,
            request.session,
            request.frontierRef,
            request.input,
          ),
        };
    }
  } catch (error) {
    return {
      status: JEDIT_TRANSPORT_STATUS_OBSTRUCTED,
      operationName: request.operationName,
      obstruction: toObserveObstruction(request, error instanceof Error ? error : undefined),
    };
  }
}

function toIntentObstruction(
  request: JeditIntentRequest,
  error: Error | undefined,
): JeditTransportObstruction {
  const obstruction = toBaseObstruction(error);

  switch (request.operationName) {
    case CREATE_BUFFER_WORLDLINE_OPERATION:
      return obstruction;
    case REPLACE_RANGE_AS_TICK_OPERATION:
      return {
        ...obstruction,
        worldlineId: request.session.worldline.worldlineId,
        requestedBaseHeadId: request.input.baseHeadId,
        currentHeadId: request.session.worldline.canonicalHeadId,
      };
    case CREATE_CHECKPOINT_OPERATION:
      return {
        ...obstruction,
        worldlineId: request.session.worldline.worldlineId,
        currentHeadId: request.session.worldline.canonicalHeadId,
      };
  }
}

function toObserveObstruction(
  request: JeditObserveRequest,
  error: Error | undefined,
): JeditTransportObstruction {
  return {
    ...toBaseObstruction(error),
    worldlineId: request.session.worldline.worldlineId,
    currentHeadId: request.session.worldline.canonicalHeadId,
  };
}

function toBaseObstruction(error: Error | undefined): JeditTransportObstruction {
  if (error instanceof JeditContractRuntimeError) {
    return {
      code: JEDIT_CONTRACT_RUNTIME_ERROR_CODE,
      message: error.message,
      recovery: RECOVERY_REFRESH_READING,
    };
  }

  if (error !== undefined) {
    return {
      code: JEDIT_FAKE_HOST_ERROR_CODE,
      message: error.message,
      recovery: RECOVERY_REFRESH_READING,
    };
  }

  return {
    code: JEDIT_FAKE_HOST_ERROR_CODE,
    message: 'Fake Echo host failed while handling the request.',
    recovery: RECOVERY_REFRESH_READING,
  };
}
