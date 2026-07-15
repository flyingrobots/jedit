import {
  FACT_VALIDATION_ERROR_INVALID_ID,
  FACT_VALIDATION_ERROR_INVALID_REFERENCE,
  ROPE_CHECKPOINT_MATERIALIZATION_ROLE_INDEX,
  ROPE_CHECKPOINT_MATERIALIZATION_ROLE_MANIFEST,
  ROPE_CHECKPOINT_MATERIALIZATION_ROLE_MATERIALIZATION,
  type FactValidationErrorCode,
  type RopeCheckpointAnchorAdmissionRequest,
  type RopeCheckpointMaterializationRoot,
} from './graph-rope-types.js';

const MIN_ID_LENGTH = 1;
const STRING_TYPE = 'string';
const VALID_MATERIALIZATION_ROLES = new Set<string>([
  ROPE_CHECKPOINT_MATERIALIZATION_ROLE_MATERIALIZATION,
  ROPE_CHECKPOINT_MATERIALIZATION_ROLE_MANIFEST,
  ROPE_CHECKPOINT_MATERIALIZATION_ROLE_INDEX,
]);

export function validateCheckpointAnchorAdmissionRequest(
  request: RopeCheckpointAnchorAdmissionRequest,
): FactValidationErrorCode | null {
  const idIssue = invalidIdIn([
    request.checkpointId,
    request.worldlineId,
    request.headId,
    request.reason,
  ]);
  if (idIssue !== null) {
    return idIssue;
  }
  return validateMaterializationRoots(request.materializationRoots);
}

function validateMaterializationRoots(
  roots: readonly RopeCheckpointMaterializationRoot[],
): FactValidationErrorCode | null {
  const seen = new Set<string>();
  for (const root of roots) {
    const issue = validateMaterializationRoot(root);
    if (issue !== null) {
      return issue;
    }
    const key = `${root.role}:${root.id}`;
    if (seen.has(key)) {
      return FACT_VALIDATION_ERROR_INVALID_REFERENCE;
    }
    seen.add(key);
  }
  return null;
}

function validateMaterializationRoot(
  root: RopeCheckpointMaterializationRoot | null | undefined,
): FactValidationErrorCode | null {
  if (root == null || !isNonEmptyString(root.id)) {
    return FACT_VALIDATION_ERROR_INVALID_ID;
  }
  return typeof root.role === STRING_TYPE && VALID_MATERIALIZATION_ROLES.has(root.role)
    ? null
    : FACT_VALIDATION_ERROR_INVALID_REFERENCE;
}

function invalidIdIn(ids: readonly string[]): FactValidationErrorCode | null {
  for (const id of ids) {
    if (!isNonEmptyString(id)) {
      return FACT_VALIDATION_ERROR_INVALID_ID;
    }
  }
  return null;
}

function isNonEmptyString(value: string): boolean {
  return typeof value === STRING_TYPE && value.length >= MIN_ID_LENGTH;
}
