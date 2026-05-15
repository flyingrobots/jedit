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
  type JeditOpticClient,
  type OpenTextBufferExecution,
  type ReadBasisHandle,
  type TextWindowRangeInput,
} from '../ports/jedit-optic-client.js';
import { ReadBasisHandleRegistry } from '../app/read-basis-handle-registry.js';
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
type JeditOkIntentResponse = Exclude<JeditIntentResponse, { readonly status: typeof JEDIT_TRANSPORT_STATUS_OBSTRUCTED }>;
type JeditOkObserveResponse = Exclude<JeditObserveResponse, { readonly status: typeof JEDIT_TRANSPORT_STATUS_OBSTRUCTED }>;

interface TextWindowTransportRequest {
  readonly session: JeditWorldlineSession;
  readonly frontierRef: string;
  readonly readBasisHandle: ReadBasisHandle;
  readonly input: TextWindowRangeInput;
}

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
  const readBasisHandles = new ReadBasisHandleRegistry();
  return {
    openTextBuffer: (input) => openTextBufferViaTransport(transport, readBasisHandles, input),
    createBufferWorldline: (input) => createBufferWorldlineViaTransport(transport, input),
    replaceRangeAsTick: (session, input) => replaceRangeAsTickViaTransport(transport, session, input),
    createCheckpoint: (session, input) => createCheckpointViaTransport(transport, session, input),
    worldlineSnapshot: (session, frontierRef, input) => worldlineSnapshotViaTransport(transport, session, frontierRef, input),
    textWindow: (session, frontierRef, readBasisHandle, input) => textWindowViaTransport(transport, readBasisHandles, {
      session,
      frontierRef,
      readBasisHandle,
      input,
    }),
  };
}

function openTextBufferViaTransport(
  transport: EchoWasmKernelTransport,
  readBasisHandles: ReadBasisHandleRegistry,
  input: CreateBufferWorldlineInput,
): OpenTextBufferExecution {
  const execution = createBufferWorldlineViaTransport(transport, input);
  return {
    ...execution,
    readBasisHandle: readBasisHandles.createForSession(execution.nextSession),
  };
}

function createBufferWorldlineViaTransport(
  transport: EchoWasmKernelTransport,
  input: CreateBufferWorldlineInput,
): CreateBufferWorldlineExecution {
  const response = checkedIntentResponse(transport, {
    kind: JEDIT_INTENT_REQUEST_KIND,
    operationName: CREATE_BUFFER_WORLDLINE_OPERATION,
    input,
  });
  if (response.operationName !== CREATE_BUFFER_WORLDLINE_OPERATION) {
    throwUnexpectedOperation(CREATE_BUFFER_WORLDLINE_OPERATION, response.operationName);
  }
  return toCreateBufferWorldlineExecution(response.execution);
}

function replaceRangeAsTickViaTransport(
  transport: EchoWasmKernelTransport,
  session: JeditWorldlineSession,
  input: ReplaceRangeAsTickInput,
): ReplaceRangeAsTickExecution {
  const response = checkedIntentResponse(transport, {
    kind: JEDIT_INTENT_REQUEST_KIND,
    operationName: REPLACE_RANGE_AS_TICK_OPERATION,
    session,
    input,
  });
  if (response.operationName !== REPLACE_RANGE_AS_TICK_OPERATION) {
    throwUnexpectedOperation(REPLACE_RANGE_AS_TICK_OPERATION, response.operationName);
  }
  return toReplaceRangeAsTickExecution(response.execution);
}

function createCheckpointViaTransport(
  transport: EchoWasmKernelTransport,
  session: JeditWorldlineSession,
  input: CreateCheckpointInput,
): CreateCheckpointExecution {
  const response = checkedIntentResponse(transport, {
    kind: JEDIT_INTENT_REQUEST_KIND,
    operationName: CREATE_CHECKPOINT_OPERATION,
    session,
    input,
  });
  if (response.operationName !== CREATE_CHECKPOINT_OPERATION) {
    throwUnexpectedOperation(CREATE_CHECKPOINT_OPERATION, response.operationName);
  }
  return toCreateCheckpointExecution(response.execution);
}

function worldlineSnapshotViaTransport(
  transport: EchoWasmKernelTransport,
  session: JeditWorldlineSession,
  frontierRef: string,
  input: WorldlineSnapshotInput,
): WorldlineSnapshotReadingEnvelope {
  const response = checkedObserveResponse(transport, {
    kind: JEDIT_OBSERVE_REQUEST_KIND,
    operationName: WORLDLINE_SNAPSHOT_OPERATION,
    session,
    frontierRef,
    input,
  });
  if (response.operationName !== WORLDLINE_SNAPSHOT_OPERATION) {
    throwUnexpectedOperation(WORLDLINE_SNAPSHOT_OPERATION, response.operationName);
  }
  return toWorldlineSnapshotReadingEnvelope(response.envelope);
}

function textWindowViaTransport(
  transport: EchoWasmKernelTransport,
  readBasisHandles: ReadBasisHandleRegistry,
  request: TextWindowTransportRequest,
): TextWindowReadingEnvelope {
  const response = checkedObserveResponse(transport, {
    kind: JEDIT_OBSERVE_REQUEST_KIND,
    operationName: TEXT_WINDOW_OPERATION,
    session: request.session,
    frontierRef: request.frontierRef,
    input: toTextWindowInput(readBasisHandles, request.session, request.readBasisHandle, request.input),
  });
  if (response.operationName !== TEXT_WINDOW_OPERATION) {
    throwUnexpectedOperation(TEXT_WINDOW_OPERATION, response.operationName);
  }
  return toTextWindowReadingEnvelope(response.envelope);
}

function toTextWindowInput(
  readBasisHandles: ReadBasisHandleRegistry,
  session: JeditWorldlineSession,
  readBasisHandle: ReadBasisHandle,
  input: TextWindowRangeInput,
): TextWindowInput {
  return {
    ...input,
    worldlineId: readBasisHandles.resolveWorldlineId(session, readBasisHandle),
  };
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

function checkedIntentResponse(
  transport: EchoWasmKernelTransport,
  request: JeditIntentRequest,
): JeditOkIntentResponse {
  const response = submitIntent(transport, request);
  if (response.status === JEDIT_TRANSPORT_STATUS_OBSTRUCTED) {
    throw new JeditOpticTransportObstructionError(response.operationName, response.obstruction);
  }
  return response;
}

function checkedObserveResponse(
  transport: EchoWasmKernelTransport,
  request: JeditObserveRequest,
): JeditOkObserveResponse {
  const response = observe(transport, request);
  if (response.status === JEDIT_TRANSPORT_STATUS_OBSTRUCTED) {
    throw new JeditOpticTransportObstructionError(response.operationName, response.obstruction);
  }
  return response;
}

function throwUnexpectedOperation(expected: string, actual: string): never {
  throw new JeditOpticTransportProtocolError(
    `Expected ${expected} transport response, received ${actual}.`,
  );
}
