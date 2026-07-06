import { ropeFactId } from './graph-rope-fact-id.js';
import {
  checkpointAnchorMatches,
  checkpointReferencesSameWorldline,
  validateEchoCausalAnchorFact,
} from './graph-rope-causal-anchor-validation.js';
import {
  validateDiffSpanHash,
  validateRopeBranchConsistency,
  validateRopeDiffConsistency,
  validateRopeHeadConsistency,
  validateRopeLeafConsistency,
  validateRopeRewriteConsistency,
  validateTickReceiptConsistency,
} from './graph-rope-consistency-validation.js';
import {
  validateTextBlobFact,
} from './graph-rope-text-blob-validation.js';
import {
  BUFFER_WORLDLINE_FACT_KIND,
  BYTE_OFFSET_COORDINATE_KIND,
  ECHO_CAUSAL_ANCHOR_FACT_KIND,
  FACT_VALIDATION_ERROR_INVALID_HASH,
  FACT_VALIDATION_ERROR_INVALID_ID,
  FACT_VALIDATION_ERROR_INVALID_KIND,
  FACT_VALIDATION_ERROR_INVALID_METRIC,
  FACT_VALIDATION_ERROR_INVALID_REFERENCE,
  FACT_VALIDATION_ERROR_INVALID_SCHEMA_VERSION,
  GRAPH_ROPE_SCHEMA_VERSION,
  ROPE_BRANCH_FACT_KIND,
  ROPE_CHECKPOINT_FACT_KIND,
  ROPE_DIFF_FACT_KIND,
  ROPE_DIFF_SPAN_DELETE_KIND,
  ROPE_DIFF_SPAN_EQUAL_KIND,
  ROPE_HEAD_FACT_KIND,
  ROPE_LEAF_FACT_KIND,
  ROPE_REWRITE_FACT_KIND,
  ROPE_STRUCTURAL_MAINTENANCE_FACT_KIND,
  TEXT_BLOB_FACT_KIND,
  TICK_RECEIPT_FACT_KIND,
  type FactValidationErrorCode,
  type FactValidationResult,
  type RopeAdmittedFact,
  type RopeDiffSpan,
  type RopeFactValidationContext,
  type TextByteRange,
} from './graph-rope-types.js';

const ZERO_VALUE = 0;
const MIN_ID_LENGTH = 1;

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
  const refResult = requireNodeReference(context, fact.rootNodeId)
    ?? optionalReference(context, fact.basisHeadId, ROPE_HEAD_FACT_KIND);
  if (refResult !== null) {
    return invalidFact(refResult);
  }
  const consistencyIssue = validateRopeHeadConsistency(fact, context);
  return consistencyIssue === null
    ? validateIds(fact, [fact.headId, fact.worldlineId, fact.createdByTickId, fact.rootNodeId])
    : invalidFact(consistencyIssue);
}

function validateRopeBranchFact(fact: RopeAdmittedFact, context: RopeFactValidationContext): FactValidationResult<RopeAdmittedFact> {
  if (fact.kind !== ROPE_BRANCH_FACT_KIND) {
    return invalidFact(FACT_VALIDATION_ERROR_INVALID_KIND);
  }
  if (hasInvalidMetric([fact.byteLength, fact.lineCount, fact.height]) || isInvalidHash(fact.contentHash)) {
    return invalidFact(FACT_VALIDATION_ERROR_INVALID_METRIC);
  }
  const refResult = requireNodeReference(context, fact.left) ?? requireNodeReference(context, fact.right);
  if (refResult !== null) {
    return invalidFact(refResult);
  }
  const consistencyIssue = validateRopeBranchConsistency(fact, context);
  return consistencyIssue === null
    ? validateIds(fact, [fact.nodeId, fact.left, fact.right])
    : invalidFact(consistencyIssue);
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
  const refResult = requireReference(context, fact.blobId, TEXT_BLOB_FACT_KIND);
  if (refResult !== null) {
    return invalidFact(refResult);
  }
  const consistencyIssue = validateRopeLeafConsistency(fact, context);
  return consistencyIssue === null
    ? validateIds(fact, [fact.nodeId, fact.blobId])
    : invalidFact(consistencyIssue);
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
  if (refResult !== null) {
    return invalidFact(refResult);
  }
  const idResult = invalidIdIn([fact.rewriteId, fact.worldlineId, fact.admittedByTickId]);
  if (idResult !== null) {
    return invalidFact(idResult);
  }
  const consistencyIssue = validateRopeRewriteConsistency(fact, context);
  return consistencyIssue === null ? validFact(fact) : invalidFact(consistencyIssue);
}

function validateRopeDiffFact(
  fact: RopeAdmittedFact,
  context: RopeFactValidationContext,
): FactValidationResult<RopeAdmittedFact> {
  if (fact.kind !== ROPE_DIFF_FACT_KIND) {
    return invalidFact(FACT_VALIDATION_ERROR_INVALID_KIND);
  }
  if (isInvalidHash(fact.contentHash)) {
    return invalidFact(FACT_VALIDATION_ERROR_INVALID_HASH);
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
  if (refResult !== null) {
    return invalidFact(refResult);
  }
  const idResult = invalidIdIn([fact.diffId]);
  if (idResult !== null) {
    return invalidFact(idResult);
  }
  const consistencyIssue = validateRopeDiffConsistency(fact, context);
  return consistencyIssue === null ? validFact(fact) : invalidFact(consistencyIssue);
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
  if (refResult !== null) {
    return invalidFact(refResult);
  }
  const idResult = invalidIdIn([fact.tickId, fact.admissionId, fact.worldlineId]);
  if (idResult !== null) {
    return invalidFact(idResult);
  }
  const consistencyIssue = validateTickReceiptConsistency(fact, context);
  return consistencyIssue === null ? validFact(fact) : invalidFact(consistencyIssue);
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

function optionalReference(
  context: RopeFactValidationContext,
  id: string | undefined,
  expectedKind: string,
): FactValidationErrorCode | null {
  return id === undefined ? null : requireReference(context, id, expectedKind);
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
    return validateEqualDiffSpan(span, context);
  }
  if (span.kind === ROPE_DIFF_SPAN_DELETE_KIND) {
    return validateDeleteDiffSpan(span, context);
  }
  return validateInsertDiffSpan(span, context);
}

type EqualDiffSpan = Extract<RopeDiffSpan, { readonly kind: typeof ROPE_DIFF_SPAN_EQUAL_KIND }>;
type DeleteDiffSpan = Extract<RopeDiffSpan, { readonly kind: typeof ROPE_DIFF_SPAN_DELETE_KIND }>;
type InsertDiffSpan = Exclude<RopeDiffSpan, EqualDiffSpan | DeleteDiffSpan>;

function validateEqualDiffSpan(
  span: EqualDiffSpan,
  context: RopeFactValidationContext,
): FactValidationErrorCode | null {
  return invalidRangeIssue(span.basisRange)
    ?? invalidRangeIssue(span.nextRange)
    ?? validateDiffSpanHash(span, context);
}

function validateDeleteDiffSpan(
  span: DeleteDiffSpan,
  context: RopeFactValidationContext,
): FactValidationErrorCode | null {
  return invalidRangeIssue(span.basisRange)
    ?? validateDiffSpanHash(span, context);
}

function validateInsertDiffSpan(
  span: InsertDiffSpan,
  context: RopeFactValidationContext,
): FactValidationErrorCode | null {
  return invalidRangeIssue(span.nextRange)
    ?? requireReference(context, span.blobId, TEXT_BLOB_FACT_KIND)
    ?? validateDiffSpanHash(span, context);
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
