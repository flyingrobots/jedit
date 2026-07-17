export interface HotTextHeadBasis {
  readonly worldlineId: string;
  readonly headId: string;
  readonly rootNodeId: string;
  readonly byteLength: number;
  readonly lineCount: number;
}

export interface HotTextWindowByteRange {
  readonly startByte: number;
  readonly endByte: number;
}

export interface HotTextWindowSupport {
  readonly leafId: string;
  readonly blobId: string;
  readonly contentHash: string;
  readonly byteRange: HotTextWindowByteRange;
}

export interface HotTextWindowProjection {
  readonly basisHeadId: string;
  readonly basis: HotTextHeadBasis;
  readonly byteRange: HotTextWindowByteRange;
  readonly text: string;
  readonly support: readonly HotTextWindowSupport[];
}

export interface HotTextCausalLineDiffRequest {
  readonly worldlineId: string;
  readonly basisHeadId: string;
  readonly nextHeadId: string;
  readonly maxByteCount: number;
  readonly maxLineCount: number;
  readonly maxRewriteCount: number;
  readonly maxMarkerCount: number;
}

export interface HotTextCausalLineMarker {
  readonly lineNumber: number;
  readonly kind: 'INSERTED' | 'MODIFIED';
  readonly tickReceiptIds: readonly string[];
  readonly rewriteIds: readonly string[];
  readonly diffIds: readonly string[];
}

export interface HotTextCausalLineDeletionMarker {
  readonly boundaryLineNumber: number;
  readonly deletedLineCount: number;
  readonly tickReceiptIds: readonly string[];
  readonly rewriteIds: readonly string[];
  readonly diffIds: readonly string[];
}

export interface HotTextCausalLineDiffReading {
  readonly worldlineId: string;
  readonly basisHeadId: string;
  readonly nextHeadId: string;
  readonly insertedLineCount: number;
  readonly deletedLineCount: number;
  readonly tickReceiptIds: readonly string[];
  readonly rewriteIds: readonly string[];
  readonly diffIds: readonly string[];
  readonly markers: readonly HotTextCausalLineMarker[];
  readonly deletions: readonly HotTextCausalLineDeletionMarker[];
  readonly observerVersion: string;
}
