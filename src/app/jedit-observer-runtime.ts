import type {
  QueryOperationMap,
} from '../generated/jedit/hot-text-runtime.types.generated.js';
import { QueryOperationSchemas } from '../generated/jedit/hot-text-runtime.zod.generated.js';
import { worldlineSnapshotObserverPlan } from '../generated/jedit/worldlineSnapshot.observer-plan.generated.js';
import type { HotTextRuntimePort } from '../ports/hot-text-runtime.js';
import type { JeditWorldlineSession } from './jedit-contract-runtime.js';
import { readWorldlineSnapshot } from './jedit-contract-runtime.js';

type WorldlineSnapshotInput = QueryOperationMap['worldlineSnapshot']['input'];
type WorldlineSnapshotReading = QueryOperationMap['worldlineSnapshot']['result'];

export interface WorldlineSnapshotReadingEnvelope {
  readonly planId: string;
  readonly observerName: string;
  readonly operationName: string;
  readonly frontierRef: string;
  readonly reading: WorldlineSnapshotReading;
}

export function readWorldlineSnapshotWithObserverPlan(
  runtime: HotTextRuntimePort,
  session: JeditWorldlineSession,
  frontierRef: string,
  input: WorldlineSnapshotInput,
): WorldlineSnapshotReadingEnvelope {
  const schemas = QueryOperationSchemas.worldlineSnapshot;
  const parsedInput = schemas.input.parse(input);
  const reading = readWorldlineSnapshot(runtime, session, parsedInput);

  return {
    planId: worldlineSnapshotObserverPlan.planId,
    observerName: worldlineSnapshotObserverPlan.observerName,
    operationName: worldlineSnapshotObserverPlan.operationName,
    frontierRef,
    reading: schemas.result.parse(reading),
  };
}
