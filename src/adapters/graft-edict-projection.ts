import { spawnSync } from 'node:child_process';
import type {
  EdictProjectionBundle,
  EdictProjectionProvider,
  EdictProjectionSlot,
  EdictProjectionTargetSettings,
  EdictTargetIrProjection,
} from '@flyingrobots/graft';
import {
  GraftProjectionPostures,
  GraftProjectionSlotStates,
  GraftProjectionSources,
  type GraftEchoTargetIrProjectionLane,
  type GraftEdictProjectionLane,
  type GraftJsonObject,
  type GraftJsonValue,
  type GraftProjectionPanelLane,
  type GraftProjectionPosture,
  type GraftProjectionSource,
} from '../ports/graft-session.js';
import { graftProjectionPanelLanes } from '../ports/graft-projection-lanes.js';
import {
  REVIEW_PAYLOAD_DEPTH_LIMIT,
  REVIEW_PAYLOAD_ENTRY_LIMIT,
  REVIEW_PAYLOAD_OBJECT_KEY_SCAN_LIMIT,
} from '../ports/graft-review-payload-limits.js';

const EDICT_LANGUAGE = 'edict';
const EDICT_EXTENSION = '.edict';
const ECHO_TARGET_COORDINATE = 'echo.dpo@1';
const ECHO_TARGET_PROFILE_DIGEST = 'sha256:1111111111111111111111111111111111111111111111111111111111111111';
const ECHO_TARGET_IR_DOMAIN = 'echo.span-ir/v1';
const REVIEW_SUMMARY_PREFIX = 'review: ';
const EDICT_STATUS_OK = 'ok';
const TYPE_STRING = 'string';
const SUMMARY_ITEM_LIMIT = 3;
const REVIEW_PAYLOAD_NODE_BUDGET = 512;
const REVIEW_PAYLOAD_OMITTED_KEY = '$jeditReviewPayloadOmitted';
const REVIEW_PAYLOAD_OMITTED_TEXT = 'review payload omitted by adapter bounds';
const REVIEW_PAYLOAD_DEPTH_OMITTED_TEXT = 'review payload depth omitted by adapter bounds';
const REVIEW_PAYLOAD_ACCESSOR_OMITTED_TEXT = 'review payload accessor omitted by adapter bounds';
const REVIEW_PAYLOAD_HAS_OWN = Object.prototype.hasOwnProperty;

const DEFAULT_ECHO_TARGET: EdictProjectionTargetSettings = {
  coordinate: ECHO_TARGET_COORDINATE,
  profileDigest: ECHO_TARGET_PROFILE_DIGEST,
  irDomain: ECHO_TARGET_IR_DOMAIN,
};

interface ProcessRunRequest {
  readonly command: string;
  readonly args: readonly string[];
  readonly cwd: string;
  readonly stdin?: string;
  readonly timeoutMs?: number;
  readonly maxBufferBytes?: number;
}

interface ProcessRunResult {
  readonly status: number | null;
  readonly stdout: string;
  readonly stderr: string;
  readonly error?: Error;
}

interface ProcessRunner {
  run(request: ProcessRunRequest): ProcessRunResult;
}

interface GraftStructuredBuffer {
  edictProjection(): EdictProjectionBundle | null;
  dispose(): void;
}

export interface GraftEdictProjectionApi {
  createEdictCliProjectionProvider(options: {
    readonly processRunner: ProcessRunner;
    readonly cwd: string;
    readonly target?: EdictProjectionTargetSettings;
  }): EdictProjectionProvider;
  createStructuredBuffer(
    path: string,
    content: string,
    options: {
      readonly language: typeof EDICT_LANGUAGE;
      readonly edictProjector: EdictProjectionProvider;
    },
  ): GraftStructuredBuffer;
}

export interface LiveEdictProjectionInput {
  readonly api: GraftEdictProjectionApi;
  readonly workspaceRoot: string;
  readonly relativePath: string;
  readonly sourceText?: string;
}

export interface LiveEdictProjectionResult {
  readonly projectionSource: GraftProjectionSource;
  readonly projectionPosture: GraftProjectionPosture;
  readonly outlineItems: readonly [];
  readonly projectionLanes?: readonly GraftProjectionPanelLane[];
  readonly edictCoreProjection?: GraftEdictProjectionLane;
  readonly echoTargetIrProjection?: GraftEchoTargetIrProjectionLane;
  readonly error?: string;
}

export function loadLiveEdictProjection(input: LiveEdictProjectionInput): LiveEdictProjectionResult | null {
  const sourceText = input.sourceText;
  if (!shouldUseLiveEdictProjection(input) || sourceText === undefined) {
    return null;
  }

  try {
    return liveEdictProjection({ ...input, sourceText });
  } catch (cause) {
    return failedLiveEdictProjection(cause instanceof Error ? cause.message : String(cause));
  }
}

function shouldUseLiveEdictProjection(input: LiveEdictProjectionInput): boolean {
  return input.sourceText !== undefined
    && input.relativePath.toLowerCase().endsWith(EDICT_EXTENSION);
}

function liveEdictProjection(input: Required<LiveEdictProjectionInput>): LiveEdictProjectionResult {
  const edictProjector = input.api.createEdictCliProjectionProvider({
    processRunner: NODE_PROCESS_RUNNER,
    cwd: input.workspaceRoot,
    target: DEFAULT_ECHO_TARGET,
  });
  const buffer = input.api.createStructuredBuffer(input.relativePath, input.sourceText, {
    language: EDICT_LANGUAGE,
    edictProjector,
  });

  try {
    const projection = buffer.edictProjection();
    return projection == null
      ? unavailableLiveEdictProjection()
      : availableLiveEdictProjection(projection);
  } finally {
    buffer.dispose();
  }
}

function availableLiveEdictProjection(projection: EdictProjectionBundle): LiveEdictProjectionResult {
  const coreProjection = coreLaneFromSlot(projection.core);
  const targetIrProjection = targetIrLaneFromSlot(projection.targetIr);
  return {
    projectionSource: GraftProjectionSources.LiveBuffer,
    projectionPosture: edictProjectionPosture(projection),
    outlineItems: [],
    projectionLanes: graftProjectionPanelLanes({
      edictCoreProjection: coreProjection,
      echoTargetIrProjection: targetIrProjection,
      edictCoreReviewPayload: projection.core.state === GraftProjectionSlotStates.Available
        ? reviewPayloadFromProjection(projection.core.value.review)
        : undefined,
      echoTargetIrReviewPayload: projection.targetIr.state === GraftProjectionSlotStates.Available
        ? reviewPayloadFromProjection(projection.targetIr.value.review)
        : undefined,
    }),
    edictCoreProjection: coreProjection,
    echoTargetIrProjection: targetIrProjection,
  };
}

function edictProjectionPosture(projection: EdictProjectionBundle): GraftProjectionPosture {
  if (projection.status.status !== EDICT_STATUS_OK || projection.diagnostics.items.length > 0) {
    return GraftProjectionPostures.Obstructed;
  }
  if (projection.core.state === GraftProjectionSlotStates.Failed
    || projection.core.state === GraftProjectionSlotStates.Blocked
    || projection.targetIr.state === GraftProjectionSlotStates.Failed
    || projection.targetIr.state === GraftProjectionSlotStates.Blocked) {
    return GraftProjectionPostures.Obstructed;
  }
  return GraftProjectionPostures.Current;
}

function coreLaneFromSlot(slot: EdictProjectionSlot<{ readonly digest: string; readonly review: object }>): GraftEdictProjectionLane {
  if (slot.state !== GraftProjectionSlotStates.Available) {
    return unavailableProjectionLane(slot);
  }
  return {
    state: GraftProjectionSlotStates.Available,
    digest: slot.value.digest,
    summaryLines: reviewSummaryLines(slot.value.review),
  };
}

function targetIrLaneFromSlot(slot: EdictProjectionSlot<EdictTargetIrProjection>): GraftEchoTargetIrProjectionLane {
  if (slot.state !== GraftProjectionSlotStates.Available) {
    return unavailableProjectionLane(slot);
  }
  return {
    state: GraftProjectionSlotStates.Available,
    digest: slot.value.digest,
    domain: slot.value.domain,
    targetCoordinate: slot.value.target.coordinate,
    targetProfileDigest: slot.value.target.digest,
    summaryLines: reviewSummaryLines(slot.value.review),
  };
}

function unavailableProjectionLane<TValue>(slot: EdictProjectionSlot<TValue>): GraftEdictProjectionLane {
  if (slot.state === GraftProjectionSlotStates.Blocked) {
    return {
      state: GraftProjectionSlotStates.Blocked,
      summaryLines: [`blocked: ${String(slot.reason.length)} reason(s)`],
    };
  }
  if (slot.state === GraftProjectionSlotStates.Failed) {
    return {
      state: GraftProjectionSlotStates.Failed,
      summaryLines: [`failed: ${projectionFailureLabel(slot.error)}`],
    };
  }
  return {
    state: GraftProjectionSlotStates.NotRequested,
    summaryLines: [],
  };
}

function projectionFailureLabel(error: { readonly kind: string; readonly message?: string }): string {
  return error.message == null ? error.kind : `${error.kind}: ${error.message}`;
}

function reviewSummaryLines(review: object): readonly string[] {
  const keys = Object.keys(review).sort();
  if (keys.length === 0) {
    return [`${REVIEW_SUMMARY_PREFIX}{}`];
  }
  const visibleKeys = keys.slice(0, SUMMARY_ITEM_LIMIT);
  const hiddenCount = keys.length - visibleKeys.length;
  return [
    hiddenCount === 0
      ? `${REVIEW_SUMMARY_PREFIX}${visibleKeys.join(', ')}`
      : `${REVIEW_SUMMARY_PREFIX}${visibleKeys.join(', ')}, ... ${String(hiddenCount)} more`,
  ];
}

function reviewPayloadFromProjection(review: object): GraftJsonObject {
  return reviewPayloadObject(review, 0, { remaining: REVIEW_PAYLOAD_NODE_BUDGET });
}

interface ReviewPayloadBudget {
  remaining: number;
}

function reviewPayloadObject(review: object, depth: number, budget: ReviewPayloadBudget): GraftJsonObject {
  const result: Record<string, GraftJsonValue> = {};
  if (depth >= REVIEW_PAYLOAD_DEPTH_LIMIT) {
    setReviewPayloadProperty(result, REVIEW_PAYLOAD_OMITTED_KEY, REVIEW_PAYLOAD_DEPTH_OMITTED_TEXT);
    return result;
  }
  if (!consumeReviewPayloadBudget(budget)) {
    setReviewPayloadProperty(result, REVIEW_PAYLOAD_OMITTED_KEY, REVIEW_PAYLOAD_OMITTED_TEXT);
    return result;
  }

  const keys = reviewPayloadVisibleKeys(review);
  for (const key of keys.visibleKeys) {
    if (!consumeReviewPayloadBudget(budget)) {
      setReviewPayloadProperty(result, REVIEW_PAYLOAD_OMITTED_KEY, REVIEW_PAYLOAD_OMITTED_TEXT);
      return result;
    }
    setReviewPayloadProperty(result, key, reviewPayloadPropertyValue(review, key, depth + 1, budget));
  }
  if (keys.omittedCount > 0) {
    setReviewPayloadProperty(
      result,
      REVIEW_PAYLOAD_OMITTED_KEY,
      omittedReviewPayloadText(keys.omittedCount, keys.omittedIsLowerBound),
    );
  }
  return result;
}

interface ReviewPayloadVisibleKeys {
  readonly visibleKeys: readonly string[];
  readonly omittedCount: number;
  readonly omittedIsLowerBound: boolean;
}

function reviewPayloadVisibleKeys(review: object): ReviewPayloadVisibleKeys {
  const visibleKeys: string[] = [];
  let omittedIsLowerBound = false;
  for (const key in review) {
    if (!REVIEW_PAYLOAD_HAS_OWN.call(review, key)) {
      continue;
    }
    if (visibleKeys.length >= REVIEW_PAYLOAD_OBJECT_KEY_SCAN_LIMIT - 1) {
      omittedIsLowerBound = true;
      break;
    }
    visibleKeys.push(key);
  }
  return {
    visibleKeys,
    omittedCount: omittedIsLowerBound ? 1 : 0,
    omittedIsLowerBound,
  };
}

function reviewPayloadPropertyValue(
  review: object,
  key: string,
  depth: number,
  budget: ReviewPayloadBudget,
): GraftJsonValue {
  const descriptor = Object.getOwnPropertyDescriptor(review, key);
  if (descriptor == null || !('value' in descriptor)) {
    return REVIEW_PAYLOAD_ACCESSOR_OMITTED_TEXT;
  }
  return reviewPayloadValue(descriptor.value, depth, budget);
}

function reviewPayloadValue(value: GraftJsonValue, depth: number, budget: ReviewPayloadBudget): GraftJsonValue {
  if (!consumeReviewPayloadBudget(budget)) {
    return REVIEW_PAYLOAD_OMITTED_TEXT;
  }
  if (Array.isArray(value)) {
    return reviewPayloadArray(value, depth, budget);
  }
  if (typeof value === 'object' && value !== null) {
    return reviewPayloadObject(value, depth, budget);
  }
  if (isReviewPayloadPrimitive(value)) {
    return value;
  }
  return null;
}

function isReviewPayloadPrimitive(value: GraftJsonValue): boolean {
  return typeof value === TYPE_STRING
    || typeof value === 'number'
    || typeof value === 'boolean'
    || value === null;
}

function reviewPayloadArray(value: readonly GraftJsonValue[], depth: number, budget: ReviewPayloadBudget): readonly GraftJsonValue[] {
  if (depth >= REVIEW_PAYLOAD_DEPTH_LIMIT) {
    return [REVIEW_PAYLOAD_DEPTH_OMITTED_TEXT];
  }
  const visibleItemCount = value.length > REVIEW_PAYLOAD_ENTRY_LIMIT
    ? REVIEW_PAYLOAD_ENTRY_LIMIT - 1
    : value.length;
  return value
    .slice(0, visibleItemCount)
    .map((entry) => reviewPayloadValue(entry, depth + 1, budget))
    .concat(value.length > visibleItemCount ? [omittedReviewPayloadText(value.length - visibleItemCount)] : []);
}

function consumeReviewPayloadBudget(budget: ReviewPayloadBudget): boolean {
  if (budget.remaining <= 0) {
    return false;
  }
  budget.remaining -= 1;
  return true;
}

function omittedReviewPayloadText(omittedCount: number, omittedIsLowerBound = false): string {
  const count = omittedIsLowerBound
    ? `at least ${String(omittedCount)}`
    : String(omittedCount);
  return `${REVIEW_PAYLOAD_OMITTED_TEXT}: ${count} more entries`;
}

function setReviewPayloadProperty(result: Record<string, GraftJsonValue>, key: string, value: GraftJsonValue): void {
  Object.defineProperty(result, key, {
    configurable: true,
    enumerable: true,
    value,
    writable: false,
  });
}

function unavailableLiveEdictProjection(): LiveEdictProjectionResult {
  return {
    projectionSource: GraftProjectionSources.LiveBuffer,
    projectionPosture: GraftProjectionPostures.Obstructed,
    outlineItems: [],
    error: 'Edict projection unavailable.',
  };
}

function failedLiveEdictProjection(message: string): LiveEdictProjectionResult {
  return {
    projectionSource: GraftProjectionSources.LiveBuffer,
    projectionPosture: GraftProjectionPostures.Obstructed,
    outlineItems: [],
    error: `Edict projection failed: ${message}`,
  };
}

const NODE_PROCESS_RUNNER: ProcessRunner = {
  run(request) {
    const result = spawnSync(request.command, [...request.args], {
      cwd: request.cwd,
      encoding: 'utf8',
      input: request.stdin,
      stdio: ['pipe', 'pipe', 'pipe'],
      ...(request.timeoutMs === undefined ? {} : { timeout: request.timeoutMs }),
      ...(request.maxBufferBytes === undefined ? {} : { maxBuffer: request.maxBufferBytes }),
    });
    return {
      status: result.status,
      stdout: typeof result.stdout === TYPE_STRING ? result.stdout : '',
      stderr: typeof result.stderr === TYPE_STRING ? result.stderr : '',
      ...(result.error === undefined ? {} : { error: result.error }),
    };
  },
};
