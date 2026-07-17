import {
  queryCausalLineDiffOperation,
  type CausalLineDiffInput,
  type CausalLineDiffReading,
} from '../generated/jedit/rope.wesley.generated.js';
import type { HotTextRuntimePort } from '../ports/hot-text-runtime.js';
import type { JeditWorldlineSession } from './jedit-contract-runtime.js';
import { jeditQueryObserverPlanId } from './jedit-contract-package.js';
import {
  CausalLineDiffInputSchema,
  CausalLineDiffReadingSchema,
} from './jedit-hot-text-json-schemas.js';

const OBSERVER_NAME = 'causalLineDiff';
const UNAVAILABLE_MESSAGE = 'Causal line diff observation is unavailable for this text authority.';
const WORLDLINE_MISMATCH_MESSAGE = 'Causal line diff worldline does not match the observed session.';

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
  const validatedInput = CausalLineDiffInputSchema.parse(input);
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
    reading: CausalLineDiffReadingSchema.parse({
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
