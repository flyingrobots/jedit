export const REPORT_KIND_RANGE = 'range';
export const REPORT_TITLE = 'Why range';
export const RESULT_PRODUCED = 'produced';
export const RESULT_UNAVAILABLE = 'unavailable';
export const CAUSAL_HISTORY_AVAILABLE = 'available';
export const CAUSAL_HISTORY_UNAVAILABLE = 'unavailable';
export const BTR_MISSING = 'missing';
export const BTR_AVAILABLE = 'available';
export const COORDINATE_KIND_RANGE_AT_HEAD = 'range-at-head';

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
  readonly currentHeadId: string;
  readonly queriedRange: JeditWhyByteRange;
  readonly reverseWalk: JeditWhyRangeReverseWalk;
  readonly result: JeditWhyRangeResult;
  readonly evidencePosture: JeditWhyRangeEvidencePosture;
}

export interface JeditWhyRangeReverseWalk {
  readonly coordinateKind: typeof COORDINATE_KIND_RANGE_AT_HEAD;
  readonly inspectedDiffIds: readonly string[];
}

export interface JeditWhyRangeEvidencePosture {
  readonly causalHistory: typeof CAUSAL_HISTORY_AVAILABLE | typeof CAUSAL_HISTORY_UNAVAILABLE;
  readonly btr: typeof BTR_AVAILABLE | typeof BTR_MISSING;
}

export type JeditWhyRangeResult = JeditWhyRangeProduced | JeditWhyRangeUnavailable;

export interface JeditWhyRangeProduced {
  readonly kind: typeof RESULT_PRODUCED;
  readonly ropeRewriteId: string;
  readonly ropeDiffId: string;
  readonly tickId: string;
  readonly receiptId: string;
  readonly baseHeadId: string;
  readonly nextHeadId: string;
  readonly startByte: number;
  readonly endByte: number;
  readonly insertedByteLength: number;
  readonly deletedByteLength: number;
}

export interface JeditWhyRangeUnavailable {
  readonly kind: typeof RESULT_UNAVAILABLE;
  readonly code: string;
  readonly reason: string;
}
