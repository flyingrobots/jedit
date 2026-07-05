import { ropeFactId } from './graph-rope-fact-id.js';
import {
  checkpointAnchorMatches,
  checkpointReferencesSameWorldline,
  validateEchoCausalAnchorFact,
} from './graph-rope-causal-anchor-validation.js';
import {
  BUFFER_WORLDLINE_FACT_KIND,
  BYTE_OFFSET_COORDINATE_KIND,
  CONTENT_ADDRESSED_BLOB_STORE_KIND,
  ECHO_CAUSAL_ANCHOR_FACT_KIND,
  FACT_VALIDATION_ERROR_HASH_MISMATCH,
  FACT_VALIDATION_ERROR_INVALID_HASH,
  FACT_VALIDATION_ERROR_INVALID_ID,
  FACT_VALIDATION_ERROR_INVALID_KIND,
  FACT_VALIDATION_ERROR_INVALID_METRIC,
  FACT_VALIDATION_ERROR_INVALID_REFERENCE,
  FACT_VALIDATION_ERROR_INVALID_SCHEMA_VERSION,
  FACT_VALIDATION_ERROR_INVALID_UTF8,
  GRAPH_ROPE_SCHEMA_VERSION,
  INLINE_UTF8_BYTES_STORAGE_KIND,
  ROPE_BRANCH_FACT_KIND,
  ROPE_CHECKPOINT_FACT_KIND,
  ROPE_DIFF_FACT_KIND,
  ROPE_DIFF_SPAN_DELETE_KIND,
  ROPE_DIFF_SPAN_EQUAL_KIND,
  ROPE_HEAD_FACT_KIND,
  ROPE_LEAF_FACT_KIND,
  ROPE_REWRITE_FACT_KIND,
  ROPE_STRUCTURAL_MAINTENANCE_FACT_KIND,
  TEXT_BLOB_ENCODING_UTF8,
  TEXT_BLOB_FACT_KIND,
  TEXT_BLOB_STORE_ID,
  TICK_RECEIPT_FACT_KIND,
  type FactValidationErrorCode,
  type FactValidationResult,
  type InlineTextBlobStorage,
  type MakeStoredTextBlobFactInput,
  type MakeTextBlobFactInput,
  type MakeTextBlobFactResult,
  type RopeAdmittedFact,
  type RopeDiffSpan,
  type RopeFactValidationContext,
  type StoredTextBlobStorage,
  type TextBlobFact,
  type TextBlobHashPort,
  type TextBlobStorage,
  type TextByteRange,
} from './graph-rope-types.js';

const ZERO_VALUE = 0;
const MIN_ID_LENGTH = 1;
const HEX_RADIX = 16;
const HEX_BYTE_WIDTH = 2;
const GRAPH_ROPE_HASH_MATERIAL_PREFIX = 'utf8:';
const TEXT_BLOB_ID_PREFIX = 'text-blob:';
const TEXT_DECODER = new TextDecoder('utf-8', { fatal: true });

type RopeFactValidator = (
  fact: RopeAdmittedFact,
  context: RopeFactValidationContext,
) => FactValidationResult<RopeAdmittedFact>;

const ROPE_FACT_VALIDATORS: ReadonlyMap<string, RopeFactValidator> = new Map([
  [BUFFER_WORLDLINE_FACT_KIND, validateBufferWorldlineFact],
  [ROPE_HEAD_FACT_KIND, validateRopeHeadFact],
  [ROPE_BRANCH_FACT_KIND, validateRopeBranchFact],
  [ROPE_LEAF_FACT_KIND, validateRopeLeafFact],
  [TEXT_BLOB_FACT_KIND, validateTextBlobFact],
  [ROPE_REWRITE_FACT_KIND, validateRopeRewriteFact],
  [ROPE_DIFF_FACT_KIND, validateRopeDiffFact],
  [TICK_RECEIPT_FACT_KIND, validateTickReceiptFact],
  [ROPE_STRUCTURAL_MAINTENANCE_FACT_KIND, validateStructuralMaintenanceFact],
  [ROPE_CHECKPOINT_FACT_KIND, validateRopeCheckpointFact],
  [ECHO_CAUSAL_ANCHOR_FACT_KIND, validateEchoCausalAnchorFact],
]);

export function makeTextBlobFact(input: MakeTextBlobFactInput): MakeTextBlobFactResult {
  if (!isValidUtf8(input.bytes)) {
    return invalidFact(FACT_VALIDATION_ERROR_INVALID_UTF8);
  }
  return validFact(textBlobFactForBytes(input.bytes, inlineStorageForBytes(input.bytes), input.hash));
}

export function makeStoredTextBlobFact(input: MakeStoredTextBlobFactInput): MakeTextBlobFactResult {
  if (input.contentRef.length < MIN_ID_LENGTH) {
    return invalidFact(FACT_VALIDATION_ERROR_INVALID_ID);
  }
  if (!isValidUtf8(input.bytes)) {
    return invalidFact(FACT_VALIDATION_ERROR_INVALID_UTF8);
  }
  return validFact(textBlobFactForBytes(input.bytes, storedStorageForRef(input.contentRef), input.hash));
}

export function validateRopeFact(
  fact: RopeAdmittedFact,
  context: RopeFactValidationContext,
): FactValidationResult<RopeAdmittedFact> {
  if (fact.schemaVersion !== GRAPH_ROPE_SCHEMA_VERSION) {
    return invalidFact(FACT_VALIDATION_ERROR_INVALID_SCHEMA_VERSION);
  }

  const validator = ROPE_FACT_VALIDATORS.get(fact.kind);
  if (validator === undefined) {
    return invalidFact(FACT_VALIDATION_ERROR_INVALID_KIND);
  }

  return validator(fact, context);
}

function validateBufferWorldlineFact(fact: RopeAdmittedFact, context: RopeFactValidationContext): FactValidationResult<RopeAdmittedFact> {
  if (fact.kind !== BUFFER_WORLDLINE_FACT_KIND) {
    return invalidFact(FACT_VALIDATION_ERROR_INVALID_KIND);
  }
  return validateIdsAndReference(
    fact,
    [fact.worldlineId, fact.createdAtTick],
    context,
    fact.initialHeadId,
    ROPE_HEAD_FACT_KIND,
  );
}

function validateRopeHeadFact(fact: RopeAdmittedFact, context: RopeFactValidationContext): FactValidationResult<RopeAdmittedFact> {
  if (fact.kind !== ROPE_HEAD_FACT_KIND) {
    return invalidFact(FACT_VALIDATION_ERROR_INVALID_KIND);
  }
  if (hasInvalidMetric([fact.byteLength, fact.lineCount]) || isInvalidHash(fact.contentHash)) {
    return invalidFact(FACT_VALIDATION_ERROR_INVALID_METRIC);
  }
  return validateIdsAndNodeReference(fact, [fact.headId, fact.worldlineId, fact.createdByTickId], context, fact.rootNodeId);
}

function validateRopeBranchFact(fact: RopeAdmittedFact, context: RopeFactValidationContext): FactValidationResult<RopeAdmittedFact> {
  if (fact.kind !== ROPE_BRANCH_FACT_KIND) {
    return invalidFact(FACT_VALIDATION_ERROR_INVALID_KIND);
  }
  if (hasInvalidMetric([fact.byteLength, fact.lineCount, fact.height]) || isInvalidHash(fact.contentHash)) {
    return invalidFact(FACT_VALIDATION_ERROR_INVALID_METRIC);
  }
  const leftResult = requireNodeReference(context, fact.left);
  if (leftResult !== null) {
    return invalidFact(leftResult);
  }
  return validateIdsAndNodeReference(fact, [fact.nodeId], context, fact.right);
}

function validateRopeLeafFact(
  fact: RopeAdmittedFact,
  context: RopeFactValidationContext,
): FactValidationResult<RopeAdmittedFact> {
  if (fact.kind !== ROPE_LEAF_FACT_KIND) {
    return invalidFact(FACT_VALIDATION_ERROR_INVALID_KIND);
  }
  if (hasInvalidMetric([fact.byteStart.value, fact.byteLength, fact.lineCount]) || isInvalidHash(fact.contentHash)) {
    return invalidFact(FACT_VALIDATION_ERROR_INVALID_METRIC);
  }
  return validateIdsAndReference(fact, [fact.nodeId], context, fact.blobId, TEXT_BLOB_FACT_KIND);
}

function validateTextBlobFact(
  fact: RopeAdmittedFact,
  context: RopeFactValidationContext,
): FactValidationResult<RopeAdmittedFact> {
  if (fact.kind !== TEXT_BLOB_FACT_KIND) {
    return invalidFact(FACT_VALIDATION_ERROR_INVALID_KIND);
  }
  const bytes = textBlobBytes(fact, context);
  if (bytes === null) {
    return invalidFact(FACT_VALIDATION_ERROR_INVALID_REFERENCE);
  }
  return validateTextBlobBytes(fact, bytes, context.hash);
}

function validateRopeRewriteFact(
  fact: RopeAdmittedFact,
  context: RopeFactValidationContext,
): FactValidationResult<RopeAdmittedFact> {
  if (fact.kind !== ROPE_REWRITE_FACT_KIND) {
    return invalidFact(FACT_VALIDATION_ERROR_INVALID_KIND);
  }
  if (!isValidTextByteRange(fact.range) || isInvalidHash(fact.contentHash)) {
    return invalidFact(FACT_VALIDATION_ERROR_INVALID_METRIC);
  }
  const refResult = requireReferences(context, [
    [fact.basisHeadId, ROPE_HEAD_FACT_KIND],
    [fact.nextHeadId, ROPE_HEAD_FACT_KIND],
    [fact.replacementBlobId, TEXT_BLOB_FACT_KIND],
    [fact.diffId, ROPE_DIFF_FACT_KIND],
  ]);
  return validateIdsAfterReferences(refResult, fact, [fact.rewriteId, fact.worldlineId, fact.admittedByTickId]);
}

function validateRopeDiffFact(
  fact: RopeAdmittedFact,
  context: RopeFactValidationContext,
): FactValidationResult<RopeAdmittedFact> {
  if (fact.kind !== ROPE_DIFF_FACT_KIND) {
    return invalidFact(FACT_VALIDATION_ERROR_INVALID_KIND);
  }
  const spanResult = validateDiffSpans(fact.spans, context);
  if (spanResult !== null) {
    return invalidFact(spanResult);
  }
  const refResult = requireReferences(context, [
    [fact.rewriteId, ROPE_REWRITE_FACT_KIND],
    [fact.basisHeadId, ROPE_HEAD_FACT_KIND],
    [fact.nextHeadId, ROPE_HEAD_FACT_KIND],
  ]);
  return validateIdsAfterReferences(refResult, fact, [fact.diffId]);
}

function validateTickReceiptFact(
  fact: RopeAdmittedFact,
  context: RopeFactValidationContext,
): FactValidationResult<RopeAdmittedFact> {
  if (fact.kind !== TICK_RECEIPT_FACT_KIND) {
    return invalidFact(FACT_VALIDATION_ERROR_INVALID_KIND);
  }
  if (hasInvalidMetric([fact.admittedAtSequence]) || isInvalidHash(fact.contentHash)) {
    return invalidFact(FACT_VALIDATION_ERROR_INVALID_METRIC);
  }
  const refResult = requireReferences(context, [
    [fact.basisHeadId, ROPE_HEAD_FACT_KIND],
    [fact.nextHeadId, ROPE_HEAD_FACT_KIND],
    [fact.rewriteId, ROPE_REWRITE_FACT_KIND],
  ]);
  return validateIdsAfterReferences(refResult, fact, [fact.tickId, fact.admissionId, fact.worldlineId]);
}

function validateStructuralMaintenanceFact(
  fact: RopeAdmittedFact,
  context: RopeFactValidationContext,
): FactValidationResult<RopeAdmittedFact> {
  if (fact.kind !== ROPE_STRUCTURAL_MAINTENANCE_FACT_KIND) {
    return invalidFact(FACT_VALIDATION_ERROR_INVALID_KIND);
  }
  if (!isValidTextByteRange(fact.affectedRange) || isInvalidHash(fact.contentHash)) {
    return invalidFact(FACT_VALIDATION_ERROR_INVALID_METRIC);
  }
  const refResult = requireReferences(context, [
    [fact.rewriteId, ROPE_REWRITE_FACT_KIND],
    [fact.basisHeadId, ROPE_HEAD_FACT_KIND],
    [fact.nextHeadId, ROPE_HEAD_FACT_KIND],
  ]);
  const ids = [fact.maintenanceId, fact.worldlineId, ...fact.replacedNodeIds, ...fact.replacementNodeIds];
  return validateIdsAfterReferences(refResult, fact, ids);
}

function validateRopeCheckpointFact(
  fact: RopeAdmittedFact,
  context: RopeFactValidationContext,
): FactValidationResult<RopeAdmittedFact> {
  if (fact.kind !== ROPE_CHECKPOINT_FACT_KIND) {
    return invalidFact(FACT_VALIDATION_ERROR_INVALID_KIND);
  }
  const refResult = requireReferences(context, [
    [fact.worldlineId, BUFFER_WORLDLINE_FACT_KIND],
    [fact.headId, ROPE_HEAD_FACT_KIND],
    [fact.causalAnchorId, ECHO_CAUSAL_ANCHOR_FACT_KIND],
  ]);
  if (refResult !== null) {
    return invalidFact(refResult);
  }
  const head = resolveFactById(context, fact.headId);
  const anchor = resolveFactById(context, fact.causalAnchorId);
  if (!checkpointReferencesSameWorldline(fact, head) || !checkpointAnchorMatches(fact, anchor)) {
    return invalidFact(FACT_VALIDATION_ERROR_INVALID_REFERENCE);
  }
  return validateIds(fact, [fact.checkpointId]);
}

function validateTextBlobBytes(
  fact: TextBlobFact,
  bytes: Uint8Array,
  hash: TextBlobHashPort,
): FactValidationResult<RopeAdmittedFact> {
  if (fact.encoding !== TEXT_BLOB_ENCODING_UTF8 || !isValidUtf8(bytes)) {
    return invalidFact(FACT_VALIDATION_ERROR_INVALID_UTF8);
  }
  if (fact.byteLength !== bytes.length || fact.blobId.length < MIN_ID_LENGTH) {
    return invalidFact(FACT_VALIDATION_ERROR_INVALID_METRIC);
  }
  const expectedHash = contentHashForBytes(hash, bytes);
  if (fact.contentHash !== expectedHash || fact.blobId !== textBlobIdForHash(expectedHash)) {
    return invalidFact(FACT_VALIDATION_ERROR_HASH_MISMATCH);
  }
  return validFact(fact);
}

function validateDiffSpans(
  spans: readonly RopeDiffSpan[],
  context: RopeFactValidationContext,
): FactValidationErrorCode | null {
  for (const span of spans) {
    const issue = validateDiffSpan(span, context);
    if (issue !== null) {
      return issue;
    }
  }
  return null;
}

function validateDiffSpan(span: RopeDiffSpan, context: RopeFactValidationContext): FactValidationErrorCode | null {
  if (isInvalidHash(span.contentHash)) {
    return FACT_VALIDATION_ERROR_INVALID_HASH;
  }
  if (span.kind === ROPE_DIFF_SPAN_EQUAL_KIND) {
    return invalidRangeIssue(span.basisRange) ?? invalidRangeIssue(span.nextRange);
  }
  if (span.kind === ROPE_DIFF_SPAN_DELETE_KIND) {
    return invalidRangeIssue(span.basisRange);
  }
  return invalidRangeIssue(span.nextRange) ?? requireReference(context, span.blobId, TEXT_BLOB_FACT_KIND);
}

function validateIdsAndReference(
  fact: RopeAdmittedFact,
  ids: readonly string[],
  context: RopeFactValidationContext,
  referenceId: string,
  referenceKind: string,
): FactValidationResult<RopeAdmittedFact> {
  const idResult = invalidIdIn([...ids, referenceId]);
  if (idResult !== null) {
    return invalidFact(idResult);
  }
  const refResult = requireReference(context, referenceId, referenceKind);
  return refResult === null ? validFact(fact) : invalidFact(refResult);
}

function validateIdsAndNodeReference(
  fact: RopeAdmittedFact,
  ids: readonly string[],
  context: RopeFactValidationContext,
  nodeId: string,
): FactValidationResult<RopeAdmittedFact> {
  const idResult = invalidIdIn([...ids, nodeId]);
  if (idResult !== null) {
    return invalidFact(idResult);
  }
  const refResult = requireNodeReference(context, nodeId);
  return refResult === null ? validFact(fact) : invalidFact(refResult);
}

function validateIdsAfterReferences(
  refResult: FactValidationErrorCode | null,
  fact: RopeAdmittedFact,
  ids: readonly string[],
): FactValidationResult<RopeAdmittedFact> {
  if (refResult !== null) {
    return invalidFact(refResult);
  }
  return validateIds(fact, ids);
}

function validateIds(fact: RopeAdmittedFact, ids: readonly string[]): FactValidationResult<RopeAdmittedFact> {
  const idResult = invalidIdIn(ids);
  return idResult === null ? validFact(fact) : invalidFact(idResult);
}

function requireReferences(
  context: RopeFactValidationContext,
  references: readonly (readonly [string, string])[],
): FactValidationErrorCode | null {
  for (const reference of references) {
    const result = requireReference(context, reference[ZERO_VALUE], reference[1]);
    if (result !== null) {
      return result;
    }
  }
  return null;
}

function requireReference(
  context: RopeFactValidationContext,
  id: string,
  expectedKind: string,
): FactValidationErrorCode | null {
  const fact = resolveFactById(context, id);
  if (fact === null || fact.kind !== expectedKind) {
    return FACT_VALIDATION_ERROR_INVALID_REFERENCE;
  }
  return null;
}

function requireNodeReference(context: RopeFactValidationContext, id: string): FactValidationErrorCode | null {
  const fact = resolveFactById(context, id);
  if (fact === null) {
    return FACT_VALIDATION_ERROR_INVALID_REFERENCE;
  }
  if (fact.kind !== ROPE_BRANCH_FACT_KIND && fact.kind !== ROPE_LEAF_FACT_KIND) {
    return FACT_VALIDATION_ERROR_INVALID_REFERENCE;
  }
  return null;
}

function resolveFactById(context: RopeFactValidationContext, id: string): RopeAdmittedFact | null {
  for (const fact of context.writeSet) {
    if (ropeFactId(fact) === id) {
      return fact;
    }
  }
  return context.admittedBasis.getFact(id);
}

function textBlobBytes(fact: TextBlobFact, context: RopeFactValidationContext): Uint8Array | null {
  if (fact.storage.kind === INLINE_UTF8_BYTES_STORAGE_KIND) {
    return fact.storage.bytes;
  }
  return context.blobStore.readBlobBytes(fact.storage);
}

function textBlobFactForBytes(
  bytes: Uint8Array,
  storage: TextBlobStorage,
  hash: TextBlobHashPort,
): TextBlobFact {
  const contentHash = contentHashForBytes(hash, bytes);
  return {
    kind: TEXT_BLOB_FACT_KIND,
    schemaVersion: GRAPH_ROPE_SCHEMA_VERSION,
    blobId: textBlobIdForHash(contentHash),
    encoding: TEXT_BLOB_ENCODING_UTF8,
    byteLength: bytes.length,
    contentHash,
    storage,
  };
}

function inlineStorageForBytes(bytes: Uint8Array): InlineTextBlobStorage {
  return {
    kind: INLINE_UTF8_BYTES_STORAGE_KIND,
    bytes: bytes.slice(),
  };
}

function storedStorageForRef(contentRef: string): StoredTextBlobStorage {
  return {
    kind: CONTENT_ADDRESSED_BLOB_STORE_KIND,
    storeId: TEXT_BLOB_STORE_ID,
    contentRef,
  };
}

function contentHashForBytes(hash: TextBlobHashPort, bytes: Uint8Array): string {
  return hash.sha256Hex(`${GRAPH_ROPE_HASH_MATERIAL_PREFIX}${bytesToHex(bytes)}`);
}

function textBlobIdForHash(contentHash: string): string { return `${TEXT_BLOB_ID_PREFIX}${contentHash}`; }

function bytesToHex(bytes: Uint8Array): string { return Array.from(bytes, byteToHex).join(''); }

function byteToHex(byte: number): string { return byte.toString(HEX_RADIX).padStart(HEX_BYTE_WIDTH, '0'); }

function isValidUtf8(bytes: Uint8Array): boolean {
  try {
    TEXT_DECODER.decode(bytes);
    return true;
  } catch {
    return false;
  }
}

function hasInvalidMetric(metrics: readonly number[]): boolean { return metrics.some((metric) => !isNonNegativeInteger(metric)); }

function isNonNegativeInteger(value: number): boolean { return Number.isInteger(value) && value >= ZERO_VALUE; }

function isInvalidHash(contentHash: string): boolean { return contentHash.length < MIN_ID_LENGTH; }

function invalidRangeIssue(range: TextByteRange): FactValidationErrorCode | null {
  return isValidTextByteRange(range) ? null : FACT_VALIDATION_ERROR_INVALID_METRIC;
}

function isValidTextByteRange(range: TextByteRange): boolean {
  return range.startByte.kind === BYTE_OFFSET_COORDINATE_KIND
    && range.endByte.kind === BYTE_OFFSET_COORDINATE_KIND
    && range.startByte.value <= range.endByte.value;
}

function invalidIdIn(ids: readonly string[]): FactValidationErrorCode | null {
  for (const id of ids) {
    if (id.length < MIN_ID_LENGTH) {
      return FACT_VALIDATION_ERROR_INVALID_ID;
    }
  }
  return null;
}

function validFact<TFact>(fact: TFact): FactValidationResult<TFact> {
  return { ok: true, fact };
}

function invalidFact<TFact>(code: FactValidationErrorCode): FactValidationResult<TFact> {
  return { ok: false, code };
}
