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
} from '../generated/jedit/rope.types.generated.js';
import type { EchoWasmKernelTransport } from '../ports/echo-kernel-transport.js';
import {
  type JeditOpticClient,
  type OpenTextBufferExecution,
  type ReadBasisHandle,
  type TextWindowRangeInput,
} from '../ports/jedit-optic-client.js';
import type { JeditWorldlineSessionPort } from '../ports/jedit-worldline-session-port.js';
import { ReadBasisHandleRegistry } from '../app/read-basis-handle-registry.js';
import {
  CREATE_BUFFER_WORLDLINE_OPERATION,
  CREATE_CHECKPOINT_OPERATION,
  decodeJeditIntentResponse,
  decodeJeditObserveResponse,
  encodeJeditObserveRequest,
  JEDIT_OBSERVE_REQUEST_KIND,
  JEDIT_TRANSPORT_STATUS_OBSTRUCTED,
  REPLACE_RANGE_AS_TICK_OPERATION,
  TEXT_WINDOW_OPERATION,
  WORLDLINE_SNAPSHOT_OPERATION,
  type JeditIntentResponse,
  type JeditObserveRequest,
  type JeditObserveResponse,
  type JeditTransportObstruction,
} from './jedit-echo-optic-codec.js';
import {
  encodeJeditMutationIntentEnvelope,
  type JeditMutationEnvelopeInput,
} from './jedit-mutation-envelope-codec.js';
import { createInMemoryJeditWorldlineSessionPort } from './in-memory-jedit-worldline-session-port.js';
import type {
  CreateBufferWorldlineVars,
  CreateCheckpointVars,
  ReplaceRangeAsTickVars,
} from '../generated/jedit/rope.codec.generated.js';

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

interface OpticClientContext {
  readonly transport: EchoWasmKernelTransport;
  readonly sessionPort: JeditWorldlineSessionPort;
  readonly readBasisHandles: ReadBasisHandleRegistry;
}

export interface CreateEchoTransportJeditOpticClientOptions {
  readonly sessionPort?: JeditWorldlineSessionPort;
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
  options: CreateEchoTransportJeditOpticClientOptions = {},
): JeditOpticClient {
  const context: OpticClientContext = {
    transport,
    // Prefer the transport's session port (in-process transports) so the
    // optic client registers sessions on the same instance the transport
    // reads from. Falls back to provided/default for real-WASM transports.
    sessionPort: options.sessionPort ?? transport.jeditSessionPort ?? createInMemoryJeditWorldlineSessionPort(),
    readBasisHandles: new ReadBasisHandleRegistry(),
  };
  return {
    openTextBuffer: (input) => openTextBufferViaTransport(context, input),
    createBufferWorldline: (input) => createBufferWorldlineViaTransport(context, input),
    replaceRangeAsTick: (session, input) => replaceRangeAsTickViaTransport(context, session, input),
    createCheckpoint: (session, input) => createCheckpointViaTransport(context, session, input),
    worldlineSnapshot: (session, frontierRef, input) => worldlineSnapshotViaTransport(context, session, frontierRef, input),
    textWindow: (session, frontierRef, readBasisHandle, input) => textWindowViaTransport(context, {
      session,
      frontierRef,
      readBasisHandle,
      input,
    }),
    requestRunUntilIdle: async () => {
      // In-process transports complete synchronously inside their await microtasks;
      // a single Promise.resolve() boundary suffices to flush them. Real async
      // wiring (worker / daemon) will replace this with a transport-level barrier.
      await Promise.resolve();
    },
  };
}

async function openTextBufferViaTransport(
  context: OpticClientContext,
  input: CreateBufferWorldlineInput,
): Promise<OpenTextBufferExecution> {
  const execution = await createBufferWorldlineViaTransport(context, input);
  return {
    ...execution,
    readBasisHandle: context.readBasisHandles.createForSession(execution.nextSession),
  };
}

async function createBufferWorldlineViaTransport(
  context: OpticClientContext,
  input: CreateBufferWorldlineInput,
): Promise<CreateBufferWorldlineExecution> {
  const response = await dispatchMutation(context, {
    operationName: CREATE_BUFFER_WORLDLINE_OPERATION,
    vars: toCreateBufferWorldlineVars(input),
  });
  if (response.operationName !== CREATE_BUFFER_WORLDLINE_OPERATION) {
    throwUnexpectedOperation(CREATE_BUFFER_WORLDLINE_OPERATION, response.operationName);
  }
  const execution = response.execution;
  context.sessionPort.registerSession(execution.nextSession);
  return execution;
}

async function replaceRangeAsTickViaTransport(
  context: OpticClientContext,
  session: JeditWorldlineSession,
  input: ReplaceRangeAsTickInput,
): Promise<ReplaceRangeAsTickExecution> {
  context.sessionPort.registerSession(session);
  const response = await dispatchMutation(context, {
    operationName: REPLACE_RANGE_AS_TICK_OPERATION,
    vars: toReplaceRangeAsTickVars(input),
  });
  if (response.operationName !== REPLACE_RANGE_AS_TICK_OPERATION) {
    throwUnexpectedOperation(REPLACE_RANGE_AS_TICK_OPERATION, response.operationName);
  }
  const execution = response.execution;
  context.sessionPort.registerSession(execution.nextSession);
  return execution;
}

async function createCheckpointViaTransport(
  context: OpticClientContext,
  session: JeditWorldlineSession,
  input: CreateCheckpointInput,
): Promise<CreateCheckpointExecution> {
  context.sessionPort.registerSession(session);
  const response = await dispatchMutation(context, {
    operationName: CREATE_CHECKPOINT_OPERATION,
    vars: toCreateCheckpointVars(input),
  });
  if (response.operationName !== CREATE_CHECKPOINT_OPERATION) {
    throwUnexpectedOperation(CREATE_CHECKPOINT_OPERATION, response.operationName);
  }
  const execution = response.execution;
  context.sessionPort.registerSession(execution.nextSession);
  return execution;
}

async function worldlineSnapshotViaTransport(
  context: OpticClientContext,
  session: JeditWorldlineSession,
  frontierRef: string,
  input: WorldlineSnapshotInput,
): Promise<WorldlineSnapshotReadingEnvelope> {
  const response = await checkedObserveResponse(context, {
    kind: JEDIT_OBSERVE_REQUEST_KIND,
    operationName: WORLDLINE_SNAPSHOT_OPERATION,
    session,
    frontierRef,
    input,
  });
  if (response.operationName !== WORLDLINE_SNAPSHOT_OPERATION) {
    throwUnexpectedOperation(WORLDLINE_SNAPSHOT_OPERATION, response.operationName);
  }
  return response.envelope;
}

async function textWindowViaTransport(
  context: OpticClientContext,
  request: TextWindowTransportRequest,
): Promise<TextWindowReadingEnvelope> {
  const response = await checkedObserveResponse(context, {
    kind: JEDIT_OBSERVE_REQUEST_KIND,
    operationName: TEXT_WINDOW_OPERATION,
    session: request.session,
    frontierRef: request.frontierRef,
    input: toTextWindowInput(context.readBasisHandles, request.session, request.readBasisHandle, request.input),
  });
  if (response.operationName !== TEXT_WINDOW_OPERATION) {
    throwUnexpectedOperation(TEXT_WINDOW_OPERATION, response.operationName);
  }
  return response.envelope;
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

function toCreateBufferWorldlineVars(input: CreateBufferWorldlineInput): CreateBufferWorldlineVars {
  return {
    input: {
      bufferKey: input.bufferKey,
      initialText: input.initialText ?? null,
      projectionPath: input.projectionPath ?? null,
      createInitialCheckpoint: input.createInitialCheckpoint ?? null,
    },
  };
}

function toReplaceRangeAsTickVars(input: ReplaceRangeAsTickInput): ReplaceRangeAsTickVars {
  return {
    input: {
      worldlineId: input.worldlineId,
      baseHeadId: input.baseHeadId,
      startByte: input.startByte,
      endByte: input.endByte,
      insertText: input.insertText,
      author: input.author ?? null,
    },
  };
}

function toCreateCheckpointVars(input: CreateCheckpointInput): CreateCheckpointVars {
  return {
    input: {
      worldlineId: input.worldlineId,
      kind: input.kind,
      label: input.label ?? null,
    },
  };
}

async function dispatchMutation(
  context: OpticClientContext,
  envelope: JeditMutationEnvelopeInput,
): Promise<JeditOkIntentResponse> {
  const responseBytes = context.transport.submitIntentBytes(encodeJeditMutationIntentEnvelope(envelope));
  const response = decodeJeditIntentResponse(responseBytes);
  if (response.status === JEDIT_TRANSPORT_STATUS_OBSTRUCTED) {
    throw new JeditOpticTransportObstructionError(response.operationName, response.obstruction);
  }
  return response;
}

async function checkedObserveResponse(
  context: OpticClientContext,
  request: JeditObserveRequest,
): Promise<JeditOkObserveResponse> {
  const response = decodeJeditObserveResponse(
    context.transport.observeBytes(encodeJeditObserveRequest(request)),
  );
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
