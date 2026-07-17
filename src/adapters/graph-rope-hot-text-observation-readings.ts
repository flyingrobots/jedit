import {
  GRAPH_ROPE_RANGE_WHY_ORIGIN_IMPORTED,
  type GraphRopeCausalLineDiffReading,
  type GraphRopeRangeWhyCheckpointEvidence,
  type GraphRopeRangeWhyOrigin,
  type GraphRopeRangeWhyReading,
} from '../domain/graph-rope-runtime.js';
import type {
  WhyRangeCheckpointEvidence,
  WhyRangeOrigin,
  WhyRangeReading,
} from '../generated/jedit/rope.wesley.generated.js';
import type { HotTextCausalLineDiffReading } from '../ports/hot-text-runtime.js';

export function graphCausalLineDiffReading(
  reading: GraphRopeCausalLineDiffReading,
): HotTextCausalLineDiffReading {
  return {
    ...reading,
    tickReceiptIds: [...reading.tickReceiptIds],
    rewriteIds: [...reading.rewriteIds],
    diffIds: [...reading.diffIds],
    markers: reading.markers.map(marker => ({
      ...marker,
      tickReceiptIds: [...marker.tickReceiptIds],
      rewriteIds: [...marker.rewriteIds],
      diffIds: [...marker.diffIds],
    })),
    deletions: reading.deletions.map(deletion => ({
      ...deletion,
      tickReceiptIds: [...deletion.tickReceiptIds],
      rewriteIds: [...deletion.rewriteIds],
      diffIds: [...deletion.diffIds],
    })),
  };
}

export function graphRangeWhyReading(reading: GraphRopeRangeWhyReading): WhyRangeReading {
  return {
    worldlineId: reading.worldlineId,
    basisHeadId: reading.basisHeadId,
    startByte: reading.queriedRange.startByte.value,
    endByte: reading.queriedRange.endByte.value,
    coverage: {
      kind: 'COMPLETE',
      coveredStartByte: reading.coverage.coveredRange.startByte.value,
      coveredEndByte: reading.coverage.coveredRange.endByte.value,
      continuation: null,
      reason: null,
    },
    fragments: reading.fragments.map(fragment => ({
      coveredStartByte: fragment.coveredRange.startByte.value,
      coveredEndByte: fragment.coveredRange.endByte.value,
      headId: fragment.headId,
      leafId: fragment.leafId,
      blobId: fragment.blobId,
      origin: graphRangeWhyOrigin(fragment.origin),
    })),
    relatedCheckpoints: reading.relatedCheckpoints.map(graphRangeWhyCheckpoint),
    inspectedFactCount: reading.inspectedFactCount,
    observerVersion: reading.observerVersion,
  };
}

function graphRangeWhyOrigin(origin: GraphRopeRangeWhyOrigin): WhyRangeOrigin {
  if (origin.kind === GRAPH_ROPE_RANGE_WHY_ORIGIN_IMPORTED) {
    return {
      kind: 'IMPORTED',
      worldlineId: origin.worldlineId,
      initialHeadId: origin.initialHeadId,
      createdAtTickId: origin.createdAtTickId,
      rewriteId: null,
      diffId: null,
      textTickReceiptId: null,
      basisHeadId: null,
      nextHeadId: null,
      unavailableCode: null,
    };
  }
  return {
    kind: 'REWRITE',
    worldlineId: null,
    initialHeadId: null,
    createdAtTickId: null,
    rewriteId: origin.rewriteId,
    diffId: origin.diffId,
    textTickReceiptId: origin.textTickReceiptId,
    basisHeadId: origin.basisHeadId,
    nextHeadId: origin.nextHeadId,
    unavailableCode: null,
  };
}

function graphRangeWhyCheckpoint(
  checkpoint: GraphRopeRangeWhyCheckpointEvidence,
): WhyRangeCheckpointEvidence {
  return {
    checkpointId: checkpoint.checkpointId,
    headId: checkpoint.headId,
    reason: checkpoint.reason,
    anchorAssociation: checkpoint.anchorAssociation == null
      ? null
      : { ...checkpoint.anchorAssociation },
  };
}
