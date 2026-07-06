export const GRAPH_ROPE_SCHEMA_VERSION = 1;
export const BYTE_OFFSET_COORDINATE_KIND = 'utf8-byte-offset';
export const UTF16_OFFSET_COORDINATE_KIND = 'utf16-code-unit-offset';
export const ZERO_BASED_LINE_INDEX_KIND = 'zero-based-line-index';
export const COORDINATE_VALIDATION_ERROR_INVALID_COORDINATE = 'invalid-coordinate';

export const TEXT_BLOB_ENCODING_UTF8 = 'utf8';
export const INLINE_UTF8_BYTES_STORAGE_KIND = 'inline-utf8-bytes';
export const CONTENT_ADDRESSED_BLOB_STORE_KIND = 'content-addressed-blob-store';
export const TEXT_BLOB_STORE_ID = 'jedit.text.blob-store.v1';

export const BUFFER_WORLDLINE_FACT_KIND = 'jedit.text.BufferWorldline';
export const ROPE_HEAD_FACT_KIND = 'jedit.text.RopeHead';
export const ROPE_BRANCH_FACT_KIND = 'jedit.text.RopeBranch';
export const ROPE_LEAF_FACT_KIND = 'jedit.text.RopeLeaf';
export const TEXT_BLOB_FACT_KIND = 'jedit.text.TextBlob';
export const ROPE_REWRITE_FACT_KIND = 'jedit.text.RopeRewrite';
export const ROPE_DIFF_FACT_KIND = 'jedit.text.RopeDiff';
export const TICK_RECEIPT_FACT_KIND = 'jedit.text.TickReceipt';
export const ROPE_STRUCTURAL_MAINTENANCE_FACT_KIND = 'jedit.text.RopeStructuralMaintenance';
export const ROPE_CHECKPOINT_FACT_KIND = 'jedit.text.RopeCheckpoint';
export const ECHO_CAUSAL_ANCHOR_FACT_KIND = 'echo.causal.Anchor';

export const JEDIT_CAUSAL_ANCHOR_APP_ID = 'jedit';
export const JEDIT_CAUSAL_ANCHOR_SUBJECT_KIND_BUFFER_WORLDLINE = 'BufferWorldline';
export const JEDIT_CAUSAL_ANCHOR_SUBJECT_KIND_ROPE_HEAD = 'RopeHead';

export const ECHO_CAUSAL_ANCHOR_ROOT_KIND_CAS_OBJECT = 'CasObject';
export const ECHO_CAUSAL_ANCHOR_ROOT_KIND_GRAPH_FACT = 'GraphFact';
export const ECHO_CAUSAL_ANCHOR_ROOT_KIND_APP_SUBJECT = 'AppSubjectRoot';
export const ECHO_CAUSAL_ANCHOR_ROOT_ROLE_AUTHORITY = 'authority';
export const ECHO_CAUSAL_ANCHOR_ROOT_ROLE_EVIDENCE = 'evidence';
export const ECHO_CAUSAL_ANCHOR_ROOT_ROLE_INDEX = 'index';
export const ECHO_CAUSAL_ANCHOR_ROOT_ROLE_MATERIALIZATION = 'materialization';
export const ECHO_CAUSAL_ANCHOR_ROOT_ROLE_MANIFEST = 'manifest';
export const ECHO_CAUSAL_ANCHOR_RETENTION_CLASS_RECOVERY = 'recovery';
export const ECHO_CAUSAL_ANCHOR_RETENTION_CLASS_RETENTION = 'retention';
export const ECHO_CAUSAL_ANCHOR_RETENTION_CLASS_EXPORT = 'export';
export const ECHO_CAUSAL_ANCHOR_RETENTION_CLASS_USER_SAVE = 'user-save';
export const ECHO_CAUSAL_ANCHOR_RETENTION_CLASS_AUTOSAVE = 'autosave';
export const ECHO_CAUSAL_ANCHOR_RETENTION_CLASS_DEBUG = 'debug';
export const ECHO_CAUSAL_ANCHOR_RETENTION_CLASS_CACHE_WARM = 'cache-warm';
export const ECHO_CAUSAL_ANCHOR_ADMISSION_AUTHORITY_ECHO = 'echo';

export const ROPE_DIFF_SPAN_EQUAL_KIND = 'equal';
export const ROPE_DIFF_SPAN_DELETE_KIND = 'delete';
export const ROPE_DIFF_SPAN_INSERT_KIND = 'insert';

export const FACT_VALIDATION_ERROR_INVALID_KIND = 'invalid-kind';
export const FACT_VALIDATION_ERROR_INVALID_SCHEMA_VERSION = 'invalid-schema-version';
export const FACT_VALIDATION_ERROR_INVALID_ID = 'invalid-id';
export const FACT_VALIDATION_ERROR_INVALID_REFERENCE = 'invalid-reference';
export const FACT_VALIDATION_ERROR_INVALID_METRIC = 'invalid-metric';
export const FACT_VALIDATION_ERROR_INVALID_HASH = 'invalid-hash';
export const FACT_VALIDATION_ERROR_HASH_MISMATCH = 'hash-mismatch';
export const FACT_VALIDATION_ERROR_INVALID_UTF8 = 'invalid-utf8';

export interface ByteOffset {
  readonly kind: typeof BYTE_OFFSET_COORDINATE_KIND;
  readonly value: number;
}

export interface Utf16Offset {
  readonly kind: typeof UTF16_OFFSET_COORDINATE_KIND;
  readonly value: number;
}

export interface ZeroBasedLineIndex {
  readonly kind: typeof ZERO_BASED_LINE_INDEX_KIND;
  readonly value: number;
}

export interface LineColumn {
  readonly line: ZeroBasedLineIndex;
  readonly columnUtf16: Utf16Offset;
}

export interface TextByteRange {
  readonly startByte: ByteOffset;
  readonly endByte: ByteOffset;
}

export type CoordinateValidationErrorCode = typeof COORDINATE_VALIDATION_ERROR_INVALID_COORDINATE;

export type CoordinateResult<TValue> =
  | { readonly ok: true; readonly value: TValue }
  | { readonly ok: false; readonly code: CoordinateValidationErrorCode };

export type FactValidationErrorCode =
  | typeof FACT_VALIDATION_ERROR_INVALID_KIND
  | typeof FACT_VALIDATION_ERROR_INVALID_SCHEMA_VERSION
  | typeof FACT_VALIDATION_ERROR_INVALID_ID
  | typeof FACT_VALIDATION_ERROR_INVALID_REFERENCE
  | typeof FACT_VALIDATION_ERROR_INVALID_METRIC
  | typeof FACT_VALIDATION_ERROR_INVALID_HASH
  | typeof FACT_VALIDATION_ERROR_HASH_MISMATCH
  | typeof FACT_VALIDATION_ERROR_INVALID_UTF8;

export type FactValidationResult<TFact> =
  | { readonly ok: true; readonly fact: TFact }
  | { readonly ok: false; readonly code: FactValidationErrorCode };

export interface TextBlobHashPort {
  sha256Hex(value: string): string;
}

export interface BufferWorldlineFact {
  readonly kind: typeof BUFFER_WORLDLINE_FACT_KIND;
  readonly schemaVersion: typeof GRAPH_ROPE_SCHEMA_VERSION;
  readonly worldlineId: string;
  readonly createdAtTick: string;
  readonly initialHeadId: string;
}

export interface RopeHeadFact {
  readonly kind: typeof ROPE_HEAD_FACT_KIND;
  readonly schemaVersion: typeof GRAPH_ROPE_SCHEMA_VERSION;
  readonly headId: string;
  readonly worldlineId: string;
  readonly rootNodeId: string;
  readonly basisHeadId?: string;
  readonly createdByTickId: string;
  readonly byteLength: number;
  readonly lineCount: number;
  readonly contentHash: string;
}

export interface RopeBranchFact {
  readonly kind: typeof ROPE_BRANCH_FACT_KIND;
  readonly schemaVersion: typeof GRAPH_ROPE_SCHEMA_VERSION;
  readonly nodeId: string;
  readonly left: string;
  readonly right: string;
  readonly byteLength: number;
  readonly lineCount: number;
  readonly height: number;
  readonly contentHash: string;
}

export interface RopeLeafFact {
  readonly kind: typeof ROPE_LEAF_FACT_KIND;
  readonly schemaVersion: typeof GRAPH_ROPE_SCHEMA_VERSION;
  readonly nodeId: string;
  readonly blobId: string;
  readonly byteStart: ByteOffset;
  readonly byteLength: number;
  readonly lineCount: number;
  readonly contentHash: string;
}

export interface InlineTextBlobStorage {
  readonly kind: typeof INLINE_UTF8_BYTES_STORAGE_KIND;
  readonly bytes: Uint8Array;
}

export interface StoredTextBlobStorage {
  readonly kind: typeof CONTENT_ADDRESSED_BLOB_STORE_KIND;
  readonly storeId: typeof TEXT_BLOB_STORE_ID;
  readonly contentRef: string;
}

export type TextBlobStorage = InlineTextBlobStorage | StoredTextBlobStorage;

export interface TextBlobFact {
  readonly kind: typeof TEXT_BLOB_FACT_KIND;
  readonly schemaVersion: typeof GRAPH_ROPE_SCHEMA_VERSION;
  readonly blobId: string;
  readonly encoding: typeof TEXT_BLOB_ENCODING_UTF8;
  readonly byteLength: number;
  readonly contentHash: string;
  readonly storage: TextBlobStorage;
}

export interface RopeRewriteFact {
  readonly kind: typeof ROPE_REWRITE_FACT_KIND;
  readonly schemaVersion: typeof GRAPH_ROPE_SCHEMA_VERSION;
  readonly rewriteId: string;
  readonly worldlineId: string;
  readonly basisHeadId: string;
  readonly nextHeadId: string;
  readonly admittedByTickId: string;
  readonly range: TextByteRange;
  readonly replacementBlobId: string;
  readonly diffId: string;
  readonly contentHash: string;
}

export interface RopeEqualDiffSpan {
  readonly kind: typeof ROPE_DIFF_SPAN_EQUAL_KIND;
  readonly basisRange: TextByteRange;
  readonly nextRange: TextByteRange;
  readonly contentHash: string;
}

export interface RopeDeleteDiffSpan {
  readonly kind: typeof ROPE_DIFF_SPAN_DELETE_KIND;
  readonly basisRange: TextByteRange;
  readonly contentHash: string;
}

export interface RopeInsertDiffSpan {
  readonly kind: typeof ROPE_DIFF_SPAN_INSERT_KIND;
  readonly nextRange: TextByteRange;
  readonly blobId: string;
  readonly contentHash: string;
}

export type RopeDiffSpan = RopeEqualDiffSpan | RopeDeleteDiffSpan | RopeInsertDiffSpan;

export interface RopeDiffFact {
  readonly kind: typeof ROPE_DIFF_FACT_KIND;
  readonly schemaVersion: typeof GRAPH_ROPE_SCHEMA_VERSION;
  readonly diffId: string;
  readonly rewriteId: string;
  readonly basisHeadId: string;
  readonly nextHeadId: string;
  readonly spans: readonly RopeDiffSpan[];
  readonly contentHash: string;
}

export interface TickReceiptFact {
  readonly kind: typeof TICK_RECEIPT_FACT_KIND;
  readonly schemaVersion: typeof GRAPH_ROPE_SCHEMA_VERSION;
  readonly tickId: string;
  readonly admissionId: string;
  readonly worldlineId: string;
  readonly basisHeadId: string;
  readonly nextHeadId: string;
  readonly rewriteId: string;
  readonly admittedAtSequence: number;
  readonly contentHash: string;
}

export type RopeStructuralMaintenanceOperation =
  | 'split-leaf'
  | 'merge-leaves'
  | 'rotate-left'
  | 'rotate-right'
  | 'rebalance-branch';

export interface RopeStructuralMaintenanceFact {
  readonly kind: typeof ROPE_STRUCTURAL_MAINTENANCE_FACT_KIND;
  readonly schemaVersion: typeof GRAPH_ROPE_SCHEMA_VERSION;
  readonly maintenanceId: string;
  readonly worldlineId: string;
  readonly rewriteId: string;
  readonly basisHeadId: string;
  readonly nextHeadId: string;
  readonly operation: RopeStructuralMaintenanceOperation;
  readonly affectedRange: TextByteRange;
  readonly replacedNodeIds: readonly string[];
  readonly replacementNodeIds: readonly string[];
  readonly contentHash: string;
}

export type RopeCheckpointReason =
  | typeof ROPE_CHECKPOINT_REASON_MANUAL_SAVE
  | typeof ROPE_CHECKPOINT_REASON_AUTOSAVE
  | typeof ROPE_CHECKPOINT_REASON_RETENTION_BOUNDARY
  | typeof ROPE_CHECKPOINT_REASON_EXPORT
  | typeof ROPE_CHECKPOINT_REASON_IMPORT
  | typeof ROPE_CHECKPOINT_REASON_TEST_FIXTURE;

export const ROPE_CHECKPOINT_REASON_MANUAL_SAVE = 'manual-save';
export const ROPE_CHECKPOINT_REASON_AUTOSAVE = 'autosave';
export const ROPE_CHECKPOINT_REASON_RETENTION_BOUNDARY = 'retention-boundary';
export const ROPE_CHECKPOINT_REASON_EXPORT = 'export';
export const ROPE_CHECKPOINT_REASON_IMPORT = 'import';
export const ROPE_CHECKPOINT_REASON_TEST_FIXTURE = 'test-fixture';

export interface RopeCheckpointFact {
  readonly kind: typeof ROPE_CHECKPOINT_FACT_KIND;
  readonly schemaVersion: typeof GRAPH_ROPE_SCHEMA_VERSION;
  readonly checkpointId: string;
  readonly worldlineId: string;
  readonly headId: string;
  readonly causalAnchorId: string;
  readonly reason: RopeCheckpointReason;
}

export type EchoCausalAnchorPurpose =
  | typeof ECHO_CAUSAL_ANCHOR_RETENTION_CLASS_RECOVERY
  | typeof ECHO_CAUSAL_ANCHOR_RETENTION_CLASS_RETENTION
  | typeof ECHO_CAUSAL_ANCHOR_RETENTION_CLASS_EXPORT
  | typeof ECHO_CAUSAL_ANCHOR_RETENTION_CLASS_USER_SAVE
  | typeof ECHO_CAUSAL_ANCHOR_RETENTION_CLASS_AUTOSAVE
  | typeof ECHO_CAUSAL_ANCHOR_RETENTION_CLASS_DEBUG
  | typeof ECHO_CAUSAL_ANCHOR_RETENTION_CLASS_CACHE_WARM;

export type EchoCausalAnchorRetentionClass = EchoCausalAnchorPurpose;

export interface EchoCausalAnchorRetentionMetadata {
  readonly retentionClass: EchoCausalAnchorRetentionClass;
}

export interface EchoCausalAnchorSubject {
  readonly appId: string;
  readonly subjectKind: string;
  readonly subjectId: string;
}

export interface EchoCausalAnchorCasObjectRoot {
  readonly kind: typeof ECHO_CAUSAL_ANCHOR_ROOT_KIND_CAS_OBJECT;
  readonly id: string;
  readonly role:
    | typeof ECHO_CAUSAL_ANCHOR_ROOT_ROLE_MATERIALIZATION
    | typeof ECHO_CAUSAL_ANCHOR_ROOT_ROLE_MANIFEST
    | typeof ECHO_CAUSAL_ANCHOR_ROOT_ROLE_INDEX;
}

export interface EchoCausalAnchorGraphFactRoot {
  readonly kind: typeof ECHO_CAUSAL_ANCHOR_ROOT_KIND_GRAPH_FACT;
  readonly id: string;
  readonly role:
    | typeof ECHO_CAUSAL_ANCHOR_ROOT_ROLE_AUTHORITY
    | typeof ECHO_CAUSAL_ANCHOR_ROOT_ROLE_EVIDENCE
    | typeof ECHO_CAUSAL_ANCHOR_ROOT_ROLE_INDEX;
}

export interface EchoCausalAnchorAppSubjectRoot {
  readonly kind: typeof ECHO_CAUSAL_ANCHOR_ROOT_KIND_APP_SUBJECT;
  readonly appId: string;
  readonly subjectKind: string;
  readonly id: string;
  readonly role:
    | typeof ECHO_CAUSAL_ANCHOR_ROOT_ROLE_AUTHORITY
    | typeof ECHO_CAUSAL_ANCHOR_ROOT_ROLE_EVIDENCE;
}

export type EchoCausalAnchorRoot =
  | EchoCausalAnchorCasObjectRoot
  | EchoCausalAnchorGraphFactRoot
  | EchoCausalAnchorAppSubjectRoot;

export interface EchoCausalAnchorFact {
  readonly kind: typeof ECHO_CAUSAL_ANCHOR_FACT_KIND;
  readonly schemaVersion: typeof GRAPH_ROPE_SCHEMA_VERSION;
  readonly anchorId: string;
  readonly subject: EchoCausalAnchorSubject;
  readonly basisFrontierDigest: string;
  readonly retainedRoots: readonly EchoCausalAnchorRoot[];
  readonly materializationRoots: readonly EchoCausalAnchorRoot[];
  readonly purpose: EchoCausalAnchorPurpose;
  readonly retention: EchoCausalAnchorRetentionMetadata;
  readonly admittedByReceiptId: string;
  readonly anchorDigest: string;
}

export interface EchoCausalAnchorAdmissionRequest {
  readonly subject: EchoCausalAnchorSubject;
  readonly basisFrontierDigest: string;
  readonly retainedRoots: readonly EchoCausalAnchorRoot[];
  readonly materializationRoots: readonly EchoCausalAnchorRoot[];
  readonly purpose: EchoCausalAnchorPurpose;
  readonly retention: EchoCausalAnchorRetentionMetadata;
}

export interface EchoCausalAnchorAdmissionRequestInput {
  readonly subject: EchoCausalAnchorSubject;
  readonly basisFrontierDigest: string;
  readonly retainedRoots: readonly EchoCausalAnchorRoot[];
  readonly materializationRoots?: readonly EchoCausalAnchorRoot[];
  readonly purpose: EchoCausalAnchorPurpose;
  readonly retention: EchoCausalAnchorRetentionMetadata;
}

export interface EchoCausalAnchorAdmissionReceipt {
  readonly authority: typeof ECHO_CAUSAL_ANCHOR_ADMISSION_AUTHORITY_ECHO;
  readonly receiptId: string;
  readonly anchorId: string;
}

export interface EchoCausalAnchorAdmissionResult {
  readonly anchor: EchoCausalAnchorFact;
  readonly receipt: EchoCausalAnchorAdmissionReceipt;
}

export interface EchoCausalAnchorAdmissionPort {
  admitCausalAnchor(request: EchoCausalAnchorAdmissionRequest): EchoCausalAnchorAdmissionResult;
}

export type RopeAdmittedFact =
  | BufferWorldlineFact
  | RopeHeadFact
  | RopeBranchFact
  | RopeLeafFact
  | TextBlobFact
  | RopeRewriteFact
  | RopeDiffFact
  | TickReceiptFact
  | RopeStructuralMaintenanceFact
  | RopeCheckpointFact
  | EchoCausalAnchorFact;

export interface RopeFactReadModel {
  getFact(id: string): RopeAdmittedFact | null;
}

export interface TextBlobStorePort {
  readBlobBytes(storage: StoredTextBlobStorage): Uint8Array | null;
}

export interface RopeFactValidationContext {
  readonly writeSet: readonly RopeAdmittedFact[];
  readonly admittedBasis: RopeFactReadModel;
  readonly blobStore: TextBlobStorePort;
  readonly hash: TextBlobHashPort;
}

export interface MakeTextBlobFactInput {
  readonly bytes: Uint8Array;
  readonly hash: TextBlobHashPort;
}

export interface MakeStoredTextBlobFactInput extends MakeTextBlobFactInput {
  readonly contentRef: string;
}

export type MakeTextBlobFactResult = FactValidationResult<TextBlobFact>;
