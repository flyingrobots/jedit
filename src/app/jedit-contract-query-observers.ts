import type {
  CausalLineDiffReadingEnvelope,
} from './jedit-causal-line-diff-observer.js';
import {
  readCausalLineDiffWithObserverPlan,
} from './jedit-causal-line-diff-observer.js';
import type {
  JeditTextWindowObserver,
  TextWindowReadingEnvelope,
  WorldlineSnapshotReadingEnvelope,
} from './jedit-observer-runtime.js';
import {
  createJeditTextWindowObserver,
  readWorldlineSnapshotWithObserverPlan,
} from './jedit-observer-runtime.js';
import { requireJeditContractFactSet } from './jedit-contract-state-port.js';
import type { JeditWorldlineSession } from './jedit-contract-runtime.js';
import type {
  QueryOperationMap,
} from '../generated/jedit/rope.types.generated.js';
import {
  queryTextWindowOperation,
  queryCausalLineDiffOperation,
  queryWorldlineSnapshotOperation,
} from '../generated/jedit/rope.wesley.generated.js';
import type { HashPort } from '../ports/hash.js';
import type { HotTextRuntimePort } from '../ports/hot-text-runtime.js';
import type { JeditContractStatePort } from '../ports/jedit-contract-state-port.js';

type WorldlineSnapshotInput = QueryOperationMap['worldlineSnapshot']['input'];
type TextWindowInput = QueryOperationMap['textWindow']['input'];
type CausalLineDiffInput = QueryOperationMap['causalLineDiff']['input'];

export type JeditContractQueryObserverRequest =
  | JeditWorldlineSnapshotObserverRequest
  | JeditTextWindowObserverRequest
  | JeditCausalLineDiffObserverRequest;

export type JeditContractQueryObserverResult =
  | WorldlineSnapshotReadingEnvelope
  | TextWindowReadingEnvelope
  | CausalLineDiffReadingEnvelope;

export interface JeditWorldlineSnapshotObserverRequest {
  readonly operationName: typeof queryWorldlineSnapshotOperation.fieldName;
  readonly session: JeditWorldlineSession;
  readonly frontierRef: string;
  readonly input: WorldlineSnapshotInput;
}

export interface JeditTextWindowObserverRequest {
  readonly operationName: typeof queryTextWindowOperation.fieldName;
  readonly session: JeditWorldlineSession;
  readonly frontierRef: string;
  readonly input: TextWindowInput;
}

export interface JeditCausalLineDiffObserverRequest {
  readonly operationName: typeof queryCausalLineDiffOperation.fieldName;
  readonly session: JeditWorldlineSession;
  readonly frontierRef: string;
  readonly input: CausalLineDiffInput;
}

export interface JeditContractQueryObserverRegistryOptions {
  readonly runtime: HotTextRuntimePort;
  readonly hash: HashPort;
  readonly statePort?: JeditContractStatePort;
}

export interface JeditContractQueryObserverRegistry {
  readonly queryOperationNames: readonly string[];
  supportsQueryObserver(operationName: string): boolean;
  observeWorldlineSnapshot(
    request: JeditWorldlineSnapshotObserverRequest,
  ): WorldlineSnapshotReadingEnvelope;
  observeTextWindow(
    request: JeditTextWindowObserverRequest,
  ): TextWindowReadingEnvelope;
  observeCausalLineDiff(
    request: JeditCausalLineDiffObserverRequest,
  ): CausalLineDiffReadingEnvelope;
  observeQuery(
    request: JeditContractQueryObserverRequest,
  ): JeditContractQueryObserverResult;
}

interface JeditContractQueryObserverContext extends JeditContractQueryObserverRegistryOptions {
  readonly textWindowObserver: JeditTextWindowObserver;
}

export function createJeditContractQueryObserverRegistry(
  options: JeditContractQueryObserverRegistryOptions,
): JeditContractQueryObserverRegistry {
  const context: JeditContractQueryObserverContext = Object.freeze({
    ...options,
    textWindowObserver: createJeditTextWindowObserver(options.runtime, options.hash),
  });
  const queryOperationNames: readonly string[] = Object.freeze([
    queryWorldlineSnapshotOperation.fieldName,
    queryTextWindowOperation.fieldName,
    queryCausalLineDiffOperation.fieldName,
  ]);

  return Object.freeze({
    queryOperationNames,
    supportsQueryObserver(operationName: string): boolean {
      return queryOperationNames.includes(operationName);
    },
    observeWorldlineSnapshot(
      request: JeditWorldlineSnapshotObserverRequest,
    ): WorldlineSnapshotReadingEnvelope {
      return observeWorldlineSnapshot(context, request);
    },
    observeTextWindow(
      request: JeditTextWindowObserverRequest,
    ): TextWindowReadingEnvelope {
      return observeTextWindow(context, request);
    },
    observeCausalLineDiff(
      request: JeditCausalLineDiffObserverRequest,
    ): CausalLineDiffReadingEnvelope {
      return observeCausalLineDiff(context, request);
    },
    observeQuery(
      request: JeditContractQueryObserverRequest,
    ): JeditContractQueryObserverResult {
      return observeJeditQuery(context, request);
    },
  });
}

function observeJeditQuery(
  context: JeditContractQueryObserverContext,
  request: JeditContractQueryObserverRequest,
): JeditContractQueryObserverResult {
  switch (request.operationName) {
    case queryWorldlineSnapshotOperation.fieldName:
      return observeWorldlineSnapshot(context, request);
    case queryTextWindowOperation.fieldName:
      return observeTextWindow(context, request);
    case queryCausalLineDiffOperation.fieldName:
      return observeCausalLineDiff(context, request);
  }
}

function observeCausalLineDiff(
  context: JeditContractQueryObserverContext,
  request: JeditCausalLineDiffObserverRequest,
): CausalLineDiffReadingEnvelope {
  requireStateIfAvailable(context, request.input.worldlineId);
  return readCausalLineDiffWithObserverPlan(
    context.runtime,
    request.session,
    request.frontierRef,
    request.input,
  );
}

function observeWorldlineSnapshot(
  context: JeditContractQueryObserverContext,
  request: JeditWorldlineSnapshotObserverRequest,
): WorldlineSnapshotReadingEnvelope {
  requireStateIfAvailable(context, request.input.worldlineId);
  return readWorldlineSnapshotWithObserverPlan(
    context.runtime,
    request.session,
    request.frontierRef,
    request.input,
    context.hash,
  );
}

function observeTextWindow(
  context: JeditContractQueryObserverContext,
  request: JeditTextWindowObserverRequest,
): TextWindowReadingEnvelope {
  requireStateIfAvailable(context, request.input.worldlineId);
  return context.textWindowObserver.read(
    request.session,
    request.frontierRef,
    request.input,
  );
}

function requireStateIfAvailable(
  options: JeditContractQueryObserverRegistryOptions,
  worldlineId: string,
): void {
  if (options.statePort != null) {
    requireJeditContractFactSet(options.statePort, worldlineId);
  }
}
