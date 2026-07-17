import { z } from 'zod';
import type {
  CreateBufferWorldlineExecution,
  CreateCheckpointExecution,
  JeditWorldlineSession,
  ReplaceRangeAsTickExecution,
} from '../app/jedit-contract-runtime.js';
import type { TextWindowReadingEnvelope, WorldlineSnapshotReadingEnvelope } from '../app/jedit-observer-runtime.js';
import type { CausalLineDiffReadingEnvelope } from '../app/jedit-causal-line-diff-observer.js';
import type { WhyRangeReadingEnvelope } from '../app/jedit-why-range-observer.js';
import type { MutationOperationName, QueryOperationName } from '../generated/jedit/rope.types.generated.js';
import {
  mutationCreateBufferWorldlineOperation,
  mutationCreateCheckpointOperation,
  mutationReplaceRangeAsTickOperation,
  queryCausalLineDiffOperation,
  queryTextWindowOperation,
  queryWhyRangeOperation,
  queryWorldlineSnapshotOperation,
  type MutationCreateBufferWorldlineRequest,
  type MutationCreateCheckpointRequest,
  type MutationReplaceRangeAsTickRequest,
  type QueryTextWindowRequest,
  type QueryCausalLineDiffRequest,
  type QueryWhyRangeRequest,
  type QueryWorldlineSnapshotRequest,
} from '../generated/jedit/rope.wesley.generated.js';
import {
  MutationOperationSchemas,
  QueryOperationSchemas,
} from '../generated/jedit/rope.zod.generated.js';
import { HotTextWindowProjectionSchema } from './hot-text-window-codec.js';
import { JeditRetainedEvidenceInventorySchema } from './jedit-retained-evidence-codec.js';
import { JeditTextWindowMaterializationProvenanceSchema } from './jedit-text-window-materialization-codec.js';
import { JeditWorldlineSessionSchema } from './jedit-worldline-session-codec.js';
import { WhyRangeInputSchema, WhyRangeReadingSchema } from './jedit-why-range-codec.js';
import { encodeJsonObject, parseJsonBytes } from './json-wire-codec.js';
// EINT envelope codec re-export (kept here so adapters import wire and
// envelope codecs from one module — see quality-gate import cap).
export {
  decodeJeditMutationIntentEnvelope, encodeJeditMutationIntentEnvelope, UnknownMutationOpIdError,
  type DecodedJeditMutationIntent, type JeditMutationEnvelopeInput,
} from './jedit-mutation-envelope-codec.js';
export { InvalidJsonPayloadError } from './json-wire-codec.js';

export const JEDIT_INTENT_REQUEST_KIND = 'jedit.intent-request';
export const JEDIT_OBSERVE_REQUEST_KIND = 'jedit.observe-request';
export const JEDIT_SCHEDULER_STATUS_KIND = 'jedit.scheduler-status';
export const JEDIT_TRANSPORT_STATUS_OK = 'OK';
export const JEDIT_TRANSPORT_STATUS_OBSTRUCTED = 'OBSTRUCTED';

export const CREATE_BUFFER_WORLDLINE_OPERATION = mutationCreateBufferWorldlineOperation.fieldName;
export const REPLACE_RANGE_AS_TICK_OPERATION = mutationReplaceRangeAsTickOperation.fieldName;
export const CREATE_CHECKPOINT_OPERATION = mutationCreateCheckpointOperation.fieldName;
export const WORLDLINE_SNAPSHOT_OPERATION = queryWorldlineSnapshotOperation.fieldName;
export const TEXT_WINDOW_OPERATION = queryTextWindowOperation.fieldName;
export const CAUSAL_LINE_DIFF_OPERATION = queryCausalLineDiffOperation.fieldName;
export const WHY_RANGE_OPERATION = queryWhyRangeOperation.fieldName;

const SCHEDULER_STATE_IDLE = 'IDLE';

const MutationOperationNameSchema = z.union([
  z.literal(CREATE_BUFFER_WORLDLINE_OPERATION),
  z.literal(REPLACE_RANGE_AS_TICK_OPERATION),
  z.literal(CREATE_CHECKPOINT_OPERATION),
]);

const QueryOperationNameSchema = z.union([
  z.literal(WORLDLINE_SNAPSHOT_OPERATION),
  z.literal(TEXT_WINDOW_OPERATION),
  z.literal(CAUSAL_LINE_DIFF_OPERATION),
  z.literal(WHY_RANGE_OPERATION),
]);

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
  projection: HotTextWindowProjectionSchema, materialization: JeditTextWindowMaterializationProvenanceSchema,
  retainedEvidence: JeditRetainedEvidenceInventorySchema,
});

const CausalLineDiffReadingEnvelopeSchema = z.object({
  planId: z.string(),
  observerName: z.literal(CAUSAL_LINE_DIFF_OPERATION),
  operationName: z.literal(CAUSAL_LINE_DIFF_OPERATION),
  frontierRef: z.string(),
  reading: QueryOperationSchemas.causalLineDiff.result,
});

const WhyRangeReadingEnvelopeSchema = z.object({
  planId: z.string(),
  observerName: z.literal(WHY_RANGE_OPERATION),
  operationName: z.literal(WHY_RANGE_OPERATION),
  frontierRef: z.string(),
  reading: WhyRangeReadingSchema,
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

const CausalLineDiffObserveRequestSchema = z.object({
  kind: z.literal(JEDIT_OBSERVE_REQUEST_KIND),
  operationName: z.literal(CAUSAL_LINE_DIFF_OPERATION),
  session: JeditWorldlineSessionSchema,
  frontierRef: z.string(),
  input: QueryOperationSchemas.causalLineDiff.input,
});

const WhyRangeObserveRequestSchema = z.object({
  kind: z.literal(JEDIT_OBSERVE_REQUEST_KIND),
  operationName: z.literal(WHY_RANGE_OPERATION),
  session: JeditWorldlineSessionSchema,
  frontierRef: z.string(),
  input: WhyRangeInputSchema,
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

/**
 * Decode-failure obstruction: envelope could not be parsed, so the
 * operation name is not known. Discriminated by
 * obstruction.code === 'JEDIT_MUTATION_ENVELOPE_INVALID'.
 */
const IntentDecodeFailureObstructedResponseSchema = z.object({
  status: z.literal(JEDIT_TRANSPORT_STATUS_OBSTRUCTED),
  obstruction: JeditTransportObstructionSchema.extend({
    code: z.literal('JEDIT_MUTATION_ENVELOPE_INVALID'),
  }),
}).strict();

/**
 * Normal intent obstruction: operationName is REQUIRED. Covers anything
 * past the envelope decode boundary (package gate, session gate, base-
 * head mismatch, capability denial, execution-stage failures). The code
 * is REFINED to forbid JEDIT_MUTATION_ENVELOPE_INVALID — owned by the
 * decode-failure variant; otherwise that mixed state revalidates.
 */
const IntentNormalObstructedResponseSchema = z.object({
  status: z.literal(JEDIT_TRANSPORT_STATUS_OBSTRUCTED),
  operationName: MutationOperationNameSchema,
  obstruction: JeditTransportObstructionSchema.refine(
    (obstruction) => obstruction.code !== 'JEDIT_MUTATION_ENVELOPE_INVALID',
    { message: 'code JEDIT_MUTATION_ENVELOPE_INVALID is reserved for IntentDecodeFailureObstructedResponse (no operationName)' },
  ),
});

// Split union makes the illegal state "obstructed without operationName
// but also without the decode-failure marker" unrepresentable at the
// schema/type level.
const IntentObstructedResponseSchema = z.union([
  IntentDecodeFailureObstructedResponseSchema,
  IntentNormalObstructedResponseSchema,
]);

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

const CausalLineDiffObserveOkResponseSchema = z.object({
  status: z.literal(JEDIT_TRANSPORT_STATUS_OK),
  operationName: z.literal(CAUSAL_LINE_DIFF_OPERATION),
  envelope: CausalLineDiffReadingEnvelopeSchema,
});

const WhyRangeObserveOkResponseSchema = z.object({
  status: z.literal(JEDIT_TRANSPORT_STATUS_OK),
  operationName: z.literal(WHY_RANGE_OPERATION),
  envelope: WhyRangeReadingEnvelopeSchema,
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

const JeditObserveRequestSchema = z.union([
  WorldlineSnapshotObserveRequestSchema,
  TextWindowObserveRequestSchema,
  CausalLineDiffObserveRequestSchema,
  WhyRangeObserveRequestSchema,
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
  CausalLineDiffObserveOkResponseSchema,
  WhyRangeObserveOkResponseSchema,
  ObserveObstructedResponseSchema,
]);

export type JeditMutationOperationName = MutationOperationName;
export type JeditQueryOperationName = QueryOperationName | typeof WHY_RANGE_OPERATION;

type InputOf<Request extends { readonly input: object }> = Request['input'];

export interface CreateBufferWorldlineIntentRequest {
  readonly kind: typeof JEDIT_INTENT_REQUEST_KIND;
  readonly operationName: typeof CREATE_BUFFER_WORLDLINE_OPERATION;
  readonly input: InputOf<MutationCreateBufferWorldlineRequest>;
}

export interface ReplaceRangeAsTickIntentRequest {
  readonly kind: typeof JEDIT_INTENT_REQUEST_KIND;
  readonly operationName: typeof REPLACE_RANGE_AS_TICK_OPERATION;
  readonly session: JeditWorldlineSession;
  readonly input: InputOf<MutationReplaceRangeAsTickRequest>;
}

export interface CreateCheckpointIntentRequest {
  readonly kind: typeof JEDIT_INTENT_REQUEST_KIND;
  readonly operationName: typeof CREATE_CHECKPOINT_OPERATION;
  readonly session: JeditWorldlineSession;
  readonly input: InputOf<MutationCreateCheckpointRequest>;
}

export interface WorldlineSnapshotObserveRequest {
  readonly kind: typeof JEDIT_OBSERVE_REQUEST_KIND;
  readonly operationName: typeof WORLDLINE_SNAPSHOT_OPERATION;
  readonly session: JeditWorldlineSession;
  readonly frontierRef: string;
  readonly input: InputOf<QueryWorldlineSnapshotRequest>;
}

export interface TextWindowObserveRequest {
  readonly kind: typeof JEDIT_OBSERVE_REQUEST_KIND;
  readonly operationName: typeof TEXT_WINDOW_OPERATION;
  readonly session: JeditWorldlineSession;
  readonly frontierRef: string;
  readonly input: InputOf<QueryTextWindowRequest>;
}

export interface CausalLineDiffObserveRequest {
  readonly kind: typeof JEDIT_OBSERVE_REQUEST_KIND;
  readonly operationName: typeof CAUSAL_LINE_DIFF_OPERATION;
  readonly session: JeditWorldlineSession;
  readonly frontierRef: string;
  readonly input: InputOf<QueryCausalLineDiffRequest>;
}

export interface WhyRangeObserveRequest {
  readonly kind: typeof JEDIT_OBSERVE_REQUEST_KIND;
  readonly operationName: typeof WHY_RANGE_OPERATION;
  readonly session: JeditWorldlineSession;
  readonly frontierRef: string;
  readonly input: InputOf<QueryWhyRangeRequest>;
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

/**
 * Decode-failure obstruction: envelope failed to parse, operation name
 * is unknown. Discriminated by `obstruction.code` ===
 * `'JEDIT_MUTATION_ENVELOPE_INVALID'`. Carries no operationName field.
 */
export interface JeditIntentDecodeFailureObstructedResponse {
  readonly status: typeof JEDIT_TRANSPORT_STATUS_OBSTRUCTED;
  readonly obstruction: JeditTransportObstruction & {
    readonly code: 'JEDIT_MUTATION_ENVELOPE_INVALID';
  };
}

/**
 * Normal intent obstruction: operationName is REQUIRED. Covers
 * package-not-installed, session-gate, head-inbox admission (base-head
 * mismatch), capability denied, execution-stage failures.
 */
export interface JeditIntentNormalObstructedResponse {
  readonly status: typeof JEDIT_TRANSPORT_STATUS_OBSTRUCTED;
  readonly operationName: JeditMutationOperationName;
  readonly obstruction: JeditTransportObstruction;
}

/**
 * Discriminated union over obstructed intent responses. The two variants
 * make the illegal state "obstructed without operationName but also
 * without the decode-failure marker" unrepresentable at the type level.
 * Consumers branch on `'operationName' in response` (or equivalently on
 * `response.obstruction.code === 'JEDIT_MUTATION_ENVELOPE_INVALID'`).
 */
export type JeditIntentObstructedResponse =
  | JeditIntentDecodeFailureObstructedResponse
  | JeditIntentNormalObstructedResponse;

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

export interface CausalLineDiffObserveOkResponse {
  readonly status: typeof JEDIT_TRANSPORT_STATUS_OK;
  readonly operationName: typeof CAUSAL_LINE_DIFF_OPERATION;
  readonly envelope: CausalLineDiffReadingEnvelope;
}

export interface WhyRangeObserveOkResponse {
  readonly status: typeof JEDIT_TRANSPORT_STATUS_OK;
  readonly operationName: typeof WHY_RANGE_OPERATION;
  readonly envelope: WhyRangeReadingEnvelope;
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
  | TextWindowObserveRequest
  | CausalLineDiffObserveRequest
  | WhyRangeObserveRequest;
export type JeditIntentResponse =
  | CreateBufferWorldlineIntentOkResponse
  | ReplaceRangeAsTickIntentOkResponse
  | CreateCheckpointIntentOkResponse
  | JeditIntentObstructedResponse;
export type JeditObserveResponse =
  | WorldlineSnapshotObserveOkResponse
  | TextWindowObserveOkResponse
  | CausalLineDiffObserveOkResponse
  | WhyRangeObserveOkResponse
  | JeditObserveObstructedResponse;

export function encodeJeditObserveRequest(request: JeditObserveRequest): Uint8Array {
  return encodeJsonObject(JeditObserveRequestSchema.parse(request));
}

export function decodeJeditObserveRequest(bytes: Uint8Array): JeditObserveRequest {
  return JeditObserveRequestSchema.parse(parseJsonBytes(bytes));
}

export function encodeJeditIntentResponse(response: JeditIntentResponse): Uint8Array {
  return encodeJsonObject(JeditIntentResponseSchema.parse(response));
}

export function decodeJeditIntentResponse(bytes: Uint8Array): JeditIntentResponse {
  return JeditIntentResponseSchema.parse(parseJsonBytes(bytes));
}

export function encodeJeditObserveResponse(response: JeditObserveResponse): Uint8Array {
  return encodeJsonObject(JeditObserveResponseSchema.parse(response));
}

export function decodeJeditObserveResponse(bytes: Uint8Array): JeditObserveResponse {
  return JeditObserveResponseSchema.parse(parseJsonBytes(bytes));
}

export function encodeJeditSchedulerStatus(status: JeditSchedulerStatus): Uint8Array {
  return encodeJsonObject(SchedulerStatusSchema.parse(status));
}
