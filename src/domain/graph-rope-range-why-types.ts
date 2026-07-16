import type { RopeCheckpointReason, TextByteRange } from './graph-rope-contract.js';
import type { GraphRopeRuntimeFactReader } from './graph-rope-runtime-tree.js';

export const GRAPH_ROPE_RANGE_WHY_OBSERVER_VERSION = 'jedit-graph-rope-range-why-v1';
export const GRAPH_ROPE_RANGE_WHY_COVERAGE_COMPLETE = 'complete';
export const GRAPH_ROPE_RANGE_WHY_ORIGIN_IMPORTED = 'imported';
export const GRAPH_ROPE_RANGE_WHY_ORIGIN_REWRITE = 'rewrite';

export interface GraphRopeRangeWhyInput {
  readonly worldlineId: string;
  readonly basisHeadId: string;
  readonly queriedRange: TextByteRange;
  readonly maxFacts: number;
  readonly maxDepth: number;
  readonly maxHistoricalTextBytes: number;
}

export interface GraphRopeRangeWhyReading {
  readonly worldlineId: string;
  readonly basisHeadId: string;
  readonly queriedRange: TextByteRange;
  readonly coverage: GraphRopeRangeWhyCompleteCoverage;
  readonly fragments: readonly GraphRopeRangeWhyFragment[];
  readonly relatedCheckpoints: readonly GraphRopeRangeWhyCheckpointEvidence[];
  readonly inspectedFactCount: number;
  readonly observerVersion: typeof GRAPH_ROPE_RANGE_WHY_OBSERVER_VERSION;
}

export interface GraphRopeRangeWhyCompleteCoverage {
  readonly kind: typeof GRAPH_ROPE_RANGE_WHY_COVERAGE_COMPLETE;
  readonly coveredRange: TextByteRange;
}

export interface GraphRopeRangeWhyFragment {
  readonly coveredRange: TextByteRange;
  readonly headId: string;
  readonly leafId: string;
  readonly blobId: string;
  readonly origin: GraphRopeRangeWhyOrigin;
}

export type GraphRopeRangeWhyOrigin =
  | GraphRopeRangeWhyImportedOrigin
  | GraphRopeRangeWhyRewriteOrigin;

export interface GraphRopeRangeWhyImportedOrigin {
  readonly kind: typeof GRAPH_ROPE_RANGE_WHY_ORIGIN_IMPORTED;
  readonly worldlineId: string;
  readonly initialHeadId: string;
  readonly createdAtTickId: string;
}

export interface GraphRopeRangeWhyRewriteOrigin {
  readonly kind: typeof GRAPH_ROPE_RANGE_WHY_ORIGIN_REWRITE;
  readonly rewriteId: string;
  readonly diffId: string;
  readonly textTickReceiptId: string;
  readonly basisHeadId: string;
  readonly nextHeadId: string;
}

export interface GraphRopeRangeWhyCheckpointEvidence {
  readonly checkpointId: string;
  readonly headId: string;
  readonly reason: RopeCheckpointReason;
  readonly anchorAssociation?: GraphRopeRangeWhyAnchorAssociation;
}

export interface GraphRopeRangeWhyAnchorAssociation {
  readonly associationId: string;
  readonly causalAnchorId: string;
  readonly causalAnchorFactId: string;
  readonly causalAnchorReceiptId: string;
}

export interface GraphRopeRangeWhyFactCatalog extends GraphRopeRuntimeFactReader {
  checkpointIdsForHead(headId: string): readonly string[];
  anchorAssociationIdsForCheckpoint(checkpointId: string): readonly string[];
}
