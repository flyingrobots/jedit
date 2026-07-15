import { ropeFactId } from './graph-rope-fact-id.js';
import {
  ropeCheckpointAnchorAssociationIdFor,
  ropeCheckpointIdFor,
} from './graph-rope-checkpoint-identity.js';
import {
  BUFFER_WORLDLINE_FACT_KIND,
  FACT_VALIDATION_ERROR_HASH_MISMATCH,
  FACT_VALIDATION_ERROR_INVALID_ID,
  FACT_VALIDATION_ERROR_INVALID_KIND,
  FACT_VALIDATION_ERROR_INVALID_REFERENCE,
  ROPE_CHECKPOINT_ANCHORED_FACT_KIND,
  ROPE_CHECKPOINT_FACT_KIND,
  ROPE_CHECKPOINT_REASONS,
  ROPE_HEAD_FACT_KIND,
  type FactValidationErrorCode,
  type FactValidationResult,
  type RopeAdmittedFact,
  type RopeCheckpointReason,
  type RopeFactValidationContext,
} from './graph-rope-types.js';

const MIN_ID_LENGTH = 1;
const STRING_TYPE = 'string';
const VALID_CHECKPOINT_REASONS = new Set<string>(ROPE_CHECKPOINT_REASONS);

export function validateRopeCheckpointFact(
  fact: RopeAdmittedFact,
  context: RopeFactValidationContext,
): FactValidationResult<RopeAdmittedFact> {
  if (fact.kind !== ROPE_CHECKPOINT_FACT_KIND) {
    return invalidFact(FACT_VALIDATION_ERROR_INVALID_KIND);
  }
  const idIssue = invalidIdIn([fact.checkpointId, fact.worldlineId, fact.headId, fact.reason]);
  if (idIssue !== null) {
    return invalidFact(idIssue);
  }
  if (!isRopeCheckpointReason(fact.reason)) {
    return invalidFact(FACT_VALIDATION_ERROR_INVALID_REFERENCE);
  }
  const worldline = resolveFactById(context, fact.worldlineId);
  const head = resolveFactById(context, fact.headId);
  if (worldline?.kind !== BUFFER_WORLDLINE_FACT_KIND
    || head?.kind !== ROPE_HEAD_FACT_KIND
    || head.worldlineId !== fact.worldlineId) {
    return invalidFact(FACT_VALIDATION_ERROR_INVALID_REFERENCE);
  }
  const expectedId = ropeCheckpointIdFor({
    worldlineId: fact.worldlineId,
    headId: fact.headId,
    reason: fact.reason,
    hash: context.hash,
  });
  return fact.checkpointId === expectedId
    ? validFact(fact)
    : invalidFact(FACT_VALIDATION_ERROR_HASH_MISMATCH);
}

export function isRopeCheckpointReason(reason: RopeCheckpointReason): boolean {
  return typeof reason === STRING_TYPE && VALID_CHECKPOINT_REASONS.has(reason);
}

export function validateRopeCheckpointAnchoredFact(
  fact: RopeAdmittedFact,
  context: RopeFactValidationContext,
): FactValidationResult<RopeAdmittedFact> {
  if (fact.kind !== ROPE_CHECKPOINT_ANCHORED_FACT_KIND) {
    return invalidFact(FACT_VALIDATION_ERROR_INVALID_KIND);
  }
  const idIssue = invalidIdIn([
    fact.associationId,
    fact.checkpointId,
    fact.causalAnchorId,
    fact.causalAnchorFactId,
    fact.causalAnchorReceiptId,
  ]);
  if (idIssue !== null) {
    return invalidFact(idIssue);
  }
  if (resolveFactById(context, fact.checkpointId)?.kind !== ROPE_CHECKPOINT_FACT_KIND) {
    return invalidFact(FACT_VALIDATION_ERROR_INVALID_REFERENCE);
  }
  const expectedId = ropeCheckpointAnchorAssociationIdFor({
    checkpointId: fact.checkpointId,
    causalAnchorId: fact.causalAnchorId,
    causalAnchorFactId: fact.causalAnchorFactId,
    causalAnchorReceiptId: fact.causalAnchorReceiptId,
    hash: context.hash,
  });
  return fact.associationId === expectedId
    ? validFact(fact)
    : invalidFact(FACT_VALIDATION_ERROR_HASH_MISMATCH);
}

function resolveFactById(
  context: RopeFactValidationContext,
  id: string,
): RopeAdmittedFact | null {
  for (const fact of context.writeSet) {
    if (ropeFactId(fact) === id) {
      return fact;
    }
  }
  return context.admittedBasis.getFact(id);
}

function invalidIdIn(ids: readonly string[]): FactValidationErrorCode | null {
  for (const id of ids) {
    if (typeof id !== STRING_TYPE || id.length < MIN_ID_LENGTH) {
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
