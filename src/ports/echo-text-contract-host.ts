export const EchoTextHostOutcomeKinds = Object.freeze({
  Opened: 'opened',
  Applied: 'applied',
  Observed: 'observed',
  Obstructed: 'obstructed',
} as const);

export interface EchoTextHostOpenRequest {
  readonly bufferKey: string;
  readonly initialText: string;
  readonly projectionPath: string | null;
}

export interface EchoTextHostReplaceRequest {
  readonly bufferId: string;
  readonly startByte: number;
  readonly endByte: number;
  readonly insertText: string;
}

export interface EchoTextHostObserveRequest {
  readonly bufferId: string;
  readonly basisHeadId: string;
  readonly startByte: number;
  readonly endByte: number;
  readonly maxBytes: number;
}

export interface EchoTextHostBufferEvidence {
  readonly bufferId: string;
  readonly bufferKey: string;
  readonly projectionPath: string | null;
  readonly headId: string;
  readonly rootNodeId: string | null;
  readonly byteLength: number;
  readonly lineCount: number;
  readonly bufferVersion: number;
}

export interface EchoTextHostOpened extends EchoTextHostBufferEvidence {
  readonly kind: typeof EchoTextHostOutcomeKinds.Opened;
  readonly receiptId?: string;
  readonly admittedTickId?: string;
}

export interface EchoTextHostApplied extends EchoTextHostBufferEvidence {
  readonly kind: typeof EchoTextHostOutcomeKinds.Applied;
  readonly receiptId: string;
  readonly admittedTickId: string;
}

export interface EchoTextHostWindowLine {
  readonly lineNumber: number;
  readonly startByte: number;
  readonly endByte: number;
  readonly text: string;
}

export interface EchoTextHostWindowSupport {
  readonly leafId: string;
  readonly blobId: string;
  readonly contentHash: string;
  readonly startByte: number;
  readonly endByte: number;
}

export interface EchoTextHostObserved {
  readonly kind: typeof EchoTextHostOutcomeKinds.Observed;
  readonly worldlineId: string;
  readonly readingId: string;
  readonly observerPlanId: string;
  readonly packageArtifactHash: string;
  readonly bufferId: string;
  readonly basisHeadId: string;
  readonly rootNodeId: string | null;
  readonly byteLength: number;
  readonly lineCount: number;
  readonly startByte: number;
  readonly endByte: number;
  readonly text: string;
  readonly lines: readonly EchoTextHostWindowLine[];
  readonly support: readonly EchoTextHostWindowSupport[];
  readonly resolvedWorldlineTick: number;
  readonly commitHash: string;
}

export interface EchoTextHostObstructed {
  readonly kind: typeof EchoTextHostOutcomeKinds.Obstructed;
  readonly code: string;
  readonly message: string;
}

export type EchoTextHostOpenOutcome = EchoTextHostOpened | EchoTextHostObstructed;
export type EchoTextHostReplaceOutcome = EchoTextHostApplied | EchoTextHostObstructed;
export type EchoTextHostObserveOutcome = EchoTextHostObserved | EchoTextHostObstructed;

export interface EchoTextContractHostPort {
  openBuffer(request: EchoTextHostOpenRequest): Promise<EchoTextHostOpenOutcome>;
  replaceRange(request: EchoTextHostReplaceRequest): Promise<EchoTextHostReplaceOutcome>;
  observeWindow(request: EchoTextHostObserveRequest): Promise<EchoTextHostObserveOutcome>;
  close?(): Promise<void>;
}
