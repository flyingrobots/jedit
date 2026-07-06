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
import { createFullSnapshotHotTextRuntimeFixture } from './full-snapshot-hot-text-runtime-fixture.js';
import type { EchoKernelInfo } from '../ports/echo-kernel-transport.js';
import type { JeditTransportSeam } from '../ports/jedit-transport-seam.js';
import type { HotTextRuntimePort } from '../ports/hot-text-runtime.js';
import type { HashPort } from '../ports/hash.js';
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
  TEXT_WINDOW_OPERATION,
  WORLDLINE_SNAPSHOT_OPERATION,
  type JeditIntentResponse,
  type JeditObserveRequest,
  type JeditObserveResponse,
  type JeditTransportObstruction,
} from './jedit-echo-optic-codec.js';
import {
  decodeJeditMutationIntentEnvelope,
  type DecodedJeditMutationIntent,
} from './jedit-mutation-envelope-codec.js';
import {
  JeditWorldlineSessionNotRegisteredError,
  type JeditWorldlineSessionPort,
} from '../ports/jedit-worldline-session-port.js';
import { createInMemoryJeditWorldlineSessionPort } from './in-memory-jedit-worldline-session-port.js';
import {
  assertNever,
  envelopeDecodeObstructedResponse,
  sessionNotRegisteredObstruction,
} from './jedit-mutation-obstruction-mappers.js';

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
  readonly hash?: HashPort;
  readonly sessionPort?: JeditWorldlineSessionPort;
}

interface FakeTransportContext {
  readonly runtime: HotTextRuntimePort;
  readonly hash: HashPort;
  readonly sessionPort: JeditWorldlineSessionPort;
}

export function createFakeEchoJeditOpticTransport(
  options: CreateFakeEchoJeditOpticTransportOptions = {},
): JeditTransportSeam {
  const context: FakeTransportContext = {
    runtime: options.runtime ?? createFullSnapshotHotTextRuntimeFixture(),
    hash: options.hash ?? createHashPort(),
    sessionPort: options.sessionPort ?? createInMemoryJeditWorldlineSessionPort(),
  };
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
      return encodeJeditIntentResponse(executeEnvelope(context, intentBytes));
    },
    observeBytes(requestBytes) {
      return encodeJeditObserveResponse(executeObserve(context, decodeJeditObserveRequest(requestBytes)));
    },
    schedulerStatusBytes() {
      return encodeJeditSchedulerStatus({
        kind: JEDIT_SCHEDULER_STATUS_KIND,
        state: SCHEDULER_STATE_IDLE,
        host: FAKE_ECHO_JEDIT_HOST,
      });
    },
    jeditSessionPort: context.sessionPort,
  };
}

function executeEnvelope(
  context: FakeTransportContext,
  intentBytes: Uint8Array,
): JeditIntentResponse {
  let decoded: DecodedJeditMutationIntent;
  try {
    decoded = decodeJeditMutationIntentEnvelope(intentBytes);
  } catch (error) {
    return envelopeDecodeObstructedResponse(error instanceof Error ? error : undefined);
  }
  try {
    return executeDecodedMutation(context, decoded);
  } catch (error) {
    if (error instanceof JeditWorldlineSessionNotRegisteredError) {
      return {
        status: JEDIT_TRANSPORT_STATUS_OBSTRUCTED,
        operationName: decoded.operationName,
        obstruction: sessionNotRegisteredObstruction(error),
      };
    }
    return {
      status: JEDIT_TRANSPORT_STATUS_OBSTRUCTED,
      operationName: decoded.operationName,
      obstruction: toMutationObstruction(decoded, error instanceof Error ? error : undefined),
    };
  }
}

function executeDecodedMutation(
  context: FakeTransportContext,
  decoded: DecodedJeditMutationIntent,
): JeditIntentResponse {
  switch (decoded.operationName) {
    case CREATE_BUFFER_WORLDLINE_OPERATION:
      return {
        status: JEDIT_TRANSPORT_STATUS_OK,
        operationName: CREATE_BUFFER_WORLDLINE_OPERATION,
        execution: createBufferWorldline(context.runtime, decoded.vars.input, context.hash),
      };
    case REPLACE_RANGE_AS_TICK_OPERATION: {
      const session = context.sessionPort.getSession(decoded.vars.input.worldlineId);
      return {
        status: JEDIT_TRANSPORT_STATUS_OK,
        operationName: REPLACE_RANGE_AS_TICK_OPERATION,
        execution: replaceRangeAsTick(context.runtime, session, decoded.vars.input, context.hash),
      };
    }
    case CREATE_CHECKPOINT_OPERATION: {
      const session = context.sessionPort.getSession(decoded.vars.input.worldlineId);
      return {
        status: JEDIT_TRANSPORT_STATUS_OK,
        operationName: CREATE_CHECKPOINT_OPERATION,
        execution: createCheckpoint(context.runtime, session, decoded.vars.input, context.hash),
      };
    }
    default:
      return assertNever(decoded, 'Unsupported decoded mutation intent');
  }
}

function executeObserve(
  context: FakeTransportContext,
  request: JeditObserveRequest,
): JeditObserveResponse {
  try {
    return executeObservedOperation(context, request);
  } catch (error) {
    return {
      status: JEDIT_TRANSPORT_STATUS_OBSTRUCTED,
      operationName: request.operationName,
      obstruction: toObserveObstruction(request, error instanceof Error ? error : undefined),
    };
  }
}

function executeObservedOperation(
  context: FakeTransportContext,
  request: JeditObserveRequest,
): JeditObserveResponse {
  switch (request.operationName) {
    case WORLDLINE_SNAPSHOT_OPERATION:
      return {
        status: JEDIT_TRANSPORT_STATUS_OK,
        operationName: WORLDLINE_SNAPSHOT_OPERATION,
        envelope: readWorldlineSnapshotWithObserverPlan(context.runtime, request.session, request.frontierRef, request.input, context.hash),
      };
    case TEXT_WINDOW_OPERATION:
      return {
        status: JEDIT_TRANSPORT_STATUS_OK,
        operationName: TEXT_WINDOW_OPERATION,
        envelope: readTextWindowWithObserverPlan(context.runtime, request.session, request.frontierRef, request.input, context.hash),
      };
  }
}

function toMutationObstruction(
  decoded: DecodedJeditMutationIntent,
  error: Error | undefined,
): JeditTransportObstruction {
  const obstruction = toBaseObstruction(error);

  switch (decoded.operationName) {
    case CREATE_BUFFER_WORLDLINE_OPERATION:
      return obstruction;
    case REPLACE_RANGE_AS_TICK_OPERATION:
      return {
        ...obstruction,
        worldlineId: decoded.vars.input.worldlineId,
        requestedBaseHeadId: decoded.vars.input.baseHeadId,
      };
    case CREATE_CHECKPOINT_OPERATION:
      return {
        ...obstruction,
        worldlineId: decoded.vars.input.worldlineId,
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
