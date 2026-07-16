import type {
  WhyRangeFragment,
  WhyRangeOrigin,
  WhyRangeReading,
} from '../generated/jedit/rope.wesley.generated.js';
import {
  JEDIT_WHY_RANGE_PRODUCER_EVIDENCE_UNAVAILABLE_CODE,
  JeditWhyRangeOriginKinds,
  JeditWhyRangeProducerEvidenceKinds,
  REPORT_KIND_RANGE,
  REPORT_TITLE,
  RESULT_PRODUCED,
  type JeditWhyRangeFragment,
  type JeditWhyRangeOrigin,
  type JeditWhyRangeProduced,
  type JeditWhyRangeReport,
  type JeditWhyRangeWitness,
} from '../ports/jedit-why-range.js';

export function explainJeditWhyRange(reading: WhyRangeReading): JeditWhyRangeReport {
  const fragments = reading.fragments.map(toRangeFragment);
  return {
    kind: REPORT_KIND_RANGE,
    title: REPORT_TITLE,
    message: rangeWhyMessage(reading),
    witness: createRangeWitness(reading, fragments),
  };
}

function createRangeWitness(
  reading: WhyRangeReading,
  fragments: readonly JeditWhyRangeFragment[],
): JeditWhyRangeWitness {
  return {
    worldlineId: reading.worldlineId,
    basisHeadId: reading.basisHeadId,
    queriedRange: { startByte: reading.startByte, endByte: reading.endByte },
    result: createProducedResult(reading, fragments),
  };
}

function createProducedResult(
  reading: WhyRangeReading,
  fragments: readonly JeditWhyRangeFragment[],
): JeditWhyRangeProduced {
  return {
    kind: RESULT_PRODUCED,
    coverage: {
      kind: reading.coverage.kind,
      coveredRange: {
        startByte: reading.coverage.coveredStartByte,
        endByte: reading.coverage.coveredEndByte,
      },
      continuation: reading.coverage.continuation,
      reason: reading.coverage.reason,
    },
    fragments,
    relatedCheckpoints: reading.relatedCheckpoints.map(checkpoint => ({
      ...checkpoint,
      anchorAssociation: checkpoint.anchorAssociation == null
        ? null
        : { ...checkpoint.anchorAssociation },
    })),
    inspectedFactCount: reading.inspectedFactCount,
    observerVersion: reading.observerVersion,
  };
}

function toRangeFragment(fragment: WhyRangeFragment): JeditWhyRangeFragment {
  return {
    coveredRange: {
      startByte: fragment.coveredStartByte,
      endByte: fragment.coveredEndByte,
    },
    headId: fragment.headId,
    leafId: fragment.leafId,
    blobId: fragment.blobId,
    origin: toRangeOrigin(fragment.origin),
  };
}

function toRangeOrigin(origin: WhyRangeOrigin): JeditWhyRangeOrigin {
  if (origin.kind === JeditWhyRangeOriginKinds.Imported) {
    return {
      kind: JeditWhyRangeOriginKinds.Imported,
      worldlineId: requireEvidence(origin.worldlineId, 'worldlineId'),
      initialHeadId: requireEvidence(origin.initialHeadId, 'initialHeadId'),
      createdAtTickId: requireEvidence(origin.createdAtTickId, 'createdAtTickId'),
    };
  }
  if (origin.kind === JeditWhyRangeOriginKinds.Rewrite) {
    return {
      kind: JeditWhyRangeOriginKinds.Rewrite,
      rewriteId: requireEvidence(origin.rewriteId, 'rewriteId'),
      diffId: requireEvidence(origin.diffId, 'diffId'),
      textTickReceiptId: requireEvidence(origin.textTickReceiptId, 'textTickReceiptId'),
      basisHeadId: requireEvidence(origin.basisHeadId, 'basisHeadId'),
      nextHeadId: requireEvidence(origin.nextHeadId, 'nextHeadId'),
      producerEvidence: {
        kind: JeditWhyRangeProducerEvidenceKinds.Unavailable,
        code: JEDIT_WHY_RANGE_PRODUCER_EVIDENCE_UNAVAILABLE_CODE,
      },
    };
  }
  return {
    kind: 'UNAVAILABLE',
    code: requireEvidence(origin.unavailableCode, 'unavailableCode'),
  };
}

function rangeWhyMessage(reading: WhyRangeReading): string {
  const range = `${String(reading.startByte)}..${String(reading.endByte)}`;
  const origins = reading.fragments.map(fragment => originMessage(fragment)).join('; ');
  return `Range ${range} at head ${reading.basisHeadId}: ${origins}`;
}

function originMessage(fragment: WhyRangeFragment): string {
  const range = `${String(fragment.coveredStartByte)}..${String(fragment.coveredEndByte)}`;
  if (fragment.origin.kind === JeditWhyRangeOriginKinds.Imported) {
    return `${range} imported by ${requireEvidence(fragment.origin.createdAtTickId, 'createdAtTickId')}`;
  }
  if (fragment.origin.kind === JeditWhyRangeOriginKinds.Rewrite) {
    return [
      `${range} rewritten by ${requireEvidence(fragment.origin.rewriteId, 'rewriteId')}`,
      `diff ${requireEvidence(fragment.origin.diffId, 'diffId')}`,
      `receipt ${requireEvidence(fragment.origin.textTickReceiptId, 'textTickReceiptId')}`,
      `producer unavailable (${JEDIT_WHY_RANGE_PRODUCER_EVIDENCE_UNAVAILABLE_CODE})`,
    ].join(', ');
  }
  return `${range} unavailable: ${requireEvidence(fragment.origin.unavailableCode, 'unavailableCode')}`;
}

function requireEvidence(value: string | null, fieldName: string): string {
  if (value == null || value.length === 0) {
    throw new JeditWhyRangeEvidenceError(`Range why origin omitted required ${fieldName} evidence.`);
  }
  return value;
}

export class JeditWhyRangeEvidenceError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'JeditWhyRangeEvidenceError';
  }
}
