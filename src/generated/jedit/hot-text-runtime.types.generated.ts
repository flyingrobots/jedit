// Enums
export type TextEncoding = "UTF8";
export type AnchorKind = "CURSOR" | "SELECTION" | "BOOKMARK" | "COMMENT" | "DIAGNOSTIC_TARGET" | "AI_TARGET";
export type AnchorBias = "LEFT" | "RIGHT";
export type AnchorStickiness = "LEADING" | "TRAILING" | "EXPAND";
export type TickKind = "BUFFER_CREATE" | "TEXT_REWRITE" | "CHECKPOINT_CREATE" | "ANCHOR_REGISTER";
export type TickReceiptRewriteKind = "CREATE_BUFFER_WORLDLINE" | "REPLACE_RANGE_AS_TICK" | "CREATE_CHECKPOINT" | "REGISTER_ANCHOR";
export type CheckpointKind = "INITIAL" | "MANUAL_SAVE" | "AUTO_SAVE";
// Object Types
export interface BufferWorldline {
  worldlineId: string;
  bufferKey: string;
  canonicalHeadId: string;
  createdAtTickId?: string | null;
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
export interface Tick {
  tickId: string;
  worldlineId: string;
  kind: TickKind;
  sequenceNumber: number;
  author?: string | null;
}
export interface TickReceipt {
  receiptId: string;
  tickId: string;
  baseHeadId: string;
  nextHeadId: string;
  rewriteKind: TickReceiptRewriteKind;
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
  createdByTickId?: string | null;
}
export interface WorldlineSnapshot {
  worldline: BufferWorldline;
  head: RopeHead;
  checkpoints: Array<Checkpoint>;
  text: string;
}
export interface CreateBufferWorldlineResult {
  worldline: BufferWorldline;
  head: RopeHead;
  checkpoint?: Checkpoint | null;
}
export interface ReplaceRangeAsTickResult {
  worldline: BufferWorldline;
  nextHead: RopeHead;
  tick: Tick;
  receipt: TickReceipt;
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
export interface QueryOperationMap {
  worldlineSnapshot: WorldlineSnapshotQueryOperation;
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