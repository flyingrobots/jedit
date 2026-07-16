export const REPORT_KIND_RANGE = 'range';
export const REPORT_TITLE = 'Why range';
export const RESULT_PRODUCED = 'produced';
export const RESULT_UNAVAILABLE = 'unavailable';

export const JeditWhyRangeResultKinds = Object.freeze({
  Produced: RESULT_PRODUCED,
  Unavailable: RESULT_UNAVAILABLE,
});

export interface JeditWhyByteRange {
  readonly startByte: number;
  readonly endByte: number;
}

export interface JeditWhyRangeReport {
  readonly kind: typeof REPORT_KIND_RANGE;
  readonly title: typeof REPORT_TITLE;
  readonly message: string;
  readonly witness: JeditWhyRangeWitness;
}

export interface JeditWhyRangeWitness {
  readonly worldlineId: string;
  readonly basisHeadId: string;
  readonly queriedRange: JeditWhyByteRange;
  readonly result: JeditWhyRangeResult;
}

export type JeditWhyRangeResult = JeditWhyRangeProduced | JeditWhyRangeUnavailable;

export interface JeditWhyRangeProduced {
  readonly kind: typeof RESULT_PRODUCED;
  readonly coverage: JeditWhyRangeCoverage;
  readonly fragments: readonly JeditWhyRangeFragment[];
  readonly relatedCheckpoints: readonly JeditWhyRangeCheckpointEvidence[];
  readonly inspectedFactCount: number;
  readonly observerVersion: string;
}

export interface JeditWhyRangeUnavailable {
  readonly kind: typeof RESULT_UNAVAILABLE;
  readonly code: string;
  readonly reason: string;
}

export interface JeditWhyRangeCoverage {
  readonly kind: 'COMPLETE' | 'PARTIAL';
  readonly coveredRange: JeditWhyByteRange;
  readonly continuation: string | null;
  readonly reason: string | null;
}

export interface JeditWhyRangeFragment {
  readonly coveredRange: JeditWhyByteRange;
  readonly headId: string;
  readonly leafId: string;
  readonly blobId: string;
  readonly origin: JeditWhyRangeOrigin;
}

export type JeditWhyRangeOrigin =
  | JeditWhyRangeImportedOrigin
  | JeditWhyRangeRewriteOrigin
  | JeditWhyRangeUnavailableOrigin;

export interface JeditWhyRangeImportedOrigin {
  readonly kind: 'IMPORTED';
  readonly worldlineId: string;
  readonly initialHeadId: string;
  readonly createdAtTickId: string;
}

export interface JeditWhyRangeRewriteOrigin {
  readonly kind: 'REWRITE';
  readonly rewriteId: string;
  readonly diffId: string;
  readonly textTickReceiptId: string;
  readonly basisHeadId: string;
  readonly nextHeadId: string;
}

export interface JeditWhyRangeUnavailableOrigin {
  readonly kind: 'UNAVAILABLE';
  readonly code: string;
}

export interface JeditWhyRangeCheckpointEvidence {
  readonly checkpointId: string;
  readonly headId: string;
  readonly reason: string;
  readonly anchorAssociation: JeditWhyRangeAnchorAssociation | null;
}

export interface JeditWhyRangeAnchorAssociation {
  readonly associationId: string;
  readonly causalAnchorId: string;
  readonly causalAnchorFactId: string;
  readonly causalAnchorReceiptId: string;
}
