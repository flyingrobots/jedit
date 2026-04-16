// Enums
export type TextEncoding = "UTF8";
export type AnchorKind = "CURSOR" | "SELECTION" | "BOOKMARK" | "COMMENT" | "DIAGNOSTIC_TARGET" | "AI_TARGET";
export type AnchorBias = "LEFT" | "RIGHT";
export type TickKind = "BUFFER_CREATE" | "TEXT_REWRITE" | "CHECKPOINT_CREATE" | "ANCHOR_REGISTER";
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
  stickiness?: string | null;
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
  rewriteKind: string;
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
  kind: string;
  label?: string | null;
  createdByTickId?: string | null;
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
  kind: string;
  label?: string | null;
}