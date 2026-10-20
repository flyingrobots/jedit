export const EchoTextHostOutcomeKinds = Object.freeze({
  Opened: 'opened',
  Applied: 'applied',
  CheckpointDeclared: 'checkpoint-declared',
  Observed: 'observed',
  Obstructed: 'obstructed',
} as const);

export const EchoTextHostRequestKinds = Object.freeze({
  Open: 'open',
  Replace: 'replace',
  DeclareCheckpoint: 'declare-checkpoint',
  Observe: 'observe',
} as const);

export const EchoTextHostOperationNames = Object.freeze({
  CreateBufferWorldline: 'createBufferWorldline',
  ReplaceRangeAsTick: 'replaceRangeAsTick',
  DeclareCheckpoint: 'declareCheckpoint',
  TextWindow: 'textWindow',
} as const);

export const EchoTextHostCheckpointReasons = Object.freeze({
  ManualSave: 'manual-save',
  Autosave: 'autosave',
  RetentionBoundary: 'retention-boundary',
  Export: 'export',
  Import: 'import',
} as const);

export type EchoTextHostCheckpointReason =
  typeof EchoTextHostCheckpointReasons[keyof typeof EchoTextHostCheckpointReasons];

export const EchoTextHostBasisKinds = Object.freeze({
  File: 'file',
  Missing: 'missing',
} as const);

/** What a host coordinate holds: a file's raw-byte SHA-256 and length, or nothing. */
export type EchoTextHostBasis =
  | {
      readonly kind: typeof EchoTextHostBasisKinds.File;
      readonly sha256: string;
      readonly byteLength: number;
    }
  | { readonly kind: typeof EchoTextHostBasisKinds.Missing };

/** The import a buffer was anchored to when it was created. */
export interface EchoTextHostImportAnchor {
  readonly headId: string;
  readonly hostBasis: EchoTextHostBasis;
}

/** Why the host refused to reuse an existing buffer for an open. */
export const EchoTextHostReopenObstructionCodes = Object.freeze({
  ImportAnchorMissing: 'import-anchor-missing',
  FileChangedSinceImport: 'file-changed-since-import',
  FileAndBufferChangedSinceImport: 'file-and-buffer-changed-since-import',
} as const);

export interface EchoTextHostOpenRequest {
  readonly bufferKey: string;
  readonly initialText: string;
  readonly projectionPath: string | null;
  readonly hostBasis: EchoTextHostBasis;
}

export interface EchoTextHostReplaceRequest {
  readonly bufferId: string;
  readonly startByte: number;
  readonly endByte: number;
  readonly insertText: string;
}

export interface EchoTextHostCheckpointRequest {
  readonly bufferId: string;
  readonly basisHeadId: string;
  readonly reason: EchoTextHostCheckpointReason;
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
  readonly importAnchor: EchoTextHostImportAnchor;
  readonly receiptId?: string;
  readonly admittedTickId?: string;
}

export interface EchoTextHostApplied extends EchoTextHostBufferEvidence {
  readonly kind: typeof EchoTextHostOutcomeKinds.Applied;
  readonly receiptId: string;
  readonly admittedTickId: string;
}

export interface EchoTextHostCheckpointDeclared extends EchoTextHostBufferEvidence {
  readonly kind: typeof EchoTextHostOutcomeKinds.CheckpointDeclared;
  readonly checkpointId: string;
  readonly basisHeadId: string;
  readonly basisByteLength: number;
  readonly reason: EchoTextHostCheckpointReason;
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
export type EchoTextHostCheckpointOutcome = EchoTextHostCheckpointDeclared | EchoTextHostObstructed;
export type EchoTextHostObserveOutcome = EchoTextHostObserved | EchoTextHostObstructed;

export interface EchoTextContractHostPort {
  openBuffer(request: EchoTextHostOpenRequest): Promise<EchoTextHostOpenOutcome>;
  replaceRange(request: EchoTextHostReplaceRequest): Promise<EchoTextHostReplaceOutcome>;
  declareCheckpoint(request: EchoTextHostCheckpointRequest): Promise<EchoTextHostCheckpointOutcome>;
  observeWindow(request: EchoTextHostObserveRequest): Promise<EchoTextHostObserveOutcome>;
  close?(): Promise<void>;
}
