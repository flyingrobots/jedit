import type { RuntimeIssue } from '@flyingrobots/bijou-tui';
import type { JeditWscWorkspaceEnvelope } from '../../ports/jedit-wsc-workspace-store.js';
import type { TextPosition } from './workspace-text-position.js';
import type { WorkspaceTextReadingCache } from './workspace-text-reading-cache.js';

const RESULT_OPENED = 'opened';
const RESULT_APPLIED = 'applied';
const RESULT_CHECKPOINTED = 'checkpointed';
const RESULT_EXPORTED = 'exported';
const RESULT_READ = 'read';
const RESULT_OBSTRUCTED = 'obstructed';

export const WorkspaceTextResultKinds = Object.freeze({
  Opened: RESULT_OPENED,
  Applied: RESULT_APPLIED,
  Checkpointed: RESULT_CHECKPOINTED,
  Exported: RESULT_EXPORTED,
  Read: RESULT_READ,
  Obstructed: RESULT_OBSTRUCTED,
} as const);

export interface WorkspaceTextOpenedResult {
  readonly kind: typeof RESULT_OPENED;
  readonly filePath: string;
  readonly bufferId: string;
  readonly readOnly: boolean;
  readonly cache: WorkspaceTextReadingCache;
}

export interface WorkspaceTextAppliedResult {
  readonly kind: typeof RESULT_APPLIED;
  readonly filePath: string;
  readonly bufferId: string;
  readonly receiptId: string;
  readonly cache: WorkspaceTextReadingCache;
  readonly cursorAfter?: TextPosition;
  readonly wscSettlementEnvelope?: JeditWscWorkspaceEnvelope;
}

export interface WorkspaceTextCheckpointedResult {
  readonly kind: typeof RESULT_CHECKPOINTED;
  readonly filePath: string;
  readonly bufferId: string;
  readonly checkpointId: string;
}

export interface WorkspaceTextExportedResult {
  readonly kind: typeof RESULT_EXPORTED;
  readonly filePath: string;
  readonly bufferId: string;
  readonly readingId: string;
}

export interface WorkspaceTextReadResult {
  readonly kind: typeof RESULT_READ;
  readonly filePath: string;
  readonly bufferId: string;
  readonly cache: WorkspaceTextReadingCache;
}

export interface WorkspaceTextObstructedResult {
  readonly kind: typeof RESULT_OBSTRUCTED;
  readonly filePath: string;
  readonly issue: RuntimeIssue;
}

export type WorkspaceTextOpenResult =
  | WorkspaceTextOpenedResult
  | WorkspaceTextObstructedResult;

export type WorkspaceTextEditResult =
  | WorkspaceTextAppliedResult
  | WorkspaceTextObstructedResult;

export type WorkspaceTextCheckpointResult =
  | WorkspaceTextCheckpointedResult
  | WorkspaceTextObstructedResult;

export type WorkspaceTextExportResult =
  | WorkspaceTextExportedResult
  | WorkspaceTextObstructedResult;

export type WorkspaceTextReadCommandResult =
  | WorkspaceTextReadResult
  | WorkspaceTextObstructedResult;
