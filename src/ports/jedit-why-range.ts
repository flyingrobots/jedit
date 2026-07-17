export const REPORT_KIND_RANGE = 'range';
export const REPORT_TITLE = 'Why range';
export const RESULT_PRODUCED = 'produced';
export const RESULT_UNAVAILABLE = 'unavailable';

export const JeditWhyRangeResultKinds = Object.freeze({
  Produced: RESULT_PRODUCED,
  Unavailable: RESULT_UNAVAILABLE,
});

export const JeditWhyRangeOriginKinds = Object.freeze({
  Imported: 'IMPORTED',
  Rewrite: 'REWRITE',
  Unavailable: 'UNAVAILABLE',
} as const);

export const JeditWhyRangeCoverageKinds = Object.freeze({
  Complete: 'COMPLETE',
  Partial: 'PARTIAL',
} as const);

export const JeditWhyRangeProducerEvidenceKinds = Object.freeze({
  Unavailable: 'UNAVAILABLE',
} as const);

export const JEDIT_WHY_RANGE_PRODUCER_EVIDENCE_UNAVAILABLE_CODE =
  'jedit_why_range_producer_evidence_unavailable';

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
  readonly kind:
    | typeof JeditWhyRangeCoverageKinds.Complete
    | typeof JeditWhyRangeCoverageKinds.Partial;
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
  readonly kind: typeof JeditWhyRangeOriginKinds.Imported;
  readonly worldlineId: string;
  readonly initialHeadId: string;
  readonly createdAtTickId: string;
}

export interface JeditWhyRangeRewriteOrigin {
  readonly kind: typeof JeditWhyRangeOriginKinds.Rewrite;
  readonly rewriteId: string;
  readonly diffId: string;
  readonly textTickReceiptId: string;
  readonly basisHeadId: string;
  readonly nextHeadId: string;
  readonly producerEvidence: JeditWhyRangeProducerEvidence;
}

export type JeditWhyRangeProducerEvidence = JeditWhyRangeProducerEvidenceUnavailable;

export interface JeditWhyRangeProducerEvidenceUnavailable {
  readonly kind: typeof JeditWhyRangeProducerEvidenceKinds.Unavailable;
  readonly code: typeof JEDIT_WHY_RANGE_PRODUCER_EVIDENCE_UNAVAILABLE_CODE;
}

export interface JeditWhyRangeUnavailableOrigin {
  readonly kind: typeof JeditWhyRangeOriginKinds.Unavailable;
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
