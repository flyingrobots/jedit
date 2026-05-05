import { z } from 'zod';

// Enums
export const TextEncodingSchema = z.enum(["UTF8"]);
export type TextEncoding = z.infer<typeof TextEncodingSchema>;

export const AnchorKindSchema = z.enum(["CURSOR", "SELECTION", "BOOKMARK", "COMMENT", "DIAGNOSTIC_TARGET", "AI_TARGET"]);
export type AnchorKind = z.infer<typeof AnchorKindSchema>;

export const AnchorBiasSchema = z.enum(["LEFT", "RIGHT"]);
export type AnchorBias = z.infer<typeof AnchorBiasSchema>;

export const AnchorStickinessSchema = z.enum(["LEADING", "TRAILING", "EXPAND"]);
export type AnchorStickiness = z.infer<typeof AnchorStickinessSchema>;

export const TickKindSchema = z.enum(["BUFFER_CREATE", "TEXT_REWRITE", "CHECKPOINT_CREATE", "ANCHOR_REGISTER"]);
export type TickKind = z.infer<typeof TickKindSchema>;

export const TickReceiptRewriteKindSchema = z.enum(["CREATE_BUFFER_WORLDLINE", "REPLACE_RANGE_AS_TICK", "CREATE_CHECKPOINT", "REGISTER_ANCHOR"]);
export type TickReceiptRewriteKind = z.infer<typeof TickReceiptRewriteKindSchema>;

export const CheckpointKindSchema = z.enum(["INITIAL", "MANUAL_SAVE", "AUTO_SAVE"]);
export type CheckpointKind = z.infer<typeof CheckpointKindSchema>;

// Object Types
export const BufferWorldlineSchema = z.object({
  worldlineId: z.string(),
  bufferKey: z.string(),
  canonicalHeadId: z.string(),
  createdAtTickId: z.string().nullable().optional(),
  projectionPath: z.string().nullable().optional()
});
export type BufferWorldline = z.infer<typeof BufferWorldlineSchema>;

export const RopeHeadSchema = z.object({
  headId: z.string(),
  worldlineId: z.string(),
  rootNodeId: z.string(),
  byteLength: z.number().int(),
  lineCount: z.number().int(),
  utf16Length: z.number().int(),
  equivalenceDigest: z.string()
});
export type RopeHead = z.infer<typeof RopeHeadSchema>;

export const RopeBranchSchema = z.object({
  branchId: z.string(),
  byteLength: z.number().int(),
  lineCount: z.number().int(),
  utf16Length: z.number().int(),
  height: z.number().int().nullable().optional()
});
export type RopeBranch = z.infer<typeof RopeBranchSchema>;

export const RopeLeafSchema = z.object({
  leafId: z.string(),
  blobId: z.string(),
  startByte: z.number().int(),
  endByte: z.number().int(),
  byteLength: z.number().int(),
  lineCount: z.number().int(),
  utf16Length: z.number().int()
});
export type RopeLeaf = z.infer<typeof RopeLeafSchema>;

export const TextBlobSchema = z.object({
  blobId: z.string(),
  encoding: TextEncodingSchema,
  byteLength: z.number().int(),
  contentHash: z.string()
});
export type TextBlob = z.infer<typeof TextBlobSchema>;

export const AnchorSchema = z.object({
  anchorId: z.string(),
  kind: AnchorKindSchema,
  basisHeadId: z.string(),
  startByte: z.number().int(),
  endByte: z.number().int().nullable().optional(),
  startBias: AnchorBiasSchema,
  endBias: AnchorBiasSchema.nullable().optional(),
  stickiness: AnchorStickinessSchema.nullable().optional()
});
export type Anchor = z.infer<typeof AnchorSchema>;

export const TickSchema = z.object({
  tickId: z.string(),
  worldlineId: z.string(),
  kind: TickKindSchema,
  sequenceNumber: z.number().int(),
  author: z.string().nullable().optional()
});
export type Tick = z.infer<typeof TickSchema>;

export const TickReceiptSchema = z.object({
  receiptId: z.string(),
  tickId: z.string(),
  baseHeadId: z.string(),
  nextHeadId: z.string(),
  rewriteKind: TickReceiptRewriteKindSchema,
  startByte: z.number().int().nullable().optional(),
  endByte: z.number().int().nullable().optional(),
  insertedByteLength: z.number().int(),
  deletedByteLength: z.number().int(),
  inverseFragmentDigest: z.string().nullable().optional(),
  summary: z.string().nullable().optional()
});
export type TickReceipt = z.infer<typeof TickReceiptSchema>;

export const CheckpointSchema = z.object({
  checkpointId: z.string(),
  worldlineId: z.string(),
  headId: z.string(),
  kind: CheckpointKindSchema,
  label: z.string().nullable().optional(),
  createdByTickId: z.string().nullable().optional()
});
export type Checkpoint = z.infer<typeof CheckpointSchema>;

export const WorldlineSnapshotSchema = z.object({
  worldline: z.lazy(() => BufferWorldlineSchema),
  head: z.lazy(() => RopeHeadSchema),
  checkpoints: z.array(z.lazy(() => CheckpointSchema)),
  text: z.string()
});
export type WorldlineSnapshot = z.infer<typeof WorldlineSnapshotSchema>;

export const TextLineReadingSchema = z.object({
  lineNumber: z.number().int(),
  text: z.string(),
  startByte: z.number().int(),
  endByte: z.number().int()
});
export type TextLineReading = z.infer<typeof TextLineReadingSchema>;

export const TextWindowReadingSchema = z.object({
  worldline: z.lazy(() => BufferWorldlineSchema),
  head: z.lazy(() => RopeHeadSchema),
  readingId: z.string(),
  startLine: z.number().int(),
  lineCount: z.number().int(),
  totalLineCount: z.number().int(),
  hasMoreBefore: z.boolean(),
  hasMoreAfter: z.boolean(),
  lines: z.array(z.lazy(() => TextLineReadingSchema))
});
export type TextWindowReading = z.infer<typeof TextWindowReadingSchema>;

export const CreateBufferWorldlineResultSchema = z.object({
  worldline: z.lazy(() => BufferWorldlineSchema),
  head: z.lazy(() => RopeHeadSchema),
  checkpoint: z.lazy(() => CheckpointSchema).nullable().optional()
});
export type CreateBufferWorldlineResult = z.infer<typeof CreateBufferWorldlineResultSchema>;

export const ReplaceRangeAsTickResultSchema = z.object({
  worldline: z.lazy(() => BufferWorldlineSchema),
  nextHead: z.lazy(() => RopeHeadSchema),
  tick: z.lazy(() => TickSchema),
  receipt: z.lazy(() => TickReceiptSchema)
});
export type ReplaceRangeAsTickResult = z.infer<typeof ReplaceRangeAsTickResultSchema>;

export const CreateCheckpointResultSchema = z.object({
  worldline: z.lazy(() => BufferWorldlineSchema),
  head: z.lazy(() => RopeHeadSchema),
  checkpoint: z.lazy(() => CheckpointSchema)
});
export type CreateCheckpointResult = z.infer<typeof CreateCheckpointResultSchema>;

// Input Types
export const CreateBufferWorldlineInputSchema = z.object({
  bufferKey: z.string(),
  initialText: z.string().nullable().optional(),
  projectionPath: z.string().nullable().optional(),
  createInitialCheckpoint: z.boolean().nullable().optional()
});
export type CreateBufferWorldlineInput = z.infer<typeof CreateBufferWorldlineInputSchema>;

export const ReplaceRangeAsTickInputSchema = z.object({
  worldlineId: z.string(),
  baseHeadId: z.string(),
  startByte: z.number().int(),
  endByte: z.number().int(),
  insertText: z.string(),
  author: z.string().nullable().optional()
});
export type ReplaceRangeAsTickInput = z.infer<typeof ReplaceRangeAsTickInputSchema>;

export const CreateCheckpointInputSchema = z.object({
  worldlineId: z.string(),
  kind: CheckpointKindSchema,
  label: z.string().nullable().optional()
});
export type CreateCheckpointInput = z.infer<typeof CreateCheckpointInputSchema>;

export const WorldlineSnapshotInputSchema = z.object({
  worldlineId: z.string()
});
export type WorldlineSnapshotInput = z.infer<typeof WorldlineSnapshotInputSchema>;

export const TextWindowInputSchema = z.object({
  worldlineId: z.string(),
  cursorLine: z.number().int(),
  viewportLineCount: z.number().int(),
  beforeLines: z.number().int(),
  afterLines: z.number().int(),
  maxBytes: z.number().int()
});
export type TextWindowInput = z.infer<typeof TextWindowInputSchema>;

// Operations
export const WorldlineSnapshotQueryArgsSchema = z.object({
  input: z.lazy(() => WorldlineSnapshotInputSchema)
});
export type WorldlineSnapshotQueryArgs = z.infer<typeof WorldlineSnapshotQueryArgsSchema>;
export const WorldlineSnapshotQueryOperationSchema = z.object({
  operationName: z.literal("worldlineSnapshot"),
  args: z.lazy(() => WorldlineSnapshotQueryArgsSchema),
  result: z.lazy(() => WorldlineSnapshotSchema)
});
export type WorldlineSnapshotQueryOperation = z.infer<typeof WorldlineSnapshotQueryOperationSchema>;

export const TextWindowQueryArgsSchema = z.object({
  input: z.lazy(() => TextWindowInputSchema)
});
export type TextWindowQueryArgs = z.infer<typeof TextWindowQueryArgsSchema>;
export const TextWindowQueryOperationSchema = z.object({
  operationName: z.literal("textWindow"),
  args: z.lazy(() => TextWindowQueryArgsSchema),
  result: z.lazy(() => TextWindowReadingSchema)
});
export type TextWindowQueryOperation = z.infer<typeof TextWindowQueryOperationSchema>;

export const QueryOperationSchemas = {
  worldlineSnapshot: {
    args: WorldlineSnapshotQueryArgsSchema,
    input: z.lazy(() => WorldlineSnapshotInputSchema),
    result: z.lazy(() => WorldlineSnapshotSchema),
    operation: WorldlineSnapshotQueryOperationSchema
  },
  textWindow: {
    args: TextWindowQueryArgsSchema,
    input: z.lazy(() => TextWindowInputSchema),
    result: z.lazy(() => TextWindowReadingSchema),
    operation: TextWindowQueryOperationSchema
  },
} as const;
export const CreateBufferWorldlineMutationArgsSchema = z.object({
  input: z.lazy(() => CreateBufferWorldlineInputSchema)
});
export type CreateBufferWorldlineMutationArgs = z.infer<typeof CreateBufferWorldlineMutationArgsSchema>;
export const CreateBufferWorldlineMutationOperationSchema = z.object({
  operationName: z.literal("createBufferWorldline"),
  args: z.lazy(() => CreateBufferWorldlineMutationArgsSchema),
  result: z.lazy(() => CreateBufferWorldlineResultSchema)
});
export type CreateBufferWorldlineMutationOperation = z.infer<typeof CreateBufferWorldlineMutationOperationSchema>;

export const ReplaceRangeAsTickMutationArgsSchema = z.object({
  input: z.lazy(() => ReplaceRangeAsTickInputSchema)
});
export type ReplaceRangeAsTickMutationArgs = z.infer<typeof ReplaceRangeAsTickMutationArgsSchema>;
export const ReplaceRangeAsTickMutationOperationSchema = z.object({
  operationName: z.literal("replaceRangeAsTick"),
  args: z.lazy(() => ReplaceRangeAsTickMutationArgsSchema),
  result: z.lazy(() => ReplaceRangeAsTickResultSchema)
});
export type ReplaceRangeAsTickMutationOperation = z.infer<typeof ReplaceRangeAsTickMutationOperationSchema>;

export const CreateCheckpointMutationArgsSchema = z.object({
  input: z.lazy(() => CreateCheckpointInputSchema)
});
export type CreateCheckpointMutationArgs = z.infer<typeof CreateCheckpointMutationArgsSchema>;
export const CreateCheckpointMutationOperationSchema = z.object({
  operationName: z.literal("createCheckpoint"),
  args: z.lazy(() => CreateCheckpointMutationArgsSchema),
  result: z.lazy(() => CreateCheckpointResultSchema)
});
export type CreateCheckpointMutationOperation = z.infer<typeof CreateCheckpointMutationOperationSchema>;

export const MutationOperationSchemas = {
  createBufferWorldline: {
    args: CreateBufferWorldlineMutationArgsSchema,
    input: z.lazy(() => CreateBufferWorldlineInputSchema),
    result: z.lazy(() => CreateBufferWorldlineResultSchema),
    operation: CreateBufferWorldlineMutationOperationSchema
  },
  replaceRangeAsTick: {
    args: ReplaceRangeAsTickMutationArgsSchema,
    input: z.lazy(() => ReplaceRangeAsTickInputSchema),
    result: z.lazy(() => ReplaceRangeAsTickResultSchema),
    operation: ReplaceRangeAsTickMutationOperationSchema
  },
  createCheckpoint: {
    args: CreateCheckpointMutationArgsSchema,
    input: z.lazy(() => CreateCheckpointInputSchema),
    result: z.lazy(() => CreateCheckpointResultSchema),
    operation: CreateCheckpointMutationOperationSchema
  },
} as const;