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

const EDICT_LANGUAGE = 'edict';
const EDICT_EXTENSION = '.edict';
const ECHO_TARGET_COORDINATE = 'echo.dpo@1';
const ECHO_TARGET_PROFILE_DIGEST = 'sha256:1111111111111111111111111111111111111111111111111111111111111111';
const ECHO_TARGET_IR_DOMAIN = 'echo.span-ir/v1';
const REVIEW_SUMMARY_PREFIX = 'review: ';
const EDICT_STATUS_OK = 'ok';
const TYPE_STRING = 'string';
const SUMMARY_ITEM_LIMIT = 3;
const REVIEW_PAYLOAD_OBJECT_KEY_SCAN_LIMIT = 64;
const REVIEW_PAYLOAD_ENTRY_LIMIT = 4;
const REVIEW_PAYLOAD_DEPTH_LIMIT = 4;
const OBJECT_HAS_OWN = Object.prototype.hasOwnProperty;

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
  return reviewPayloadObject(review, 0);
}

function reviewPayloadObject(review: object, depth: number): GraftJsonObject {
  if (depth >= REVIEW_PAYLOAD_DEPTH_LIMIT) {
    return {};
  }

  const result: Record<string, GraftJsonValue> = {};
  let scanned = 0;
  for (const key in review) {
    if (!OBJECT_HAS_OWN.call(review, key)) {
      continue;
    }
    if (scanned >= REVIEW_PAYLOAD_OBJECT_KEY_SCAN_LIMIT) {
      break;
    }
    result[key] = reviewPayloadValue(Reflect.get(review, key), depth + 1);
    scanned += 1;
  }
  return result;
}

function reviewPayloadValue(value: GraftJsonValue, depth: number): GraftJsonValue {
  if (Array.isArray(value)) {
    return reviewPayloadArray(value, depth);
  }
  if (typeof value === 'object' && value !== null) {
    return reviewPayloadObject(value, depth);
  }
  if (typeof value === TYPE_STRING || typeof value === 'number' || typeof value === 'boolean' || value === null) {
    return value;
  }
  return null;
}

function reviewPayloadArray(value: readonly GraftJsonValue[], depth: number): readonly GraftJsonValue[] {
  if (depth >= REVIEW_PAYLOAD_DEPTH_LIMIT) {
    return [];
  }
  return value
    .slice(0, REVIEW_PAYLOAD_ENTRY_LIMIT)
    .map((entry) => reviewPayloadValue(entry, depth + 1));
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
