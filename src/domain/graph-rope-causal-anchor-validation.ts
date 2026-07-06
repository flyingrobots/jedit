import {
  ECHO_CAUSAL_ANCHOR_FACT_KIND,
  ECHO_CAUSAL_ANCHOR_ROOT_KIND_APP_SUBJECT,
  ECHO_CAUSAL_ANCHOR_ROOT_KIND_CAS_OBJECT,
  ECHO_CAUSAL_ANCHOR_ROOT_KIND_GRAPH_FACT,
  ECHO_CAUSAL_ANCHOR_ROOT_ROLE_AUTHORITY,
  ECHO_CAUSAL_ANCHOR_ROOT_ROLE_EVIDENCE,
  ECHO_CAUSAL_ANCHOR_ROOT_ROLE_INDEX,
  ECHO_CAUSAL_ANCHOR_ROOT_ROLE_MANIFEST,
  ECHO_CAUSAL_ANCHOR_ROOT_ROLE_MATERIALIZATION,
  FACT_VALIDATION_ERROR_INVALID_HASH,
  FACT_VALIDATION_ERROR_INVALID_ID,
  FACT_VALIDATION_ERROR_INVALID_KIND,
  FACT_VALIDATION_ERROR_INVALID_REFERENCE,
  FACT_VALIDATION_ERROR_HASH_MISMATCH,
  JEDIT_CAUSAL_ANCHOR_APP_ID,
  JEDIT_CAUSAL_ANCHOR_SUBJECT_KIND_BUFFER_WORLDLINE,
  JEDIT_CAUSAL_ANCHOR_SUBJECT_KIND_ROPE_HEAD,
  ROPE_HEAD_FACT_KIND,
  type EchoCausalAnchorFact,
  type EchoCausalAnchorRoot,
  type FactValidationErrorCode,
  type FactValidationResult,
  type RopeAdmittedFact,
  type RopeCheckpointFact,
  type RopeFactValidationContext,
  type RopeHeadFact,
} from './graph-rope-types.js';
import {
  causalAnchorDigestFor,
  causalAnchorIdForDigest,
} from './graph-rope-causal-anchor-digest.js';
import {
  basisFrontierDigestForRopeHead,
  checkpointAnchorRetentionClass,
  checkpointAnchorPurpose,
} from './graph-rope-checkpoint-identity.js';

const MIN_ID_LENGTH = 1;
const VALID_ANCHOR_PURPOSES = new Set<string>([
  'recovery',
  'retention',
  'export',
  'user-save',
  'autosave',
  'debug',
  'cache-warm',
]);
const CAS_MATERIALIZATION_ROOT_ROLES = new Set<string>([
  ECHO_CAUSAL_ANCHOR_ROOT_ROLE_MATERIALIZATION,
  ECHO_CAUSAL_ANCHOR_ROOT_ROLE_MANIFEST,
  ECHO_CAUSAL_ANCHOR_ROOT_ROLE_INDEX,
]);
const GRAPH_ROOT_ROLES = new Set<string>([
  ECHO_CAUSAL_ANCHOR_ROOT_ROLE_AUTHORITY,
  ECHO_CAUSAL_ANCHOR_ROOT_ROLE_EVIDENCE,
  ECHO_CAUSAL_ANCHOR_ROOT_ROLE_INDEX,
]);
const APP_SUBJECT_ROOT_ROLES = new Set<string>([
  ECHO_CAUSAL_ANCHOR_ROOT_ROLE_AUTHORITY,
  ECHO_CAUSAL_ANCHOR_ROOT_ROLE_EVIDENCE,
]);

export function validateEchoCausalAnchorFact(
  fact: RopeAdmittedFact,
  context: RopeFactValidationContext,
): FactValidationResult<RopeAdmittedFact> {
  if (fact.kind !== ECHO_CAUSAL_ANCHOR_FACT_KIND) {
    return invalidFact(FACT_VALIDATION_ERROR_INVALID_KIND);
  }
  if (isInvalidHash(fact.anchorDigest)) {
    return invalidFact(FACT_VALIDATION_ERROR_INVALID_HASH);
  }
  if (!VALID_ANCHOR_PURPOSES.has(fact.purpose)) {
    return invalidFact(FACT_VALIDATION_ERROR_INVALID_REFERENCE);
  }
  if (fact.retention == null || !VALID_ANCHOR_PURPOSES.has(fact.retention.retentionClass)) {
    return invalidFact(FACT_VALIDATION_ERROR_INVALID_REFERENCE);
  }
  const idResult = invalidIdIn([
    fact.anchorId,
    fact.subject.appId,
    fact.subject.subjectKind,
    fact.subject.subjectId,
    fact.basisFrontierDigest,
    fact.retention.retentionClass,
    fact.admittedByReceiptId,
  ]);
  if (idResult !== null) {
    return invalidFact(idResult);
  }
  const rootIssue = validateAnchorRootSets(fact.retainedRoots, fact.materializationRoots);
  if (rootIssue !== null) {
    return invalidFact(rootIssue);
  }
  if (fact.anchorDigest !== causalAnchorDigestFor(fact, context.hash)) {
    return invalidFact(FACT_VALIDATION_ERROR_HASH_MISMATCH);
  }
  if (fact.anchorId !== causalAnchorIdForDigest(fact.anchorDigest, context.hash)) {
    return invalidFact(FACT_VALIDATION_ERROR_HASH_MISMATCH);
  }
  return validFact(fact);
}

export function checkpointReferencesSameWorldline(
  fact: RopeCheckpointFact,
  head: RopeAdmittedFact | null,
): boolean {
  return isRopeHeadFact(head) && head.worldlineId === fact.worldlineId;
}

export function checkpointAnchorMatches(
  fact: RopeCheckpointFact,
  head: RopeAdmittedFact | null,
  anchor: RopeAdmittedFact | null,
  context: RopeFactValidationContext,
): boolean {
  if (!isRopeHeadFact(head) || !isEchoCausalAnchorFact(anchor)) {
    return false;
  }
  return anchor.subject.appId === JEDIT_CAUSAL_ANCHOR_APP_ID
    && anchor.subject.subjectKind === JEDIT_CAUSAL_ANCHOR_SUBJECT_KIND_BUFFER_WORLDLINE
    && anchor.subject.subjectId === fact.worldlineId
    && anchor.basisFrontierDigest === basisFrontierDigestForRopeHead(head, context.hash)
    && anchor.purpose === checkpointAnchorPurpose(fact.reason)
    && anchor.retention.retentionClass === checkpointAnchorRetentionClass(fact.reason)
    && anchor.retainedRoots.some((root) => isJeditRopeHeadAuthorityRoot(root, fact.headId));
}

function validateAnchorRootSets(
  retainedRoots: readonly EchoCausalAnchorRoot[],
  materializationRoots: readonly EchoCausalAnchorRoot[],
): FactValidationErrorCode | null {
  if (retainedRoots.length < MIN_ID_LENGTH) {
    return FACT_VALIDATION_ERROR_INVALID_REFERENCE;
  }
  return validateRetainedAnchorRootSet(retainedRoots) ?? validateMaterializationAnchorRootSet(materializationRoots);
}

function validateRetainedAnchorRootSet(roots: readonly EchoCausalAnchorRoot[]): FactValidationErrorCode | null {
  return validateAnchorRootSet(roots, anchorRootIsUsableRetainedRoot);
}

function validateMaterializationAnchorRootSet(roots: readonly EchoCausalAnchorRoot[]): FactValidationErrorCode | null {
  return validateAnchorRootSet(roots, anchorRootIsUsableMaterializationRoot);
}

function validateAnchorRootSet(
  roots: readonly EchoCausalAnchorRoot[],
  rootPolicy: (root: EchoCausalAnchorRoot) => boolean,
): FactValidationErrorCode | null {
  const seen = new Set<string>();
  for (const root of roots) {
    const rootIssue = validateAnchorRoot(root);
    if (rootIssue !== null || !rootPolicy(root)) {
      return rootIssue ?? FACT_VALIDATION_ERROR_INVALID_REFERENCE;
    }
    const key = stableAnchorRootKey(root);
    if (seen.has(key)) {
      return FACT_VALIDATION_ERROR_INVALID_REFERENCE;
    }
    seen.add(key);
  }
  return null;
}

function validateAnchorRoot(root: EchoCausalAnchorRoot): FactValidationErrorCode | null {
  if (root.kind === ECHO_CAUSAL_ANCHOR_ROOT_KIND_CAS_OBJECT) {
    return invalidIdIn([root.id]) ?? invalidRole(root.role, CAS_MATERIALIZATION_ROOT_ROLES);
  }
  if (root.kind === ECHO_CAUSAL_ANCHOR_ROOT_KIND_GRAPH_FACT) {
    return invalidIdIn([root.id]) ?? invalidRole(root.role, GRAPH_ROOT_ROLES);
  }
  if (root.kind === ECHO_CAUSAL_ANCHOR_ROOT_KIND_APP_SUBJECT) {
    return invalidIdIn([root.appId, root.subjectKind, root.id]) ?? invalidRole(root.role, APP_SUBJECT_ROOT_ROLES);
  }
  return FACT_VALIDATION_ERROR_INVALID_KIND;
}

function anchorRootIsUsableRetainedRoot(_root: EchoCausalAnchorRoot): boolean {
  return true;
}

function anchorRootIsUsableMaterializationRoot(root: EchoCausalAnchorRoot): boolean {
  return !anchorRootIsAuthority(root);
}

function invalidRole(role: string, allowedRoles: ReadonlySet<string>): FactValidationErrorCode | null {
  return allowedRoles.has(role) ? null : FACT_VALIDATION_ERROR_INVALID_REFERENCE;
}

function anchorRootIsAuthority(root: EchoCausalAnchorRoot): boolean {
  return root.kind !== ECHO_CAUSAL_ANCHOR_ROOT_KIND_CAS_OBJECT && root.role === ECHO_CAUSAL_ANCHOR_ROOT_ROLE_AUTHORITY;
}

function stableAnchorRootKey(root: EchoCausalAnchorRoot): string {
  return JSON.stringify(root, Object.keys(root).sort());
}

function isJeditRopeHeadAuthorityRoot(root: EchoCausalAnchorRoot, headId: string): boolean {
  return root.kind === ECHO_CAUSAL_ANCHOR_ROOT_KIND_APP_SUBJECT
    && root.appId === JEDIT_CAUSAL_ANCHOR_APP_ID
    && root.subjectKind === JEDIT_CAUSAL_ANCHOR_SUBJECT_KIND_ROPE_HEAD
    && root.id === headId
    && root.role === ECHO_CAUSAL_ANCHOR_ROOT_ROLE_AUTHORITY;
}

function isRopeHeadFact(fact: RopeAdmittedFact | null): fact is RopeHeadFact {
  return fact?.kind === ROPE_HEAD_FACT_KIND;
}

function isEchoCausalAnchorFact(fact: RopeAdmittedFact | null): fact is EchoCausalAnchorFact {
  return fact?.kind === ECHO_CAUSAL_ANCHOR_FACT_KIND;
}

function invalidIdIn(ids: readonly string[]): FactValidationErrorCode | null {
  for (const id of ids) {
    if (id.length < MIN_ID_LENGTH) {
      return FACT_VALIDATION_ERROR_INVALID_ID;
    }
  }
  return null;
}

function isInvalidHash(contentHash: string): boolean {
  return contentHash.length < MIN_ID_LENGTH;
}

function validFact<TFact>(fact: TFact): FactValidationResult<TFact> {
  return { ok: true, fact };
}

function invalidFact<TFact>(code: FactValidationErrorCode): FactValidationResult<TFact> {
  return { ok: false, code };
}
