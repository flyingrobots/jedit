import type {
  CheckpointKind,
  QueryTextWindowRequest,
} from '../generated/jedit/rope.wesley.generated.js';
import type { TextByteRange } from '../domain/graph-rope-types.js';
import type { JeditRetainedEvidenceInventory } from './jedit-retained-evidence.js';
import type { JeditWhyByteRange, JeditWhyRangeReport } from './jedit-why-range.js';
import type { HotTextWindowProjection } from './hot-text-runtime.js';
import type { JeditTextWindowMaterializationProvenance } from './jedit-text-window-materialization.js';

export const READ_BASIS_HANDLE_KIND = 'read-basis-handle';
export const REPLACE_RANGE_INTENT_KIND = 'replaceRange';

export type TextBufferId = string;
export type BufferKey = string;
export type ReadingId = string;
export type BufferVersion = number;
export type SessionId = string;

export const TEXT_BUFFER_CHECKPOINT_KIND_MANUAL_SAVE: CheckpointKind = 'MANUAL_SAVE';

export interface ReadBasisHandle {
  readonly kind: typeof READ_BASIS_HANDLE_KIND;
  readonly id: string;
}

export interface TextBuffer {
  readonly bufferId: TextBufferId;
  readonly bufferKey: BufferKey;
  readonly projectionPath: string | null;
  readonly createdAt: string;
}

export interface ReplaceRangeIntent {
  readonly kind: typeof REPLACE_RANGE_INTENT_KIND;
  readonly startByte: number;
  readonly endByte: number;
  readonly insertText: string;
}

export interface TextWindowLine {
  readonly lineNumber: number;
  readonly startByte: number;
  readonly endByte: number;
  readonly text: string;
}

export interface TextWindowReading {
  readonly readingId: ReadingId;
  readonly textBasis: TextWindowBasis;
  readonly projection: HotTextWindowProjection;
  readonly materialization: JeditTextWindowMaterializationProvenance;
  readonly lines: readonly TextWindowLine[];
  readonly byteLength: number;
  readonly lineCount: number;
  readonly startLine: number;
  readonly totalLineCount: number;
  readonly hasMoreBefore: boolean;
  readonly hasMoreAfter: boolean;
  readonly cursorLine: number;
  readonly viewportLineCount: number;
  readonly truncated: boolean;
}

export interface ApplyIntentResult {
  readonly buffer: TextBuffer;
  readonly textBasis: TextWindowBasis;
  readonly bufferVersion: BufferVersion;
  readonly receiptId: string;
  readonly causalTransition?: TextBufferCausalTransition;
}

export interface TextBufferCausalTransition {
  readonly admittedTickId: string;
  readonly nextHeadId: string;
}

export interface CreateTextBufferCheckpointRequest {
  readonly kind: CheckpointKind;
  readonly basisHeadId?: string;
  readonly label?: string | null;
}

export interface CreateTextBufferCheckpointResult {
  readonly buffer: TextBuffer;
  readonly textBasis: TextWindowBasis;
  readonly bufferVersion: BufferVersion;
  readonly checkpointId: string;
  readonly checkpointKind: CheckpointKind;
}

export interface CausalLineDiffRequest {
  readonly basisHeadId: string;
  readonly nextHeadId: string;
  readonly maxByteCount: number;
  readonly maxLineCount: number;
  readonly maxRewriteCount: number;
  readonly maxMarkerCount: number;
}

export interface CausalLineMarkerReading {
  readonly lineNumber: number;
  readonly kind: 'INSERTED' | 'MODIFIED';
  readonly rewriteIds: readonly string[];
  readonly diffIds: readonly string[];
}

export interface CausalLineDeletionMarkerReading {
  readonly boundaryLineNumber: number;
  readonly deletedLineCount: number;
  readonly rewriteIds: readonly string[];
  readonly diffIds: readonly string[];
}

export interface CausalLineDiffReading {
  readonly worldlineId: string;
  readonly basisHeadId: string;
  readonly nextHeadId: string;
  readonly insertedLineCount: number;
  readonly deletedLineCount: number;
  readonly rewriteIds: readonly string[];
  readonly diffIds: readonly string[];
  readonly markers: readonly CausalLineMarkerReading[];
  readonly deletions: readonly CausalLineDeletionMarkerReading[];
  readonly observerVersion: string;
}

export interface Observed<T> {
  readonly value: T;
  readonly evidence: {
    readonly readingId: string;
    readonly receiptId?: string;
    readonly retainedEvidence?: JeditRetainedEvidenceInventory;
  };
}

export interface TextBufferOptic {
  readonly buffer: TextBuffer;
  readonly openedTextBasis: TextWindowBasis;

  applyIntent(intent: ReplaceRangeIntent): Promise<ApplyIntentResult>;

  createCheckpoint(
    request: CreateTextBufferCheckpointRequest,
  ): Promise<CreateTextBufferCheckpointResult>;

  textWindow(request: TextWindowRequest): Promise<Observed<TextWindowReading>>;

  causalLineDiff(request: CausalLineDiffRequest): Promise<CausalLineDiffReading>;

  explainRange(range: JeditWhyByteRange): Promise<JeditWhyRangeReport>;
}

export interface CreateTextBufferRequest {
  readonly bufferKey: BufferKey;
  readonly initialText: string;
  readonly projectionPath?: string | null;
}

export interface TextBufferSessionPort {
  readonly sessionId: SessionId;

  createBuffer(input: CreateTextBufferRequest): Promise<TextBufferOptic>;

  getBufferOptic(bufferId: TextBufferId): Promise<TextBufferOptic | null>;

  listBuffers(): Promise<readonly TextBuffer[]>;
}

export interface TextWindowBasis {
  readonly basisHeadId: string;
  readonly byteRange: TextByteRange;
}

export interface TextWindowRequest extends TextWindowBasis {
  readonly aperture: TextWindowRangeInput;
}

export type TextWindowRangeInput = Omit<
  QueryTextWindowRequest['input'],
  'worldlineId' | 'basisHeadId' | 'startByte' | 'endByte'
>;
