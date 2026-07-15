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
  type TextWindowRequest,
} from '../ports/jedit-optic-client.js';
import { isJeditTransportSeam } from '../ports/jedit-transport-seam.js';
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
import type {
  CreateBufferWorldlineVars,
  CreateCheckpointVars,
  ReplaceRangeAsTickVars,
} from '../generated/jedit/rope.codec.generated.js';
import { serializeJeditTextWindowInput } from '../app/jedit-text-window-input.js';

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
  readonly request: TextWindowRequest;
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
  /**
   * Absent only when envelope decode failed before the operation could be
   * read. Consumers should branch on `obstruction.code` first, not on
   * operationName.
   */
  public readonly operationName: string | undefined;
  public readonly obstruction: JeditTransportObstruction;

  public constructor(operationName: string | undefined, obstruction: JeditTransportObstruction) {
    super(`Jedit optic transport obstructed ${operationName ?? '<unknown operation>'}: ${obstruction.message}`);
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

export class JeditSessionPortMismatchError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'JeditSessionPortMismatchError';
  }
}

/**
 * Accepts any `EchoWasmKernelTransport`. In-process transports return a
 * `JeditTransportSeam` (which extends the base) and carry the shared
 * session port via `jeditSessionPort`; the type guard
 * `isJeditTransportSeam` picks that up. Real-WASM transports remain plain
 * `EchoWasmKernelTransport` and the caller must supply
 * `options.sessionPort` instead.
 */
export function createEchoTransportJeditOpticClient(
  transport: EchoWasmKernelTransport,
  options: CreateEchoTransportJeditOpticClientOptions = {},
): JeditOpticClient {
  const context: OpticClientContext = {
    transport,
    sessionPort: resolveSharedSessionPort(transport, options.sessionPort),
    readBasisHandles: new ReadBasisHandleRegistry(),
  };
  return {
    openTextBuffer: (input) => openTextBufferViaTransport(context, input),
    createBufferWorldline: (input) => createBufferWorldlineViaTransport(context, input),
    replaceRangeAsTick: (session, input) => replaceRangeAsTickViaTransport(context, session, input),
    createCheckpoint: (session, input) => createCheckpointViaTransport(context, session, input),
    worldlineSnapshot: (session, frontierRef, input) => worldlineSnapshotViaTransport(context, session, frontierRef, input),
    textWindow: (session, frontierRef, readBasisHandle, request) => textWindowViaTransport(context, {
      session,
      frontierRef,
      readBasisHandle,
      request,
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
  // createBufferWorldline does not consume a pre-existing session — it
  // creates the worldline (and therefore the first session that names it).
  // No pre-call registration; we register `execution.nextSession` AFTER
  // the response so later mutations against this worldline can resolve.
  // (replaceRangeAsTick and createCheckpoint, by contrast, take a session
  // arg and register it BEFORE dispatching.)
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
    input: toTextWindowInput(context.readBasisHandles, request.session, request.readBasisHandle, request.request),
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
  request: TextWindowRequest,
): TextWindowInput {
  return serializeJeditTextWindowInput(
    readBasisHandles.resolveWorldlineId(session, readBasisHandle),
    request,
  );
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

// Marked `async` to expose a Promise-returning surface even though the
// underlying in-process transport completes synchronously. The async
// keyword is the seam that will defer for real once a worker / daemon /
// truly-async transport replaces the in-process one (Phase 4 / 6 of the
// 0024 plan). Today: zero awaits inside.
async function dispatchMutation(
  context: OpticClientContext,
  envelope: JeditMutationEnvelopeInput,
): Promise<JeditOkIntentResponse> {
  const responseBytes = context.transport.submitIntentBytes(encodeJeditMutationIntentEnvelope(envelope));
  const response = decodeJeditIntentResponse(responseBytes);
  if (response.status === JEDIT_TRANSPORT_STATUS_OBSTRUCTED) {
    // Decode-failure obstructions carry no operationName by type construction;
    // normal obstructions require it. Branch via 'in' narrowing.
    const operationName = 'operationName' in response ? response.operationName : undefined;
    throw new JeditOpticTransportObstructionError(operationName, response.obstruction);
  }
  return response;
}

// Same async-surface / sync-impl pattern as dispatchMutation above.
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

/**
 * Enforce the Slice B shared-session-port invariant.
 *
 * The optic client and the in-process transport must register / read from
 * exactly one `JeditWorldlineSessionPort` instance. A silent fallback —
 * "create a private port if neither side provides one" — would re-create
 * the C6 divergence bug the review caught.
 *
 * Rules:
 *
 * - If `options.sessionPort` AND `transport.jeditSessionPort` are both
 *   provided, they must be the same object instance. Mismatch is a hard
 *   error (`JeditSessionPortMismatchError`).
 * - If the transport is a `JeditTransportSeam` (in-process), use its port.
 *   This is the canonical path: the transport owns the port and the
 *   client adopts it.
 * - If the transport is a plain `EchoWasmKernelTransport` (real-WASM, no
 *   session-port concept), the caller must provide `options.sessionPort`.
 *   Otherwise the slice cannot function and we error rather than silently
 *   creating a port the transport will never read from.
 */
function resolveSharedSessionPort(
  transport: EchoWasmKernelTransport,
  optionsSessionPort: JeditWorldlineSessionPort | undefined,
): JeditWorldlineSessionPort {
  const transportPort = isJeditTransportSeam(transport) ? transport.jeditSessionPort : undefined;
  if (optionsSessionPort !== undefined && transportPort !== undefined && optionsSessionPort !== transportPort) {
    throw new JeditSessionPortMismatchError(
      'options.sessionPort differs from transport.jeditSessionPort; pass exactly one shared instance.',
    );
  }
  if (transportPort !== undefined) {
    return transportPort;
  }
  if (optionsSessionPort !== undefined) {
    return optionsSessionPort;
  }
  throw new JeditSessionPortMismatchError(
    'No session port available: pass options.sessionPort, or supply a transport that implements JeditTransportSeam.',
  );
}
