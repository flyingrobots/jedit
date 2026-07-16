// Enums
export type TextEncoding = "UTF8";
export type AnchorKind = "CURSOR" | "SELECTION" | "BOOKMARK" | "COMMENT" | "DIAGNOSTIC_TARGET" | "AI_TARGET";
export type AnchorBias = "LEFT" | "RIGHT";
export type AnchorStickiness = "LEADING" | "TRAILING" | "EXPAND";
export type RewriteKind = "CREATE_BUFFER_WORLDLINE" | "REPLACE_RANGE_AS_TICK" | "CREATE_CHECKPOINT" | "REGISTER_ANCHOR";
export type CheckpointKind = "INITIAL" | "MANUAL_SAVE" | "AUTO_SAVE";
export type CausalLineMarkerKind = "INSERTED" | "MODIFIED";
// Object Types
export interface BufferWorldline {
  worldlineId: string;
  bufferKey: string;
  canonicalHeadId: string;
  createdAtRopeRewriteId?: string | null;
  projectionPath?: string | null;
}
export interface RopeHead {
  headId: string;
  worldlineId: string;
  rootNodeId: string;
  byteLength: number;
  lineCount: number;
  utf16Length: number;
  equivalenceDigest: string;
}
export interface RopeBranch {
  branchId: string;
  byteLength: number;
  lineCount: number;
  utf16Length: number;
  height?: number | null;
}
export interface RopeLeaf {
  leafId: string;
  blobId: string;
  startByte: number;
  endByte: number;
  byteLength: number;
  lineCount: number;
  utf16Length: number;
}
export interface TextBlob {
  blobId: string;
  encoding: TextEncoding;
  byteLength: number;
  contentHash: string;
}
export interface Anchor {
  anchorId: string;
  kind: AnchorKind;
  basisHeadId: string;
  startByte: number;
  endByte?: number | null;
  startBias: AnchorBias;
  endBias?: AnchorBias | null;
  stickiness?: AnchorStickiness | null;
}
export interface RopeRewrite {
  ropeRewriteId: string;
  worldlineId: string;
  kind: RewriteKind;
  sequenceNumber: number;
  author?: string | null;
}
export interface RopeDiff {
  ropeDiffId: string;
  ropeRewriteId: string;
  baseHeadId: string;
  nextHeadId: string;
  rewriteKind: RewriteKind;
  startByte?: number | null;
  endByte?: number | null;
  insertedByteLength: number;
  deletedByteLength: number;
  inverseFragmentDigest?: string | null;
  summary?: string | null;
}
export interface Checkpoint {
  checkpointId: string;
  worldlineId: string;
  headId: string;
  kind: CheckpointKind;
  label?: string | null;
  createdByRopeRewriteId?: string | null;
}
export interface WorldlineSnapshot {
  worldline: BufferWorldline;
  head: RopeHead;
  checkpoints: Array<Checkpoint>;
  text: string;
}
export interface TextLineReading {
  lineNumber: number;
  text: string;
  startByte: number;
  endByte: number;
}
export interface TextWindowHeadBasis {
  headId: string;
  worldlineId: string;
  rootNodeId: string;
  byteLength: number;
  lineCount: number;
}
export interface TextWindowReading {
  worldline: BufferWorldline;
  head: TextWindowHeadBasis;
  readingId: string;
  startLine: number;
  lineCount: number;
  totalLineCount: number;
  hasMoreBefore: boolean;
  hasMoreAfter: boolean;
  lines: Array<TextLineReading>;
}
export interface CausalLineMarker {
  lineNumber: number;
  kind: CausalLineMarkerKind;
  tickReceiptIds: Array<string>;
  rewriteIds: Array<string>;
  diffIds: Array<string>;
}
export interface CausalLineDeletionMarker {
  boundaryLineNumber: number;
  deletedLineCount: number;
  tickReceiptIds: Array<string>;
  rewriteIds: Array<string>;
  diffIds: Array<string>;
}
export interface CausalLineDiffReading {
  worldlineId: string;
  basisHeadId: string;
  nextHeadId: string;
  insertedLineCount: number;
  deletedLineCount: number;
  tickReceiptIds: Array<string>;
  rewriteIds: Array<string>;
  diffIds: Array<string>;
  markers: Array<CausalLineMarker>;
  deletions: Array<CausalLineDeletionMarker>;
  observerVersion: string;
}
export interface CreateBufferWorldlineResult {
  worldline: BufferWorldline;
  head: RopeHead;
  checkpoint?: Checkpoint | null;
}
export interface ReplaceRangeAsTickResult {
  worldline: BufferWorldline;
  nextHead: RopeHead;
  ropeRewrite: RopeRewrite;
  ropeDiff: RopeDiff;
}
export interface CreateCheckpointResult {
  worldline: BufferWorldline;
  head: RopeHead;
  checkpoint: Checkpoint;
}
// Input Types
export interface CreateBufferWorldlineInput {
  bufferKey: string;
  initialText?: string | null;
  projectionPath?: string | null;
  createInitialCheckpoint?: boolean | null;
}
export interface ReplaceRangeAsTickInput {
  worldlineId: string;
  baseHeadId: string;
  startByte: number;
  endByte: number;
  insertText: string;
  author?: string | null;
}
export interface CreateCheckpointInput {
  worldlineId: string;
  kind: CheckpointKind;
  label?: string | null;
}
export interface WorldlineSnapshotInput {
  worldlineId: string;
}
export interface TextWindowInput {
  worldlineId: string;
  basisHeadId: string;
  startByte: number;
  endByte: number;
  cursorLine: number;
  viewportLineCount: number;
  beforeLines: number;
  afterLines: number;
  maxBytes: number;
}
export interface CausalLineDiffInput {
  worldlineId: string;
  basisHeadId: string;
  nextHeadId: string;
  maxByteCount: number;
  maxLineCount: number;
  maxRewriteCount: number;
  maxMarkerCount: number;
}
// Operations
export interface WorldlineSnapshotQueryArgs {
  input: WorldlineSnapshotInput;
}
export interface WorldlineSnapshotQueryOperation {
  operationName: "worldlineSnapshot";
  args: WorldlineSnapshotQueryArgs;
  input: WorldlineSnapshotInput;
  result: WorldlineSnapshot;
}
export interface TextWindowQueryArgs {
  input: TextWindowInput;
}
export interface TextWindowQueryOperation {
  operationName: "textWindow";
  args: TextWindowQueryArgs;
  input: TextWindowInput;
  result: TextWindowReading;
}
export interface CausalLineDiffQueryArgs {
  input: CausalLineDiffInput;
}
export interface CausalLineDiffQueryOperation {
  operationName: "causalLineDiff";
  args: CausalLineDiffQueryArgs;
  input: CausalLineDiffInput;
  result: CausalLineDiffReading;
}
export interface QueryOperationMap {
  worldlineSnapshot: WorldlineSnapshotQueryOperation;
  textWindow: TextWindowQueryOperation;
  causalLineDiff: CausalLineDiffQueryOperation;
}
export type QueryOperationName = keyof QueryOperationMap;
export type QueryOperation = QueryOperationMap[QueryOperationName];
export interface CreateBufferWorldlineMutationArgs {
  input: CreateBufferWorldlineInput;
}
export interface CreateBufferWorldlineMutationOperation {
  operationName: "createBufferWorldline";
  args: CreateBufferWorldlineMutationArgs;
  input: CreateBufferWorldlineInput;
  result: CreateBufferWorldlineResult;
}
export interface ReplaceRangeAsTickMutationArgs {
  input: ReplaceRangeAsTickInput;
}
export interface ReplaceRangeAsTickMutationOperation {
  operationName: "replaceRangeAsTick";
  args: ReplaceRangeAsTickMutationArgs;
  input: ReplaceRangeAsTickInput;
  result: ReplaceRangeAsTickResult;
}
export interface CreateCheckpointMutationArgs {
  input: CreateCheckpointInput;
}
export interface CreateCheckpointMutationOperation {
  operationName: "createCheckpoint";
  args: CreateCheckpointMutationArgs;
  input: CreateCheckpointInput;
  result: CreateCheckpointResult;
}
export interface MutationOperationMap {
  createBufferWorldline: CreateBufferWorldlineMutationOperation;
  replaceRangeAsTick: ReplaceRangeAsTickMutationOperation;
  createCheckpoint: CreateCheckpointMutationOperation;
}
export type MutationOperationName = keyof MutationOperationMap;
export type MutationOperation = MutationOperationMap[MutationOperationName];