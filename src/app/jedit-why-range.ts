import type { JeditWorldlineSession, TickMetadata } from './jedit-contract-runtime.js';
import { toReceiptId, toTickId } from './jedit-contract-runtime-id.js';
import {
  BTR_MISSING,
  CAUSAL_HISTORY_AVAILABLE,
  CAUSAL_HISTORY_UNAVAILABLE,
  COORDINATE_KIND_RANGE_AT_HEAD,
  REPORT_KIND_RANGE,
  REPORT_TITLE,
  RESULT_PRODUCED,
  RESULT_UNAVAILABLE,
  type JeditWhyByteRange,
  type JeditWhyRangeEvidencePosture,
  type JeditWhyRangeReport,
  type JeditWhyRangeResult,
  type JeditWhyRangeReverseWalk,
  type JeditWhyRangeUnavailable,
  type JeditWhyRangeWitness,
} from '../ports/jedit-why-range.js';

const UNAVAILABLE_HORIZON_CODE = 'jedit_why_range_retained_history_horizon';
const UNAVAILABLE_MISSING_DIFF_CODE = 'jedit_why_range_missing_retained_diff';
const UNAVAILABLE_PARTIAL_OVERLAP_CODE = 'jedit_why_range_partial_overlap_unavailable';
const UNAVAILABLE_EMPTY_RANGE_CODE = 'jedit_why_range_empty_query';
const ZERO_BYTES = 0;

interface RetainedRopeDiff {
  readonly ropeRewriteId: string;
  readonly ropeDiffId: string;
  readonly baseHeadId: string;
  readonly nextHeadId: string;
  readonly startByte: number;
  readonly endByte: number;
  readonly insertedByteLength: number;
  readonly deletedByteLength: number;
}

interface ReverseWalkResult {
  readonly reverseWalk: JeditWhyRangeReverseWalk;
  readonly result: JeditWhyRangeResult;
}

export function explainJeditWhyRange(
  session: JeditWorldlineSession,
  range: JeditWhyByteRange,
): JeditWhyRangeReport {
  const witness = createRangeWitness(session, range);
  return {
    kind: REPORT_KIND_RANGE,
    title: REPORT_TITLE,
    message: rangeWhyMessage(witness),
    witness,
  };
}

function createRangeWitness(
  session: JeditWorldlineSession,
  range: JeditWhyByteRange,
): JeditWhyRangeWitness {
  const walked = reverseWalkRange(session.tickMetadata, range);
  return {
    worldlineId: session.worldline.worldlineId,
    currentHeadId: session.worldline.canonicalHeadId,
    queriedRange: range,
    reverseWalk: walked.reverseWalk,
    result: walked.result,
    evidencePosture: evidencePosture(walked.result),
  };
}

function reverseWalkRange(
  tickMetadata: readonly TickMetadata[],
  range: JeditWhyByteRange,
): ReverseWalkResult {
  if (range.startByte >= range.endByte) {
    return unavailableWalk([], emptyRangeUnavailable());
  }
  let currentRange = range;
  const inspectedDiffIds: string[] = [];
  for (const tick of [...tickMetadata].reverse()) {
    const diff = retainedRopeDiff(tick);
    if (diff == null) {
      return unavailableWalk(inspectedDiffIds, missingDiffUnavailable(tick));
    }
    inspectedDiffIds.push(diff.ropeDiffId);
    if (diffProducesRange(diff, currentRange)) {
      return producedWalk(inspectedDiffIds, diff);
    }
    const mapped = mapRangeBeforeDiff(currentRange, diff);
    if (mapped == null) {
      return unavailableWalk(inspectedDiffIds, partialOverlapUnavailable(diff));
    }
    currentRange = mapped;
  }
  return unavailableWalk(inspectedDiffIds, retainedHistoryHorizonUnavailable());
}

function retainedRopeDiff(tick: TickMetadata): RetainedRopeDiff | undefined {
  const baseHeadId = tick.baseHeadId;
  const nextHeadId = tick.nextHeadId;
  const startByte = tick.startByte;
  const endByte = tick.endByte;
  const insertedByteLength = tick.insertedByteLength;
  const deletedByteLength = tick.deletedByteLength;
  if (baseHeadId == null || nextHeadId == null || startByte == null || endByte == null) {
    return undefined;
  }
  if (insertedByteLength == null || deletedByteLength == null) {
    return undefined;
  }
  return {
    ropeRewriteId: toTickId(tick.tickId),
    ropeDiffId: toReceiptId(tick.tickId),
    baseHeadId,
    nextHeadId,
    startByte,
    endByte,
    insertedByteLength,
    deletedByteLength,
  };
}

function diffProducesRange(diff: RetainedRopeDiff, range: JeditWhyByteRange): boolean {
  return diff.insertedByteLength > ZERO_BYTES && rangeContains(insertedRange(diff), range);
}

function mapRangeBeforeDiff(
  range: JeditWhyByteRange,
  diff: RetainedRopeDiff,
): JeditWhyByteRange | undefined {
  const startByte = diff.startByte;
  const insertedEndByte = diff.startByte + diff.insertedByteLength;
  const delta = diff.insertedByteLength - diff.deletedByteLength;
  if (range.endByte <= startByte) {
    return range;
  }
  if (range.startByte >= insertedEndByte) {
    return offsetRange(range, -delta);
  }
  return undefined;
}

function producedWalk(
  inspectedDiffIds: readonly string[],
  diff: RetainedRopeDiff,
): ReverseWalkResult {
  return {
    reverseWalk: reverseWalk(inspectedDiffIds),
    result: {
      kind: RESULT_PRODUCED,
      ropeRewriteId: diff.ropeRewriteId,
      ropeDiffId: diff.ropeDiffId,
      tickId: diff.ropeRewriteId,
      receiptId: diff.ropeDiffId,
      baseHeadId: diff.baseHeadId,
      nextHeadId: diff.nextHeadId,
      startByte: diff.startByte,
      endByte: diff.endByte,
      insertedByteLength: diff.insertedByteLength,
      deletedByteLength: diff.deletedByteLength,
    },
  };
}

function unavailableWalk(
  inspectedDiffIds: readonly string[],
  result: JeditWhyRangeUnavailable,
): ReverseWalkResult {
  return {
    reverseWalk: reverseWalk(inspectedDiffIds),
    result,
  };
}

function reverseWalk(inspectedDiffIds: readonly string[]): JeditWhyRangeReverseWalk {
  return {
    coordinateKind: COORDINATE_KIND_RANGE_AT_HEAD,
    inspectedDiffIds,
  };
}

function evidencePosture(result: JeditWhyRangeResult): JeditWhyRangeEvidencePosture {
  return result.kind === RESULT_PRODUCED
    ? { causalHistory: CAUSAL_HISTORY_AVAILABLE, btr: BTR_MISSING }
    : { causalHistory: CAUSAL_HISTORY_UNAVAILABLE, btr: BTR_MISSING };
}

function rangeWhyMessage(witness: JeditWhyRangeWitness): string {
  if (witness.result.kind !== RESULT_PRODUCED) {
    return `No retained rope diff proves range ${formatRange(witness.queriedRange)}: ${witness.result.code}`;
  }
  return [
    `range: ${formatRange(witness.queriedRange)}`,
    `head: ${witness.currentHeadId}`,
    `ropeDiff ${witness.result.ropeDiffId}`,
    `ropeRewrite ${witness.result.ropeRewriteId}`,
    `tick ${witness.result.tickId}`,
    `receipt ${witness.result.receiptId}`,
    'BTR provenance: missing',
  ].join(' | ');
}

function insertedRange(diff: RetainedRopeDiff): JeditWhyByteRange {
  return {
    startByte: diff.startByte,
    endByte: diff.startByte + diff.insertedByteLength,
  };
}

function rangeContains(outer: JeditWhyByteRange, inner: JeditWhyByteRange): boolean {
  return outer.startByte <= inner.startByte && inner.endByte <= outer.endByte;
}

function offsetRange(range: JeditWhyByteRange, offset: number): JeditWhyByteRange {
  return {
    startByte: range.startByte + offset,
    endByte: range.endByte + offset,
  };
}

function formatRange(range: JeditWhyByteRange): string {
  return `${range.startByte}..${range.endByte}`;
}

function emptyRangeUnavailable(): JeditWhyRangeUnavailable {
  return {
    kind: RESULT_UNAVAILABLE,
    code: UNAVAILABLE_EMPTY_RANGE_CODE,
    reason: 'Range why requires a non-empty range-at-head query.',
  };
}

function missingDiffUnavailable(tick: TickMetadata): JeditWhyRangeUnavailable {
  return {
    kind: RESULT_UNAVAILABLE,
    code: UNAVAILABLE_MISSING_DIFF_CODE,
    reason: `Tick ${toTickId(tick.tickId)} has no retained rope diff coordinates.`,
  };
}

function partialOverlapUnavailable(diff: RetainedRopeDiff): JeditWhyRangeUnavailable {
  return {
    kind: RESULT_UNAVAILABLE,
    code: UNAVAILABLE_PARTIAL_OVERLAP_CODE,
    reason: `Range crosses retained diff ${diff.ropeDiffId}; split the query into a narrower range.`,
  };
}

function retainedHistoryHorizonUnavailable(): JeditWhyRangeUnavailable {
  return {
    kind: RESULT_UNAVAILABLE,
    code: UNAVAILABLE_HORIZON_CODE,
    reason: 'Retained rope history does not identify a producing diff for this range.',
  };
}
