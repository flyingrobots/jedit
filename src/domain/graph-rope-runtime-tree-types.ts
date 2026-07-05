import {
  ROPE_BRANCH_FACT_KIND,
  ROPE_LEAF_FACT_KIND,
  type RopeAdmittedFact,
  type RopeBranchFact,
  type RopeDiffFact,
  type RopeHeadFact,
  type RopeLeafFact,
  type RopeRewriteFact,
  type TextBlobFact,
  type TextBlobHashPort,
  type TextByteRange,
  type TickReceiptFact,
} from './graph-rope-contract.js';
import type { GraphRopeRuntimeObstructionCode } from './graph-rope-runtime-issues.js';

export const ZERO_VALUE = 0;
export const ONE_VALUE = 1;
export const TWO_VALUE = 2;
export const LEAF_TARGET_BYTE_LENGTH = 1024;
export const LINE_FEED_BYTE = 10;
export const CARRIAGE_RETURN_BYTE = 13;
export const UTF8_CONTINUATION_MASK = 0xc0;
export const UTF8_CONTINUATION_TAG = 0x80;
export const RUNTIME_HASH_PREFIX_BRANCH = 'branch:';
export const RUNTIME_HASH_PREFIX_DIFF = 'diff:';
export const RUNTIME_HASH_PREFIX_HEAD = 'head:';
export const RUNTIME_HASH_PREFIX_LEAF = 'leaf:';
export const RUNTIME_HASH_PREFIX_RECEIPT = 'receipt:';
export const RUNTIME_HASH_PREFIX_REWRITE = 'rewrite:';
export const RUNTIME_HASH_PREFIX_SPAN = 'span:';
export const RUNTIME_HASH_PREFIX_TICK = 'tick:';
export const RUNTIME_HASH_PREFIX_NODE = 'rope-node:';
export const RUNTIME_HASH_PREFIX_HEAD_ID = 'rope-head:';
export const RUNTIME_HASH_PREFIX_DIFF_ID = 'rope-diff:';
export const RUNTIME_HASH_PREFIX_REWRITE_ID = 'rope-rewrite:';
export const RUNTIME_HASH_PREFIX_ADMISSION_ID = 'rope-admission:';

export type RopeNodeFact = RopeBranchFact | RopeLeafFact;

export type TreeResult<TValue> =
  | { readonly ok: true; readonly value: TValue }
  | { readonly ok: false; readonly code: GraphRopeRuntimeObstructionCode };

export interface NodeRef {
  readonly nodeId: string;
  readonly byteLength: number;
  readonly lineCount: number;
  readonly height: number;
  readonly fact: RopeNodeFact | null;
}

export interface LeafSegment {
  readonly leaf: RopeLeafFact;
  readonly blob: TextBlobFact;
  readonly startByte: number;
  readonly endByte: number;
  readonly bytes: Uint8Array;
}

export interface WindowBytes {
  readonly bytes: Uint8Array;
  readonly evidence: readonly GraphRopeTreeWindowEvidence[];
}

export interface GraphRopeRuntimeFactReader {
  getFact(id: string): RopeAdmittedFact | null;
}

export interface GraphRopeTreeBuild {
  readonly root: NodeRef;
  readonly facts: readonly RopeNodeFact[];
}

export interface GraphRopeTreeWindowEvidence {
  readonly leafId: string;
  readonly blobId: string;
  readonly contentHash: string;
  readonly byteRange: TextByteRange;
}

export interface GraphRopeTreeWindowReading {
  readonly text: string;
  readonly validationEvidence: readonly GraphRopeTreeWindowEvidence[];
}

export interface GraphRopeTreeDebugShape {
  readonly nodeCount: number;
  readonly leafCount: number;
  readonly maxDepth: number;
  readonly retainedBlobBytes: number;
  readonly materializedProjectionBytes: number;
  readonly nodes: readonly GraphRopeTreeDebugNode[];
}

export interface GraphRopeTreeDebugNode {
  readonly nodeId: string;
  readonly kind: typeof ROPE_LEAF_FACT_KIND | typeof ROPE_BRANCH_FACT_KIND;
  readonly byteLength: number;
  readonly contentHash: string;
}

export type GraphRopeReplacePlan =
  | { readonly changed: false; readonly basisHead: RopeHeadFact; readonly nextHead: RopeHeadFact }
  | {
      readonly changed: true;
      readonly basisHead: RopeHeadFact;
      readonly nextHead: RopeHeadFact;
      readonly replacementBlob: TextBlobFact;
      readonly rewrite: RopeRewriteFact;
      readonly diff: RopeDiffFact;
      readonly receipt: TickReceiptFact;
      readonly facts: readonly RopeAdmittedFact[];
    };

export interface GraphRopeReplaceInput {
  readonly basisHead: RopeHeadFact;
  readonly range: TextByteRange;
  readonly replacementText: string;
  readonly hash: TextBlobHashPort;
  readonly sequence: number;
  readonly reader: GraphRopeRuntimeFactReader;
}
