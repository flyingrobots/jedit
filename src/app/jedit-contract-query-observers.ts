import type {
  TextWindowReadingEnvelope,
  WorldlineSnapshotReadingEnvelope,
} from './jedit-observer-runtime.js';
import {
  readTextWindowWithObserverPlan,
  readWorldlineSnapshotWithObserverPlan,
} from './jedit-observer-runtime.js';
import { requireJeditContractFactSet } from './jedit-contract-state-port.js';
import type { JeditWorldlineSession } from './jedit-contract-runtime.js';
import type {
  QueryOperationMap,
} from '../generated/jedit/rope.types.generated.js';
import {
  queryTextWindowOperation,
  queryWorldlineSnapshotOperation,
} from '../generated/jedit/rope.wesley.generated.js';
import type { HashPort } from '../ports/hash.js';
import type { HotTextRuntimePort } from '../ports/hot-text-runtime.js';
import type { JeditContractStatePort } from '../ports/jedit-contract-state-port.js';

type WorldlineSnapshotInput = QueryOperationMap['worldlineSnapshot']['input'];
type TextWindowInput = QueryOperationMap['textWindow']['input'];

export type JeditContractQueryObserverRequest =
  | JeditWorldlineSnapshotObserverRequest
  | JeditTextWindowObserverRequest;

export type JeditContractQueryObserverResult =
  | WorldlineSnapshotReadingEnvelope
  | TextWindowReadingEnvelope;

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
  observeQuery(
    request: JeditContractQueryObserverRequest,
  ): JeditContractQueryObserverResult;
}

export function createJeditContractQueryObserverRegistry(
  options: JeditContractQueryObserverRegistryOptions,
): JeditContractQueryObserverRegistry {
  const queryOperationNames: readonly string[] = Object.freeze([
    queryWorldlineSnapshotOperation.fieldName,
    queryTextWindowOperation.fieldName,
  ]);

  return Object.freeze({
    queryOperationNames,
    supportsQueryObserver(operationName: string): boolean {
      return queryOperationNames.includes(operationName);
    },
    observeWorldlineSnapshot(
      request: JeditWorldlineSnapshotObserverRequest,
    ): WorldlineSnapshotReadingEnvelope {
      return observeWorldlineSnapshot(options, request);
    },
    observeTextWindow(
      request: JeditTextWindowObserverRequest,
    ): TextWindowReadingEnvelope {
      return observeTextWindow(options, request);
    },
    observeQuery(
      request: JeditContractQueryObserverRequest,
    ): JeditContractQueryObserverResult {
      return observeJeditQuery(options, request);
    },
  });
}

function observeJeditQuery(
  options: JeditContractQueryObserverRegistryOptions,
  request: JeditContractQueryObserverRequest,
): JeditContractQueryObserverResult {
  switch (request.operationName) {
    case queryWorldlineSnapshotOperation.fieldName:
      return observeWorldlineSnapshot(options, request);
    case queryTextWindowOperation.fieldName:
      return observeTextWindow(options, request);
  }
}

function observeWorldlineSnapshot(
  options: JeditContractQueryObserverRegistryOptions,
  request: JeditWorldlineSnapshotObserverRequest,
): WorldlineSnapshotReadingEnvelope {
  requireStateIfAvailable(options, request.input.worldlineId);
  return readWorldlineSnapshotWithObserverPlan(
    options.runtime,
    request.session,
    request.frontierRef,
    request.input,
    options.hash,
  );
}

function observeTextWindow(
  options: JeditContractQueryObserverRegistryOptions,
  request: JeditTextWindowObserverRequest,
): TextWindowReadingEnvelope {
  requireStateIfAvailable(options, request.input.worldlineId);
  return readTextWindowWithObserverPlan(
    options.runtime,
    request.session,
    request.frontierRef,
    request.input,
    options.hash,
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
