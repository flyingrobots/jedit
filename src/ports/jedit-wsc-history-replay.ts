import type { JeditWscWorkspaceStorePort } from './jedit-wsc-workspace-store.js';

export const JEDIT_WSC_HISTORY_REPLAY_MATCH = 'JEDIT_WSC_HISTORY_REPLAY_MATCH';
export const JEDIT_WSC_HISTORY_REPLAY_MISMATCH = 'JEDIT_WSC_HISTORY_REPLAY_MISMATCH';
export const JEDIT_WSC_HISTORY_REPLAY_OBSTRUCTED = 'JEDIT_WSC_HISTORY_REPLAY_OBSTRUCTED';

export const JEDIT_WSC_REPLAY_WSC_STORE_OBSTRUCTED = 'wsc_store_obstructed';
export const JEDIT_WSC_REPLAY_MALFORMED_ENVELOPE = 'malformed_envelope';
export const JEDIT_WSC_REPLAY_UNSUPPORTED_SCHEMA = 'unsupported_schema';
export const JEDIT_WSC_REPLAY_ENTRY_COUNT_MISMATCH = 'entry_count';

export const JEDIT_WSC_REPLAY_SCHEDULER_LOCAL_ORDERED_SETTLEMENT =
  'local_wsc_edit_settlement_ordered';

export interface JeditWscHistoryReplayEntryIdentity {
  readonly filePath: string;
  readonly bufferId: string;
  readonly commandKind: string;
  readonly rangeStartByte: number;
  readonly rangeEndByte: number;
  readonly rangeInsertText: string;
  readonly receiptId: string;
  readonly readingId: string;
  readonly readingLines: readonly string[];
  readonly readingLineCount: number;
  readonly readingCursorLine: number;
  readonly readingViewportLineCount: number;
  readonly readingTruncated: boolean;
  readonly apertureCursorLine: number;
  readonly apertureViewportLineCount: number;
  readonly apertureBeforeLines: number;
  readonly apertureAfterLines: number;
  readonly apertureMaxBytes: number;
}

export interface JeditWscHistoryReplayIdentity {
  readonly schedulerPolicy: typeof JEDIT_WSC_REPLAY_SCHEDULER_LOCAL_ORDERED_SETTLEMENT;
  readonly entries: readonly JeditWscHistoryReplayEntryIdentity[];
}

export interface JeditWscHistoryReplayInput {
  readonly firstStore: JeditWscWorkspaceStorePort;
  readonly secondStore: JeditWscWorkspaceStorePort;
}

export interface JeditWscHistoryReplayMismatchDetail {
  readonly path: string;
  readonly firstValue: string;
  readonly secondValue: string;
}

export interface JeditWscHistoryReplayMatch {
  readonly status: typeof JEDIT_WSC_HISTORY_REPLAY_MATCH;
  readonly first: JeditWscHistoryReplayIdentity;
  readonly second: JeditWscHistoryReplayIdentity;
  readonly wallClockCadenceSemantic: false;
  readonly diagnosticProseSemantic: false;
}

export interface JeditWscHistoryReplayMismatch {
  readonly status: typeof JEDIT_WSC_HISTORY_REPLAY_MISMATCH;
  readonly first: JeditWscHistoryReplayIdentity;
  readonly second: JeditWscHistoryReplayIdentity;
  readonly mismatch: JeditWscHistoryReplayMismatchDetail;
  readonly wallClockCadenceSemantic: false;
  readonly diagnosticProseSemantic: false;
}

export interface JeditWscHistoryReplayObstruction {
  readonly code: string;
  readonly message: string;
  readonly envelopeId?: string;
}

export interface JeditWscHistoryReplayObstructed {
  readonly status: typeof JEDIT_WSC_HISTORY_REPLAY_OBSTRUCTED;
  readonly obstruction: JeditWscHistoryReplayObstruction;
  readonly wallClockCadenceSemantic: false;
  readonly diagnosticProseSemantic: false;
}

export type JeditWscHistoryReplayResult =
  | JeditWscHistoryReplayMatch
  | JeditWscHistoryReplayMismatch
  | JeditWscHistoryReplayObstructed;
