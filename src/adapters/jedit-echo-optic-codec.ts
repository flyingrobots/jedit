import { z } from 'zod';

import type {
  CreateBufferWorldlineExecution,
  CreateCheckpointExecution,
  JeditWorldlineSession,
  ReplaceRangeAsTickExecution,
} from '../app/jedit-contract-runtime.js';
import type { WorldlineSnapshotReadingEnvelope } from '../app/jedit-observer-runtime.js';
import type { TextWindowReadingEnvelope } from '../app/jedit-observer-runtime.js';
import type {
  MutationOperationName,
  QueryOperationName,
} from '../generated/jedit/hot-text-runtime.types.generated.js';
import {
  createBufferWorldlineOperation,
  createCheckpointOperation,
  replaceRangeAsTickOperation,
  textWindowOperation,
  worldlineSnapshotOperation,
  type CreateBufferWorldlineRequest,
  type CreateCheckpointRequest,
  type ReplaceRangeAsTickRequest,
  type TextWindowRequest,
  type WorldlineSnapshotRequest,
} from '../generated/jedit/hot-text-runtime.wesley.generated.js';
import {
  BufferWorldlineSchema,
  CheckpointKindSchema,
  MutationOperationSchemas,
  QueryOperationSchemas,
  TickKindSchema,
} from '../generated/jedit/hot-text-runtime.zod.generated.js';

export const JEDIT_INTENT_REQUEST_KIND = 'jedit.intent-request';
export const JEDIT_OBSERVE_REQUEST_KIND = 'jedit.observe-request';
export const JEDIT_SCHEDULER_STATUS_KIND = 'jedit.scheduler-status';
export const JEDIT_TRANSPORT_STATUS_OK = 'OK';
export const JEDIT_TRANSPORT_STATUS_OBSTRUCTED = 'OBSTRUCTED';

export const CREATE_BUFFER_WORLDLINE_OPERATION = createBufferWorldlineOperation.fieldName;
export const REPLACE_RANGE_AS_TICK_OPERATION = replaceRangeAsTickOperation.fieldName;
export const CREATE_CHECKPOINT_OPERATION = createCheckpointOperation.fieldName;
export const WORLDLINE_SNAPSHOT_OPERATION = worldlineSnapshotOperation.fieldName;
export const TEXT_WINDOW_OPERATION = textWindowOperation.fieldName;

const SCHEDULER_STATE_IDLE = 'IDLE';

const TEXT_ENCODER = new TextEncoder();
const TEXT_DECODER = new TextDecoder();

const MutationOperationNameSchema = z.union([
  z.literal(CREATE_BUFFER_WORLDLINE_OPERATION),
  z.literal(REPLACE_RANGE_AS_TICK_OPERATION),
  z.literal(CREATE_CHECKPOINT_OPERATION),
]);

const QueryOperationNameSchema = z.union([
  z.literal(WORLDLINE_SNAPSHOT_OPERATION),
  z.literal(TEXT_WINDOW_OPERATION),
]);

const BufferRootSchema = z.object({
  id: z.number().int(),
  text: z.string(),
});

const AdmittedTickSchema = z.object({
  id: z.number().int(),
  rootId: z.number().int(),
});

const EditGroupSchema = z.object({
  id: z.number().int(),
  tickIds: z.array(z.number().int()),
});

const OpenEditGroupSchema = z.object({
  id: z.number().int(),
  tickIds: z.array(z.number().int()),
});

const SaveCheckpointSchema = z.object({
  id: z.number().int(),
  rootId: z.number().int(),
  path: z.string(),
});

const HotTextBufferStateSchema = z.object({
  path: z.string(),
  currentRoot: BufferRootSchema,
  ticks: z.array(AdmittedTickSchema),
  editGroups: z.array(EditGroupSchema),
  openEditGroup: OpenEditGroupSchema.optional(),
  checkpoints: z.array(SaveCheckpointSchema),
});

const TickMetadataSchema = z.object({
  tickId: z.number().int(),
  kind: TickKindSchema,
  author: z.string().optional(),
});

const CheckpointMetadataSchema = z.object({
  checkpointId: z.number().int(),
  kind: CheckpointKindSchema,
  label: z.string().optional(),
  createdByTickId: z.number().int().optional(),
});

const JeditWorldlineSessionSchema = z.object({
  worldline: BufferWorldlineSchema,
  state: HotTextBufferStateSchema,
  tickMetadata: z.array(TickMetadataSchema),
  checkpointMetadata: z.array(CheckpointMetadataSchema),
});

const CreateBufferWorldlineExecutionSchema = z.object({
  nextSession: JeditWorldlineSessionSchema,
  result: MutationOperationSchemas.createBufferWorldline.result,
});

const ReplaceRangeAsTickExecutionSchema = z.object({
  nextSession: JeditWorldlineSessionSchema,
  result: MutationOperationSchemas.replaceRangeAsTick.result.optional(),
});

const CreateCheckpointExecutionSchema = z.object({
  nextSession: JeditWorldlineSessionSchema,
  result: MutationOperationSchemas.createCheckpoint.result.optional(),
});

const WorldlineSnapshotReadingEnvelopeSchema = z.object({
  planId: z.string(),
  observerName: z.string(),
  operationName: z.literal(WORLDLINE_SNAPSHOT_OPERATION),
  frontierRef: z.string(),
  reading: QueryOperationSchemas.worldlineSnapshot.result,
});

const TextWindowReadingEnvelopeSchema = z.object({
  planId: z.string(),
  observerName: z.string(),
  operationName: z.literal(TEXT_WINDOW_OPERATION),
  frontierRef: z.string(),
  reading: QueryOperationSchemas.textWindow.result,
});

const CreateBufferWorldlineIntentRequestSchema = z.object({
  kind: z.literal(JEDIT_INTENT_REQUEST_KIND),
  operationName: z.literal(CREATE_BUFFER_WORLDLINE_OPERATION),
  input: MutationOperationSchemas.createBufferWorldline.input,
});

const ReplaceRangeAsTickIntentRequestSchema = z.object({
  kind: z.literal(JEDIT_INTENT_REQUEST_KIND),
  operationName: z.literal(REPLACE_RANGE_AS_TICK_OPERATION),
  session: JeditWorldlineSessionSchema,
  input: MutationOperationSchemas.replaceRangeAsTick.input,
});

const CreateCheckpointIntentRequestSchema = z.object({
  kind: z.literal(JEDIT_INTENT_REQUEST_KIND),
  operationName: z.literal(CREATE_CHECKPOINT_OPERATION),
  session: JeditWorldlineSessionSchema,
  input: MutationOperationSchemas.createCheckpoint.input,
});

const WorldlineSnapshotObserveRequestSchema = z.object({
  kind: z.literal(JEDIT_OBSERVE_REQUEST_KIND),
  operationName: z.literal(WORLDLINE_SNAPSHOT_OPERATION),
  session: JeditWorldlineSessionSchema,
  frontierRef: z.string(),
  input: QueryOperationSchemas.worldlineSnapshot.input,
});

const TextWindowObserveRequestSchema = z.object({
  kind: z.literal(JEDIT_OBSERVE_REQUEST_KIND),
  operationName: z.literal(TEXT_WINDOW_OPERATION),
  session: JeditWorldlineSessionSchema,
  frontierRef: z.string(),
  input: QueryOperationSchemas.textWindow.input,
});

const JeditTransportObstructionSchema = z.object({
  code: z.string(),
  message: z.string(),
  worldlineId: z.string().optional(),
  requestedBaseHeadId: z.string().optional(),
  currentHeadId: z.string().optional(),
  recovery: z.string().optional(),
});

const CreateBufferWorldlineIntentOkResponseSchema = z.object({
  status: z.literal(JEDIT_TRANSPORT_STATUS_OK),
  operationName: z.literal(CREATE_BUFFER_WORLDLINE_OPERATION),
  execution: CreateBufferWorldlineExecutionSchema,
});

const ReplaceRangeAsTickIntentOkResponseSchema = z.object({
  status: z.literal(JEDIT_TRANSPORT_STATUS_OK),
  operationName: z.literal(REPLACE_RANGE_AS_TICK_OPERATION),
  execution: ReplaceRangeAsTickExecutionSchema,
});

const CreateCheckpointIntentOkResponseSchema = z.object({
  status: z.literal(JEDIT_TRANSPORT_STATUS_OK),
  operationName: z.literal(CREATE_CHECKPOINT_OPERATION),
  execution: CreateCheckpointExecutionSchema,
});

const IntentObstructedResponseSchema = z.object({
  status: z.literal(JEDIT_TRANSPORT_STATUS_OBSTRUCTED),
  operationName: MutationOperationNameSchema,
  obstruction: JeditTransportObstructionSchema,
});

const WorldlineSnapshotObserveOkResponseSchema = z.object({
  status: z.literal(JEDIT_TRANSPORT_STATUS_OK),
  operationName: z.literal(WORLDLINE_SNAPSHOT_OPERATION),
  envelope: WorldlineSnapshotReadingEnvelopeSchema,
});

const TextWindowObserveOkResponseSchema = z.object({
  status: z.literal(JEDIT_TRANSPORT_STATUS_OK),
  operationName: z.literal(TEXT_WINDOW_OPERATION),
  envelope: TextWindowReadingEnvelopeSchema,
});

const ObserveObstructedResponseSchema = z.object({
  status: z.literal(JEDIT_TRANSPORT_STATUS_OBSTRUCTED),
  operationName: QueryOperationNameSchema,
  obstruction: JeditTransportObstructionSchema,
});

const SchedulerStatusSchema = z.object({
  kind: z.literal(JEDIT_SCHEDULER_STATUS_KIND),
  state: z.literal(SCHEDULER_STATE_IDLE),
  host: z.string(),
});

const JeditIntentRequestSchema = z.union([
  CreateBufferWorldlineIntentRequestSchema,
  ReplaceRangeAsTickIntentRequestSchema,
  CreateCheckpointIntentRequestSchema,
]);

const JeditObserveRequestSchema = z.union([
  WorldlineSnapshotObserveRequestSchema,
  TextWindowObserveRequestSchema,
]);

const JeditIntentResponseSchema = z.union([
  CreateBufferWorldlineIntentOkResponseSchema,
  ReplaceRangeAsTickIntentOkResponseSchema,
  CreateCheckpointIntentOkResponseSchema,
  IntentObstructedResponseSchema,
]);

const JeditObserveResponseSchema = z.union([
  WorldlineSnapshotObserveOkResponseSchema,
  TextWindowObserveOkResponseSchema,
  ObserveObstructedResponseSchema,
]);

export type JeditMutationOperationName = MutationOperationName;
export type JeditQueryOperationName = QueryOperationName;

export interface CreateBufferWorldlineIntentRequest {
  readonly kind: typeof JEDIT_INTENT_REQUEST_KIND;
  readonly operationName: typeof CREATE_BUFFER_WORLDLINE_OPERATION;
  readonly input: CreateBufferWorldlineRequest['input'];
}

export interface ReplaceRangeAsTickIntentRequest {
  readonly kind: typeof JEDIT_INTENT_REQUEST_KIND;
  readonly operationName: typeof REPLACE_RANGE_AS_TICK_OPERATION;
  readonly session: JeditWorldlineSession;
  readonly input: ReplaceRangeAsTickRequest['input'];
}

export interface CreateCheckpointIntentRequest {
  readonly kind: typeof JEDIT_INTENT_REQUEST_KIND;
  readonly operationName: typeof CREATE_CHECKPOINT_OPERATION;
  readonly session: JeditWorldlineSession;
  readonly input: CreateCheckpointRequest['input'];
}

export interface WorldlineSnapshotObserveRequest {
  readonly kind: typeof JEDIT_OBSERVE_REQUEST_KIND;
  readonly operationName: typeof WORLDLINE_SNAPSHOT_OPERATION;
  readonly session: JeditWorldlineSession;
  readonly frontierRef: string;
  readonly input: WorldlineSnapshotRequest['input'];
}

export interface TextWindowObserveRequest {
  readonly kind: typeof JEDIT_OBSERVE_REQUEST_KIND;
  readonly operationName: typeof TEXT_WINDOW_OPERATION;
  readonly session: JeditWorldlineSession;
  readonly frontierRef: string;
  readonly input: TextWindowRequest['input'];
}

export interface JeditTransportObstruction {
  readonly code: string;
  readonly message: string;
  readonly worldlineId?: string;
  readonly requestedBaseHeadId?: string;
  readonly currentHeadId?: string;
  readonly recovery?: string;
}

export interface CreateBufferWorldlineIntentOkResponse {
  readonly status: typeof JEDIT_TRANSPORT_STATUS_OK;
  readonly operationName: typeof CREATE_BUFFER_WORLDLINE_OPERATION;
  readonly execution: CreateBufferWorldlineExecution;
}

export interface ReplaceRangeAsTickIntentOkResponse {
  readonly status: typeof JEDIT_TRANSPORT_STATUS_OK;
  readonly operationName: typeof REPLACE_RANGE_AS_TICK_OPERATION;
  readonly execution: ReplaceRangeAsTickExecution;
}

export interface CreateCheckpointIntentOkResponse {
  readonly status: typeof JEDIT_TRANSPORT_STATUS_OK;
  readonly operationName: typeof CREATE_CHECKPOINT_OPERATION;
  readonly execution: CreateCheckpointExecution;
}

export interface JeditIntentObstructedResponse {
  readonly status: typeof JEDIT_TRANSPORT_STATUS_OBSTRUCTED;
  readonly operationName: JeditMutationOperationName;
  readonly obstruction: JeditTransportObstruction;
}

export interface WorldlineSnapshotObserveOkResponse {
  readonly status: typeof JEDIT_TRANSPORT_STATUS_OK;
  readonly operationName: typeof WORLDLINE_SNAPSHOT_OPERATION;
  readonly envelope: WorldlineSnapshotReadingEnvelope;
}

export interface TextWindowObserveOkResponse {
  readonly status: typeof JEDIT_TRANSPORT_STATUS_OK;
  readonly operationName: typeof TEXT_WINDOW_OPERATION;
  readonly envelope: TextWindowReadingEnvelope;
}

export interface JeditObserveObstructedResponse {
  readonly status: typeof JEDIT_TRANSPORT_STATUS_OBSTRUCTED;
  readonly operationName: JeditQueryOperationName;
  readonly obstruction: JeditTransportObstruction;
}

export interface JeditSchedulerStatus {
  readonly kind: typeof JEDIT_SCHEDULER_STATUS_KIND;
  readonly state: typeof SCHEDULER_STATE_IDLE;
  readonly host: string;
}

export type JeditIntentRequest =
  | CreateBufferWorldlineIntentRequest
  | ReplaceRangeAsTickIntentRequest
  | CreateCheckpointIntentRequest;
export type JeditObserveRequest =
  | WorldlineSnapshotObserveRequest
  | TextWindowObserveRequest;
export type JeditIntentResponse =
  | CreateBufferWorldlineIntentOkResponse
  | ReplaceRangeAsTickIntentOkResponse
  | CreateCheckpointIntentOkResponse
  | JeditIntentObstructedResponse;
export type JeditObserveResponse =
  | WorldlineSnapshotObserveOkResponse
  | TextWindowObserveOkResponse
  | JeditObserveObstructedResponse;

type JsonPrimitive = string | number | boolean | null;
type JsonObject = { readonly [key: string]: JsonValue };
type JsonValue = JsonPrimitive | JsonObject | readonly JsonValue[];

export function encodeJeditIntentRequest(request: JeditIntentRequest): Uint8Array {
  return encodeJson(JeditIntentRequestSchema.parse(request));
}

export function decodeJeditIntentRequest(bytes: Uint8Array): JeditIntentRequest {
  return JeditIntentRequestSchema.parse(parseJsonBytes(bytes));
}

export function encodeJeditObserveRequest(request: JeditObserveRequest): Uint8Array {
  return encodeJson(JeditObserveRequestSchema.parse(request));
}

export function decodeJeditObserveRequest(bytes: Uint8Array): JeditObserveRequest {
  return JeditObserveRequestSchema.parse(parseJsonBytes(bytes));
}

export function encodeJeditIntentResponse(response: JeditIntentResponse): Uint8Array {
  return encodeJson(JeditIntentResponseSchema.parse(response));
}

export function decodeJeditIntentResponse(bytes: Uint8Array): JeditIntentResponse {
  return JeditIntentResponseSchema.parse(parseJsonBytes(bytes));
}

export function encodeJeditObserveResponse(response: JeditObserveResponse): Uint8Array {
  return encodeJson(JeditObserveResponseSchema.parse(response));
}

export function decodeJeditObserveResponse(bytes: Uint8Array): JeditObserveResponse {
  return JeditObserveResponseSchema.parse(parseJsonBytes(bytes));
}

export function encodeJeditSchedulerStatus(status: JeditSchedulerStatus): Uint8Array {
  return encodeJson(SchedulerStatusSchema.parse(status));
}

export function toCreateBufferWorldlineExecution(
  execution: CreateBufferWorldlineExecution,
): CreateBufferWorldlineExecution {
  return execution;
}

export function toReplaceRangeAsTickExecution(
  execution: ReplaceRangeAsTickExecution,
): ReplaceRangeAsTickExecution {
  return execution;
}

export function toCreateCheckpointExecution(
  execution: CreateCheckpointExecution,
): CreateCheckpointExecution {
  return execution;
}

export function toWorldlineSnapshotReadingEnvelope(
  envelope: WorldlineSnapshotReadingEnvelope,
): WorldlineSnapshotReadingEnvelope {
  return envelope;
}

export function toTextWindowReadingEnvelope(
  envelope: TextWindowReadingEnvelope,
): TextWindowReadingEnvelope {
  return envelope;
}

function encodeJson(value: object): Uint8Array {
  return TEXT_ENCODER.encode(JSON.stringify(value));
}

function parseJsonBytes(bytes: Uint8Array): JsonValue {
  const value = JSON.parse(TEXT_DECODER.decode(bytes));
  if (!isJsonValue(value)) {
    throw new Error('invalid json payload');
  }
  return value;
}

function isJsonValue(value: unknown): value is JsonValue {
  if (value === null) {
    return true;
  }
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return true;
  }
  if (Array.isArray(value)) {
    return value.every(isJsonValue);
  }
  return isJsonRecord(value) && objectValuesAreJson(value);
}

function isJsonRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

function objectValuesAreJson(value: Record<string, unknown>): boolean {
  for (const key of Object.keys(value)) {
    const member = value[key];
    if (!isJsonValue(member)) {
      return false;
    }
  }
  return true;
}
