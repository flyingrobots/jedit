import type {
  CreateBufferWorldlineExecution,
  CreateCheckpointExecution,
  JeditWorldlineSession,
  ReplaceRangeAsTickExecution,
} from '../app/jedit-contract-runtime.js';
import type { WorldlineSnapshotReadingEnvelope } from '../app/jedit-observer-runtime.js';
import type { TextWindowReadingEnvelope } from '../app/jedit-observer-runtime.js';
import type {
  MutationOperationMap,
  QueryOperationMap,
} from '../generated/jedit/hot-text-runtime.types.generated.js';
import type { EchoWasmKernelTransport } from '../ports/echo-kernel-transport.js';
import {
  READ_BASIS_HANDLE_KIND,
  type JeditOpticClient,
  type OpenTextBufferExecution,
  type ReadBasisHandle,
  type TextWindowRangeInput,
} from '../ports/jedit-optic-client.js';
import {
  CREATE_BUFFER_WORLDLINE_OPERATION,
  CREATE_CHECKPOINT_OPERATION,
  decodeJeditIntentResponse,
  decodeJeditObserveResponse,
  encodeJeditIntentRequest,
  encodeJeditObserveRequest,
  JEDIT_INTENT_REQUEST_KIND,
  JEDIT_OBSERVE_REQUEST_KIND,
  JEDIT_TRANSPORT_STATUS_OBSTRUCTED,
  REPLACE_RANGE_AS_TICK_OPERATION,
  TEXT_WINDOW_OPERATION,
  toCreateBufferWorldlineExecution,
  toCreateCheckpointExecution,
  toReplaceRangeAsTickExecution,
  toTextWindowReadingEnvelope,
  toWorldlineSnapshotReadingEnvelope,
  WORLDLINE_SNAPSHOT_OPERATION,
  type JeditIntentRequest,
  type JeditIntentResponse,
  type JeditObserveRequest,
  type JeditObserveResponse,
  type JeditTransportObstruction,
} from './jedit-echo-optic-codec.js';

type CreateBufferWorldlineInput = MutationOperationMap['createBufferWorldline']['input'];
type ReplaceRangeAsTickInput = MutationOperationMap['replaceRangeAsTick']['input'];
type CreateCheckpointInput = MutationOperationMap['createCheckpoint']['input'];
type WorldlineSnapshotInput = QueryOperationMap['worldlineSnapshot']['input'];
type TextWindowInput = QueryOperationMap['textWindow']['input'];
const READ_BASIS_HANDLE_ID_PREFIX = 'text-buffer:';

export class JeditOpticTransportObstructionError extends Error {
  public readonly operationName: string;
  public readonly obstruction: JeditTransportObstruction;

  public constructor(operationName: string, obstruction: JeditTransportObstruction) {
    super(`Jedit optic transport obstructed ${operationName}: ${obstruction.message}`);
    this.name = 'JeditOpticTransportObstructionError';
    this.operationName = operationName;
    this.obstruction = obstruction;
  }
}

export class JeditOpticTransportProtocolError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'JeditOpticTransportProtocolError';
  }
}

export function createEchoTransportJeditOpticClient(
  transport: EchoWasmKernelTransport,
): JeditOpticClient {
  return {
    openTextBuffer(input: CreateBufferWorldlineInput): OpenTextBufferExecution {
      const execution = createBufferWorldlineViaTransport(transport, input);
      return {
        ...execution,
        readBasisHandle: createReadBasisHandle(execution.nextSession),
      };
    },
    createBufferWorldline(input: CreateBufferWorldlineInput): CreateBufferWorldlineExecution {
      return createBufferWorldlineViaTransport(transport, input);
    },
    replaceRangeAsTick(
      session: JeditWorldlineSession,
      input: ReplaceRangeAsTickInput,
    ): ReplaceRangeAsTickExecution {
      const response = submitIntent(transport, {
        kind: JEDIT_INTENT_REQUEST_KIND,
        operationName: REPLACE_RANGE_AS_TICK_OPERATION,
        session,
        input,
      });
      if (response.status === JEDIT_TRANSPORT_STATUS_OBSTRUCTED) {
        throw new JeditOpticTransportObstructionError(response.operationName, response.obstruction);
      }
      if (response.operationName !== REPLACE_RANGE_AS_TICK_OPERATION) {
        throwUnexpectedOperation(REPLACE_RANGE_AS_TICK_OPERATION, response.operationName);
      }
      return toReplaceRangeAsTickExecution(response.execution);
    },
    createCheckpoint(
      session: JeditWorldlineSession,
      input: CreateCheckpointInput,
    ): CreateCheckpointExecution {
      const response = submitIntent(transport, {
        kind: JEDIT_INTENT_REQUEST_KIND,
        operationName: CREATE_CHECKPOINT_OPERATION,
        session,
        input,
      });
      if (response.status === JEDIT_TRANSPORT_STATUS_OBSTRUCTED) {
        throw new JeditOpticTransportObstructionError(response.operationName, response.obstruction);
      }
      if (response.operationName !== CREATE_CHECKPOINT_OPERATION) {
        throwUnexpectedOperation(CREATE_CHECKPOINT_OPERATION, response.operationName);
      }
      return toCreateCheckpointExecution(response.execution);
    },
    worldlineSnapshot(
      session: JeditWorldlineSession,
      frontierRef: string,
      input: WorldlineSnapshotInput,
    ): WorldlineSnapshotReadingEnvelope {
      const response = observe(transport, {
        kind: JEDIT_OBSERVE_REQUEST_KIND,
        operationName: WORLDLINE_SNAPSHOT_OPERATION,
        session,
        frontierRef,
        input,
      });
      if (response.status === JEDIT_TRANSPORT_STATUS_OBSTRUCTED) {
        throw new JeditOpticTransportObstructionError(response.operationName, response.obstruction);
      }
      if (response.operationName !== WORLDLINE_SNAPSHOT_OPERATION) {
        throwUnexpectedOperation(WORLDLINE_SNAPSHOT_OPERATION, response.operationName);
      }
      return toWorldlineSnapshotReadingEnvelope(response.envelope);
    },
    textWindow(
      session: JeditWorldlineSession,
      frontierRef: string,
      readBasisHandle: ReadBasisHandle,
      input: TextWindowRangeInput,
    ): TextWindowReadingEnvelope {
      const response = observe(transport, {
        kind: JEDIT_OBSERVE_REQUEST_KIND,
        operationName: TEXT_WINDOW_OPERATION,
        session,
        frontierRef,
        input: toTextWindowInput(session, readBasisHandle, input),
      });
      if (response.status === JEDIT_TRANSPORT_STATUS_OBSTRUCTED) {
        throw new JeditOpticTransportObstructionError(response.operationName, response.obstruction);
      }
      if (response.operationName !== TEXT_WINDOW_OPERATION) {
        throwUnexpectedOperation(TEXT_WINDOW_OPERATION, response.operationName);
      }
      return toTextWindowReadingEnvelope(response.envelope);
    },
  };
}

function createBufferWorldlineViaTransport(
  transport: EchoWasmKernelTransport,
  input: CreateBufferWorldlineInput,
): CreateBufferWorldlineExecution {
  const response = submitIntent(transport, {
    kind: JEDIT_INTENT_REQUEST_KIND,
    operationName: CREATE_BUFFER_WORLDLINE_OPERATION,
    input,
  });
  if (response.status === JEDIT_TRANSPORT_STATUS_OBSTRUCTED) {
    throw new JeditOpticTransportObstructionError(response.operationName, response.obstruction);
  }
  if (response.operationName !== CREATE_BUFFER_WORLDLINE_OPERATION) {
    throwUnexpectedOperation(CREATE_BUFFER_WORLDLINE_OPERATION, response.operationName);
  }
  return toCreateBufferWorldlineExecution(response.execution);
}

function createReadBasisHandle(session: JeditWorldlineSession): ReadBasisHandle {
  return Object.freeze({
    kind: READ_BASIS_HANDLE_KIND,
    id: `${READ_BASIS_HANDLE_ID_PREFIX}${session.worldline.bufferKey}`,
  });
}

function toTextWindowInput(
  session: JeditWorldlineSession,
  readBasisHandle: ReadBasisHandle,
  input: TextWindowRangeInput,
): TextWindowInput {
  return {
    ...input,
    worldlineId: resolveReadBasisWorldlineId(session, readBasisHandle),
  };
}

function resolveReadBasisWorldlineId(
  session: JeditWorldlineSession,
  readBasisHandle: ReadBasisHandle,
): string {
  const expected = createReadBasisHandle(session);
  if (readBasisHandle.kind !== READ_BASIS_HANDLE_KIND || readBasisHandle.id !== expected.id) {
    throw new JeditOpticTransportProtocolError(
      'ReadBasisHandle does not belong to the supplied jedit session.',
    );
  }
  return session.worldline.worldlineId;
}

function submitIntent(
  transport: EchoWasmKernelTransport,
  request: JeditIntentRequest,
): JeditIntentResponse {
  return decodeJeditIntentResponse(
    transport.submitIntentBytes(encodeJeditIntentRequest(request)),
  );
}

function observe(
  transport: EchoWasmKernelTransport,
  request: JeditObserveRequest,
): JeditObserveResponse {
  return decodeJeditObserveResponse(
    transport.observeBytes(encodeJeditObserveRequest(request)),
  );
}

function throwUnexpectedOperation(expected: string, actual: string): never {
  throw new JeditOpticTransportProtocolError(
    `Expected ${expected} transport response, received ${actual}.`,
  );
}
