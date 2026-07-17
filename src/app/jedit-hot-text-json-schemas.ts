import { z } from 'zod';
import type {
  BufferWorldline,
  CausalLineDeletionMarker,
  CausalLineDiffInput,
  CausalLineDiffReading,
  CausalLineMarker,
  Checkpoint,
  CheckpointKind,
  CreateBufferWorldlineInput,
  CreateBufferWorldlineResult,
  CreateCheckpointInput,
  CreateCheckpointResult,
  ReplaceRangeAsTickInput,
  ReplaceRangeAsTickResult,
  RewriteKind,
  RopeDiff,
  RopeHead,
  RopeRewrite,
  TextLineReading,
  TextWindowHeadBasis,
  TextWindowInput,
  TextWindowReading,
  WorldlineSnapshot,
  WorldlineSnapshotInput,
} from '../generated/jedit/rope.wesley.generated.js';

// Transitional guards for jedit-hot-text-runtime-json-v1. The modern Wesley
// artifact owns compile-time contract shapes and operation metadata; these
// schemas only validate the current app-owned JSON adapter boundary.
const NullableStringSchema = z.string().nullish().transform((value) => value ?? null);
const NullableIntegerSchema = z.number().int().nullish().transform((value) => value ?? null);

export const RewriteKindSchema: z.ZodType<RewriteKind> = z.enum([
  'CREATE_BUFFER_WORLDLINE',
  'REPLACE_RANGE_AS_TICK',
  'CREATE_CHECKPOINT',
  'REGISTER_ANCHOR',
]);

export const CheckpointKindSchema: z.ZodType<CheckpointKind> = z.enum([
  'INITIAL',
  'MANUAL_SAVE',
  'AUTO_SAVE',
]);

const CausalLineMarkerKindSchema = z.enum(['INSERTED', 'MODIFIED']);

export const BufferWorldlineSchema: z.ZodType<BufferWorldline> = z.object({
  worldlineId: z.string(),
  bufferKey: z.string(),
  canonicalHeadId: z.string(),
  createdAtRopeRewriteId: NullableStringSchema,
  projectionPath: NullableStringSchema,
});

const RopeHeadSchema: z.ZodType<RopeHead> = z.object({
  headId: z.string(),
  worldlineId: z.string(),
  rootNodeId: z.string(),
  byteLength: z.number().int(),
  lineCount: z.number().int(),
  utf16Length: z.number().int(),
  equivalenceDigest: z.string(),
});

const RopeRewriteSchema: z.ZodType<RopeRewrite> = z.object({
  ropeRewriteId: z.string(),
  worldlineId: z.string(),
  kind: RewriteKindSchema,
  sequenceNumber: z.number().int(),
  author: NullableStringSchema,
});

const RopeDiffSchema: z.ZodType<RopeDiff> = z.object({
  ropeDiffId: z.string(),
  ropeRewriteId: z.string(),
  baseHeadId: z.string(),
  nextHeadId: z.string(),
  rewriteKind: RewriteKindSchema,
  startByte: NullableIntegerSchema,
  endByte: NullableIntegerSchema,
  insertedByteLength: z.number().int(),
  deletedByteLength: z.number().int(),
  inverseFragmentDigest: NullableStringSchema,
  summary: NullableStringSchema,
});

const CheckpointSchema: z.ZodType<Checkpoint> = z.object({
  checkpointId: z.string(),
  worldlineId: z.string(),
  headId: z.string(),
  kind: CheckpointKindSchema,
  label: NullableStringSchema,
  createdByRopeRewriteId: NullableStringSchema,
});

export const WorldlineSnapshotSchema: z.ZodType<WorldlineSnapshot> = z.object({
  worldline: BufferWorldlineSchema,
  head: RopeHeadSchema,
  checkpoints: z.array(CheckpointSchema),
  text: z.string(),
});

const TextLineReadingSchema: z.ZodType<TextLineReading> = z.object({
  lineNumber: z.number().int(),
  text: z.string(),
  startByte: z.number().int(),
  endByte: z.number().int(),
});

const TextWindowHeadBasisSchema: z.ZodType<TextWindowHeadBasis> = z.object({
  headId: z.string(),
  worldlineId: z.string(),
  rootNodeId: z.string(),
  byteLength: z.number().int(),
  lineCount: z.number().int(),
});

export const TextWindowReadingSchema: z.ZodType<TextWindowReading> = z.object({
  worldline: BufferWorldlineSchema,
  head: TextWindowHeadBasisSchema,
  readingId: z.string(),
  startLine: z.number().int(),
  lineCount: z.number().int(),
  totalLineCount: z.number().int(),
  hasMoreBefore: z.boolean(),
  hasMoreAfter: z.boolean(),
  lines: z.array(TextLineReadingSchema),
});

const CausalLineMarkerSchema: z.ZodType<CausalLineMarker> = z.object({
  lineNumber: z.number().int(),
  kind: CausalLineMarkerKindSchema,
  tickReceiptIds: z.array(z.string()),
  rewriteIds: z.array(z.string()),
  diffIds: z.array(z.string()),
});

const CausalLineDeletionMarkerSchema: z.ZodType<CausalLineDeletionMarker> = z.object({
  boundaryLineNumber: z.number().int(),
  deletedLineCount: z.number().int(),
  tickReceiptIds: z.array(z.string()),
  rewriteIds: z.array(z.string()),
  diffIds: z.array(z.string()),
});

export const CausalLineDiffReadingSchema: z.ZodType<CausalLineDiffReading> = z.object({
  worldlineId: z.string(),
  basisHeadId: z.string(),
  nextHeadId: z.string(),
  insertedLineCount: z.number().int(),
  deletedLineCount: z.number().int(),
  tickReceiptIds: z.array(z.string()),
  rewriteIds: z.array(z.string()),
  diffIds: z.array(z.string()),
  markers: z.array(CausalLineMarkerSchema),
  deletions: z.array(CausalLineDeletionMarkerSchema),
  observerVersion: z.string(),
});

export const CreateBufferWorldlineInputSchema: z.ZodType<CreateBufferWorldlineInput> = z.object({
  bufferKey: z.string(),
  initialText: z.string().nullable().optional(),
  projectionPath: z.string().nullable().optional(),
  createInitialCheckpoint: z.boolean().nullable().optional(),
});

export const ReplaceRangeAsTickInputSchema: z.ZodType<ReplaceRangeAsTickInput> = z.object({
  worldlineId: z.string(),
  baseHeadId: z.string(),
  startByte: z.number().int(),
  endByte: z.number().int(),
  insertText: z.string(),
  author: z.string().nullable().optional(),
});

export const CreateCheckpointInputSchema: z.ZodType<CreateCheckpointInput> = z.object({
  worldlineId: z.string(),
  kind: CheckpointKindSchema,
  label: z.string().nullable().optional(),
});

export const WorldlineSnapshotInputSchema: z.ZodType<WorldlineSnapshotInput> = z.object({
  worldlineId: z.string(),
});

export const TextWindowInputSchema: z.ZodType<TextWindowInput> = z.object({
  worldlineId: z.string(),
  basisHeadId: z.string(),
  startByte: z.number().int(),
  endByte: z.number().int(),
  cursorLine: z.number().int(),
  viewportLineCount: z.number().int(),
  beforeLines: z.number().int(),
  afterLines: z.number().int(),
  maxBytes: z.number().int(),
});

export const CausalLineDiffInputSchema: z.ZodType<CausalLineDiffInput> = z.object({
  worldlineId: z.string(),
  basisHeadId: z.string(),
  nextHeadId: z.string(),
  maxByteCount: z.number().int(),
  maxLineCount: z.number().int(),
  maxRewriteCount: z.number().int(),
  maxMarkerCount: z.number().int(),
});

export const CreateBufferWorldlineResultSchema: z.ZodType<CreateBufferWorldlineResult> = z.object({
  worldline: BufferWorldlineSchema,
  head: RopeHeadSchema,
  checkpoint: z.union([CheckpointSchema, z.null()]).optional().transform((value) => value ?? null),
});

export const ReplaceRangeAsTickResultSchema: z.ZodType<ReplaceRangeAsTickResult> = z.object({
  worldline: BufferWorldlineSchema,
  nextHead: RopeHeadSchema,
  ropeRewrite: RopeRewriteSchema,
  ropeDiff: RopeDiffSchema,
});

export const CreateCheckpointResultSchema: z.ZodType<CreateCheckpointResult> = z.object({
  worldline: BufferWorldlineSchema,
  head: RopeHeadSchema,
  checkpoint: CheckpointSchema,
});
