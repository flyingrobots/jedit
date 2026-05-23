import type {
  TextWindowReadingEnvelope,
  WorldlineSnapshotReadingEnvelope,
} from './jedit-observer-runtime.js';
import {
  readTextWindowWithObserverPlan,
  readWorldlineSnapshotWithObserverPlan,
} from './jedit-observer-runtime.js';
import type { JeditWorldlineSession } from './jedit-contract-runtime.js';
import type {
  QueryOperationMap,
} from '../generated/jedit/hot-text-runtime.types.generated.js';
import {
  queryTextWindowOperation,
  queryWorldlineSnapshotOperation,
} from '../generated/jedit/hot-text-runtime.wesley.generated.js';
import type { HashPort } from '../ports/hash.js';
import type { HotTextRuntimePort } from '../ports/hot-text-runtime.js';

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
}

export interface JeditContractQueryObserverRegistry {
  readonly queryOperationNames: readonly string[];
  supportsQueryObserver(operationName: string): boolean;
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
      return readWorldlineSnapshotWithObserverPlan(
        options.runtime,
        request.session,
        request.frontierRef,
        request.input,
        options.hash,
      );
    case queryTextWindowOperation.fieldName:
      return readTextWindowWithObserverPlan(
        options.runtime,
        request.session,
        request.frontierRef,
        request.input,
        options.hash,
      );
  }
}
