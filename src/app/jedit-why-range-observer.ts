import type { JeditWorldlineSession } from './jedit-contract-runtime.js';
import { jeditQueryObserverPlanId } from './jedit-contract-package.js';
import {
  queryWhyRangeOperation,
  type QueryWhyRangeRequest,
  type WhyRangeInput,
  type WhyRangeReading,
} from '../generated/jedit/rope.wesley.generated.js';
import type { HotTextRuntimePort } from '../ports/hot-text-runtime.js';

const OBSERVER_NAME = queryWhyRangeOperation.fieldName;
const UNAVAILABLE_MESSAGE = 'Range why observation is unavailable for this text authority.';
const WORLDLINE_MISMATCH_MESSAGE = 'Range why worldline does not match the observed session.';
const BASIS_MISMATCH_MESSAGE = 'Range why returned a different worldline or head basis.';
const RANGE_MISMATCH_MESSAGE = 'Range why returned evidence for a different byte range.';
const COMPLETE_COVERAGE_KIND = 'COMPLETE';

export interface WhyRangeReadingEnvelope {
  readonly planId: string;
  readonly observerName: typeof OBSERVER_NAME;
  readonly operationName: typeof queryWhyRangeOperation.fieldName;
  readonly frontierRef: string;
  readonly reading: WhyRangeReading;
}

export function readWhyRangeWithObserverPlan(
  runtime: HotTextRuntimePort,
  session: JeditWorldlineSession,
  frontierRef: string,
  input: QueryWhyRangeRequest['input'],
): WhyRangeReadingEnvelope {
  if (input.worldlineId !== session.worldline.worldlineId) {
    throw new WhyRangeRuntimeError(WORLDLINE_MISMATCH_MESSAGE);
  }
  if (runtime.whyRange == null) {
    throw new WhyRangeRuntimeError(UNAVAILABLE_MESSAGE);
  }
  const reading = runtime.whyRange(session.state, input);
  if (reading.worldlineId !== input.worldlineId || reading.basisHeadId !== input.basisHeadId) {
    throw new WhyRangeRuntimeError(BASIS_MISMATCH_MESSAGE);
  }
  if (!readingRangeMatchesRequest(reading, input)) {
    throw new WhyRangeRuntimeError(RANGE_MISMATCH_MESSAGE);
  }
  return {
    planId: jeditQueryObserverPlanId(queryWhyRangeOperation.fieldName),
    observerName: OBSERVER_NAME,
    operationName: queryWhyRangeOperation.fieldName,
    frontierRef,
    reading: cloneWhyRangeReading(reading),
  };
}

function readingRangeMatchesRequest(reading: WhyRangeReading, input: WhyRangeInput): boolean {
  return reading.startByte === input.startByte
    && reading.endByte === input.endByte
    && coverageMatchesRequest(reading, input);
}

function coverageMatchesRequest(reading: WhyRangeReading, input: WhyRangeInput): boolean {
  const coverage = reading.coverage;
  const withinRequest = input.startByte <= coverage.coveredStartByte
    && coverage.coveredStartByte <= coverage.coveredEndByte
    && coverage.coveredEndByte <= input.endByte;
  return coverage.kind === COMPLETE_COVERAGE_KIND
    ? coverage.coveredStartByte === input.startByte && coverage.coveredEndByte === input.endByte
    : withinRequest;
}

function cloneWhyRangeReading(reading: WhyRangeReading): WhyRangeReading {
  return {
    ...reading,
    coverage: { ...reading.coverage },
    fragments: reading.fragments.map(fragment => ({
      ...fragment,
      origin: { ...fragment.origin },
    })),
    relatedCheckpoints: reading.relatedCheckpoints.map(checkpoint => ({
      ...checkpoint,
      anchorAssociation: checkpoint.anchorAssociation == null
        ? null
        : { ...checkpoint.anchorAssociation },
    })),
  };
}

export class WhyRangeRuntimeError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'WhyRangeRuntimeError';
  }
}
