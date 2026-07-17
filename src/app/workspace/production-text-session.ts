import type { RuntimeIssue } from '@flyingrobots/bijou-tui';
import type { ByteOffset, TextByteRange } from '../../domain/graph-rope-types.js';
import type {
  ApplyIntentResult,
  CheckpointDeclarationKind,
  Observed,
  CreateTextBufferCheckpointResult,
  TextWindowBasis,
  TextWindowReading,
} from '../../ports/text-authority-evidence.js';
import type { JeditWhyRangeReport } from '../../ports/jedit-why-range.js';
import { RuntimeIssueLevels, RuntimeIssueSources } from './runtime-issue.js';
import type {
  ProductionTextExportRequest,
  ProductionTextWindowRequest,
} from './production-text-basis-request.js';
import {
  PRODUCTION_TEXT_CAUSAL_LINE_DIFF_OBSERVED,
  type ProductionTextCausalLineDiffOutcome,
  type ProductionTextCausalLineDiffRequest,
} from './production-text-causal-line-diff.js';
export type {
  ProductionTextExportRequest,
  ProductionTextViewportAperture,
  ProductionTextWindowRequest,
} from './production-text-basis-request.js';
export type {
  ProductionTextCausalLineDiffOutcome,
  ProductionTextCausalLineDiffRequest,
} from './production-text-causal-line-diff.js';

const OPEN_OBSTRUCTION_CODE = 'text-buffer-open-obstructed';
const EDIT_OBSTRUCTION_CODE = 'text-buffer-edit-obstructed';
const QUERY_OBSTRUCTION_CODE = 'text-buffer-query-obstructed';
const CHECKPOINT_OBSTRUCTION_CODE = 'text-buffer-checkpoint-obstructed';
const MISSING_BUFFER_OBSTRUCTION_CODE = 'text-buffer-missing-obstructed';
const TEXT_EXPORT_OBSTRUCTION_CODE = 'text-buffer-export-obstructed';
const WHY_RANGE_OBSTRUCTION_CODE = 'text-buffer-why-range-obstructed';
const ECHO_OPERATION_CORRIDOR_UNAVAILABLE = 'Echo is connected, but the generated Jim operation corridor is unavailable.';
const OUTCOME_OPENED = 'opened';
const OUTCOME_APPLIED = 'applied';
const OUTCOME_CHECKPOINTED = 'checkpointed';
const OUTCOME_OBSERVED = 'observed';
const OUTCOME_EXPORTED = 'exported';
const OUTCOME_RANGE_EXPLAINED = 'range-explained';
const OUTCOME_OBSTRUCTED = 'obstructed';

export const ProductionTextSessionOutcomeKinds = Object.freeze({
  Opened: OUTCOME_OPENED,
  Applied: OUTCOME_APPLIED,
  Checkpointed: OUTCOME_CHECKPOINTED,
  Observed: OUTCOME_OBSERVED,
  CausalLineDiffObserved: PRODUCTION_TEXT_CAUSAL_LINE_DIFF_OBSERVED,
  Exported: OUTCOME_EXPORTED,
  RangeExplained: OUTCOME_RANGE_EXPLAINED,
  Obstructed: OUTCOME_OBSTRUCTED,
} as const);

export const ProductionTextObstructionCodes = Object.freeze({
  Open: OPEN_OBSTRUCTION_CODE,
  Edit: EDIT_OBSTRUCTION_CODE,
  Query: QUERY_OBSTRUCTION_CODE,
  Checkpoint: CHECKPOINT_OBSTRUCTION_CODE,
  Export: TEXT_EXPORT_OBSTRUCTION_CODE,
  WhyRange: WHY_RANGE_OBSTRUCTION_CODE,
  MissingBuffer: MISSING_BUFFER_OBSTRUCTION_CODE,
} as const);

export type ProductionTextSessionOutcomeKind =
  typeof ProductionTextSessionOutcomeKinds[keyof typeof ProductionTextSessionOutcomeKinds];

export type ProductionTextObstructionCode =
  typeof ProductionTextObstructionCodes[keyof typeof ProductionTextObstructionCodes];

export interface ProductionTextOpenRequest {
  readonly bufferKey: string;
  readonly initialText: string;
  readonly projectionPath?: string | null;
  readonly atMs: number;
}

export interface ProductionTextReplaceRequest {
  readonly bufferId: string;
  readonly startByte: ByteOffset;
  readonly endByte: ByteOffset;
  readonly insertText: string;
  readonly atMs: number;
}

export interface ProductionTextInsertRequest {
  readonly bufferId: string;
  readonly startByte: ByteOffset;
  readonly insertText: string;
  readonly atMs: number;
}

export interface ProductionTextDeleteRequest {
  readonly bufferId: string;
  readonly startByte: ByteOffset;
  readonly endByte: ByteOffset;
  readonly atMs: number;
}

export interface ProductionTextRange {
  readonly startByte: ByteOffset;
  readonly endByte: ByteOffset;
  readonly insertText: string;
}

export interface ProductionTextMultiRangeRequest {
  readonly bufferId: string;
  readonly ranges: readonly ProductionTextRange[];
  readonly atMs: number;
}

export interface ProductionTextCheckpointRequest {
  readonly bufferId: string;
  readonly basisHeadId: string;
  readonly checkpointKind: CheckpointDeclarationKind;
  readonly atMs: number;
}

export interface ProductionTextWhyRangeRequest {
  readonly bufferId: string;
  readonly range: TextByteRange;
  readonly atMs: number;
}

export interface ProductionTextObstruction {
  readonly code: ProductionTextObstructionCode;
  readonly issue: RuntimeIssue;
}

export interface ProductionTextOpenApplied {
  readonly kind: typeof OUTCOME_OPENED;
  readonly bufferId: string;
  readonly textBasis: TextWindowBasis;
}

export interface ProductionTextEditApplied {
  readonly kind: typeof OUTCOME_APPLIED;
  readonly result: ApplyIntentResult;
}

export interface ProductionTextCheckpointed {
  readonly kind: typeof OUTCOME_CHECKPOINTED;
  readonly result: CreateTextBufferCheckpointResult;
}

export interface ProductionTextWindowObserved {
  readonly kind: typeof OUTCOME_OBSERVED;
  readonly observed: Observed<TextWindowReading>;
}

export interface ProductionTextExported {
  readonly kind: typeof OUTCOME_EXPORTED;
  readonly text: string;
  readonly readingId: string;
  readonly basisHeadId: string;
}

export interface ProductionTextRangeExplained {
  readonly kind: typeof OUTCOME_RANGE_EXPLAINED;
  readonly report: JeditWhyRangeReport;
}

export interface ProductionTextObstructed {
  readonly kind: typeof OUTCOME_OBSTRUCTED;
  readonly obstruction: ProductionTextObstruction;
}

export type ProductionTextOpenOutcome =
  | ProductionTextOpenApplied
  | ProductionTextObstructed;

export type ProductionTextEditOutcome =
  | ProductionTextEditApplied
  | ProductionTextObstructed;

export type ProductionTextWindowOutcome =
  | ProductionTextWindowObserved
  | ProductionTextObstructed;

export type ProductionTextCheckpointOutcome =
  | ProductionTextCheckpointed
  | ProductionTextObstructed;

export type ProductionTextExportOutcome =
  | ProductionTextExported
  | ProductionTextObstructed;

export type ProductionTextWhyRangeOutcome =
  | ProductionTextRangeExplained
  | ProductionTextObstructed;

export interface ProductionTextSession {
  openBuffer(request: ProductionTextOpenRequest): Promise<ProductionTextOpenOutcome>;
  insertText(request: ProductionTextInsertRequest): Promise<ProductionTextEditOutcome>;
  replaceRange(request: ProductionTextReplaceRequest): Promise<ProductionTextEditOutcome>;
  deleteRange(request: ProductionTextDeleteRequest): Promise<ProductionTextEditOutcome>;
  multiRangeEdit(request: ProductionTextMultiRangeRequest): Promise<ProductionTextEditOutcome>;
  checkpointBuffer(request: ProductionTextCheckpointRequest): Promise<ProductionTextCheckpointOutcome>;
  observeWindow(request: ProductionTextWindowRequest): Promise<ProductionTextWindowOutcome>;
  observeCausalLineDiff(
    request: ProductionTextCausalLineDiffRequest,
  ): Promise<ProductionTextCausalLineDiffOutcome>;
  exportSnapshot(request: ProductionTextExportRequest): Promise<ProductionTextExportOutcome>;
  explainRange(request: ProductionTextWhyRangeRequest): Promise<ProductionTextWhyRangeOutcome>;
}

export function createEchoObstructedProductionTextSession(
  message: string = ECHO_OPERATION_CORRIDOR_UNAVAILABLE,
): ProductionTextSession {
  return Object.freeze({
    openBuffer: async (request: ProductionTextOpenRequest) => createProductionTextObstruction(OPEN_OBSTRUCTION_CODE, request.atMs, message),
    insertText: async (request: ProductionTextInsertRequest) => createProductionTextObstruction(EDIT_OBSTRUCTION_CODE, request.atMs, message),
    replaceRange: async (request: ProductionTextReplaceRequest) => createProductionTextObstruction(EDIT_OBSTRUCTION_CODE, request.atMs, message),
    deleteRange: async (request: ProductionTextDeleteRequest) => createProductionTextObstruction(EDIT_OBSTRUCTION_CODE, request.atMs, message),
    multiRangeEdit: async (request: ProductionTextMultiRangeRequest) => createProductionTextObstruction(EDIT_OBSTRUCTION_CODE, request.atMs, message),
    checkpointBuffer: async (request: ProductionTextCheckpointRequest) => createProductionTextObstruction(CHECKPOINT_OBSTRUCTION_CODE, request.atMs, message),
    observeWindow: async (request: ProductionTextWindowRequest) => createProductionTextObstruction(QUERY_OBSTRUCTION_CODE, request.atMs, message),
    observeCausalLineDiff: async (request: ProductionTextCausalLineDiffRequest) => createProductionTextObstruction(
      QUERY_OBSTRUCTION_CODE,
      request.atMs,
      message,
    ),
    exportSnapshot: async (request: ProductionTextExportRequest) => createProductionTextObstruction(TEXT_EXPORT_OBSTRUCTION_CODE, request.atMs, message),
    explainRange: async (request: ProductionTextWhyRangeRequest) => createProductionTextObstruction(WHY_RANGE_OBSTRUCTION_CODE, request.atMs, message),
  });
}

export function createProductionTextObstruction(
  code: ProductionTextObstructionCode,
  atMs: number,
  message: string,
): ProductionTextObstructed {
  return {
    kind: OUTCOME_OBSTRUCTED,
    obstruction: {
      code,
      issue: {
        level: RuntimeIssueLevels.Error,
        source: RuntimeIssueSources.Command,
        message,
        atMs,
      },
    },
  };
}
