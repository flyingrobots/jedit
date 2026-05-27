import type { HashPort } from '../ports/hash.js';
import {
  JEDIT_EDIT_IDEMPOTENCY_KEY_PREFIX,
  JEDIT_EDIT_SUBMISSION_ID_PREFIX,
  type JeditEditSubmissionIdentity,
  type JeditEditSubmissionIdentityInput,
} from '../ports/jedit-edit-submission-identity.js';

const IDENTITY_VERSION = 'jedit-edit-submission-identity:v1';

export function createJeditEditSubmissionIdentity(
  input: JeditEditSubmissionIdentityInput,
  hash: HashPort,
): JeditEditSubmissionIdentity {
  const submissionDigest = hash.sha256Hex(stableSubmissionBasis(input));
  const submissionId = `${JEDIT_EDIT_SUBMISSION_ID_PREFIX}${submissionDigest}`;
  const idempotencyKeyDigest = hash.sha256Hex(
    idempotencyBasis(submissionId, input.canonicalEnvelopeDigest),
  );

  return {
    submissionId,
    idempotencyKeyDigest: `${JEDIT_EDIT_IDEMPOTENCY_KEY_PREFIX}${idempotencyKeyDigest}`,
    canonicalEnvelopeDigest: input.canonicalEnvelopeDigest,
    clientOperationId: input.clientOperationId,
    causalBasisDigest: input.causalBasisDigest,
  };
}

function stableSubmissionBasis(input: JeditEditSubmissionIdentityInput): string {
  return identityTuple([
    IDENTITY_VERSION,
    input.appInstanceId,
    input.sessionId,
    input.clientOperationId,
    input.contractPackageId,
    input.contractOperationName,
    input.causalBasisDigest,
  ]);
}

function idempotencyBasis(submissionId: string, canonicalEnvelopeDigest: string): string {
  return identityTuple([
    IDENTITY_VERSION,
    submissionId,
    canonicalEnvelopeDigest,
  ]);
}

function identityTuple(fields: readonly string[]): string {
  return JSON.stringify(fields);
}
