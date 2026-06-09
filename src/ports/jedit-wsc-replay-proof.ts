import type {
  JeditWscHistoryListed,
  JeditWscHistoryRecord,
} from './jedit-wsc-history-listing.js';

export const JEDIT_WSC_REPLAY_MATCH = 'JEDIT_WSC_REPLAY_MATCH';
export const JEDIT_WSC_REPLAY_MISMATCH = 'JEDIT_WSC_REPLAY_MISMATCH';
export const JEDIT_WSC_REPLAY_CLOSEOUT_READY = 'JEDIT_WSC_REPLAY_CLOSEOUT_READY';
export const JEDIT_WSC_REPLAY_CLOSEOUT_OBSTRUCTED = 'JEDIT_WSC_REPLAY_CLOSEOUT_OBSTRUCTED';
export const JEDIT_WSC_REPLAY_MISSING_NON_APPLIED_OUTCOME = 'missing_non_applied_outcome';
export const JEDIT_WSC_REPLAY_MISSING_STAGE_COVERAGE = 'missing_stage_coverage';

export interface JeditWscReplayIdentityRecord {
  readonly filePath?: string;
  readonly bufferId?: string;
  readonly commandKind?: string;
  readonly outcomeStatus: string;
  readonly receiptId?: string;
  readonly readingId?: string;
  readonly readingLineCount?: number;
  readonly readingTextDigest?: string;
  readonly checkpointId?: string;
  readonly submissionId?: string;
  readonly admissionId?: string;
  readonly ticketId?: string;
  readonly executionId?: string;
  readonly rejectionReason?: string;
}

export interface JeditWscReplayMatch {
  readonly status: typeof JEDIT_WSC_REPLAY_MATCH;
  readonly first: readonly JeditWscReplayIdentityRecord[];
  readonly second: readonly JeditWscReplayIdentityRecord[];
  readonly wallClockCadenceSemantic: false;
}

export interface JeditWscReplayMismatch {
  readonly status: typeof JEDIT_WSC_REPLAY_MISMATCH;
  readonly first: readonly JeditWscReplayIdentityRecord[];
  readonly second: readonly JeditWscReplayIdentityRecord[];
  readonly mismatchCoordinate: string;
  readonly wallClockCadenceSemantic: false;
}

export type JeditWscReplayProof =
  | JeditWscReplayMatch
  | JeditWscReplayMismatch;

export interface JeditWscReplayEvidenceCoordinate {
  readonly basisId: string;
  readonly outcomeStatus: string;
  readonly receiptId?: string;
  readonly readingId?: string;
  readonly exportEvidenceId?: string;
  readonly rejectionReason?: string;
}

export interface JeditWscReplayCloseoutReady {
  readonly status: typeof JEDIT_WSC_REPLAY_CLOSEOUT_READY;
  readonly evidenceCoordinates: readonly JeditWscReplayEvidenceCoordinate[];
  readonly coveredStages: readonly string[];
  readonly nonAppliedOutcomeCount: number;
  readonly deterministicOnCleanCheckout: true;
}

export interface JeditWscReplayCloseoutObstructed {
  readonly status: typeof JEDIT_WSC_REPLAY_CLOSEOUT_OBSTRUCTED;
  readonly obstruction: {
    readonly code: string;
    readonly message: string;
  };
  readonly evidenceCoordinates: readonly JeditWscReplayEvidenceCoordinate[];
}

export type JeditWscReplayCloseout =
  | JeditWscReplayCloseoutReady
  | JeditWscReplayCloseoutObstructed;

export interface JeditWscReplayIdentityField {
  readonly name: keyof JeditWscReplayIdentityRecord;
  read(record: JeditWscReplayIdentityRecord): string | number | undefined;
}

export interface JeditWscReplayCloseoutStage {
  readonly name: string;
  coveredBy(record: JeditWscHistoryRecord): boolean;
}

export interface JeditWscReplayCloseoutInput {
  readonly history: JeditWscHistoryListed;
}
