import type { QueryOperationMap } from '../generated/jedit/rope.types.generated.js';
import { QueryOperationSchemas } from '../generated/jedit/rope.zod.generated.js';
import { queryCausalLineDiffOperation } from '../generated/jedit/rope.wesley.generated.js';
import type { HotTextRuntimePort } from '../ports/hot-text-runtime.js';
import type { JeditWorldlineSession } from './jedit-contract-runtime.js';
import { jeditQueryObserverPlanId } from './jedit-contract-package.js';

const OBSERVER_NAME = 'causalLineDiff';
const UNAVAILABLE_MESSAGE = 'Causal line diff observation is unavailable for this text authority.';
const WORLDLINE_MISMATCH_MESSAGE = 'Causal line diff worldline does not match the observed session.';

type CausalLineDiffInput = QueryOperationMap['causalLineDiff']['input'];
type CausalLineDiffReading = QueryOperationMap['causalLineDiff']['result'];

export interface CausalLineDiffReadingEnvelope {
  readonly planId: string;
  readonly observerName: typeof OBSERVER_NAME;
  readonly operationName: typeof queryCausalLineDiffOperation.fieldName;
  readonly frontierRef: string;
  readonly reading: CausalLineDiffReading;
}

export function readCausalLineDiffWithObserverPlan(
  runtime: HotTextRuntimePort,
  session: JeditWorldlineSession,
  frontierRef: string,
  input: CausalLineDiffInput,
): CausalLineDiffReadingEnvelope {
  const validatedInput = QueryOperationSchemas.causalLineDiff.input.parse(input);
  if (validatedInput.worldlineId !== session.worldline.worldlineId) {
    throw new CausalLineDiffRuntimeError(WORLDLINE_MISMATCH_MESSAGE);
  }
  if (runtime.causalLineDiff == null) {
    throw new CausalLineDiffRuntimeError(UNAVAILABLE_MESSAGE);
  }
  const reading = runtime.causalLineDiff(session.state, validatedInput);
  return {
    planId: jeditQueryObserverPlanId(queryCausalLineDiffOperation.fieldName),
    observerName: OBSERVER_NAME,
    operationName: queryCausalLineDiffOperation.fieldName,
    frontierRef,
    reading: QueryOperationSchemas.causalLineDiff.result.parse({
      ...reading,
      rewriteIds: [...reading.rewriteIds],
      diffIds: [...reading.diffIds],
    }),
  };
}

export class CausalLineDiffRuntimeError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'CausalLineDiffRuntimeError';
  }
}
