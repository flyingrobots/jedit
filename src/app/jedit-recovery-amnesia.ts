import type { JeditEditSubmissionIdentity } from '../ports/jedit-edit-submission-identity.js';
import {
  JEDIT_RECOVERY_AMNESIA_TOKEN_SCHEMA,
  type JeditRecoveryAmnesiaToken,
  type JeditRecoveryAmnesiaTokenInput,
} from '../ports/jedit-recovery-amnesia.js';

export function createJeditRecoveryAmnesiaToken(
  input: JeditRecoveryAmnesiaTokenInput,
): JeditRecoveryAmnesiaToken {
  return {
    schemaVersion: JEDIT_RECOVERY_AMNESIA_TOKEN_SCHEMA,
    submissionId: input.identity.submissionId,
    idempotencyKeyDigest: input.identity.idempotencyKeyDigest,
    canonicalEnvelopeDigest: input.identity.canonicalEnvelopeDigest,
    clientOperationId: input.identity.clientOperationId,
    causalBasisDigest: input.identity.causalBasisDigest,
  };
}

export function rehydrateJeditIdentityFromAmnesiaToken(
  token: JeditRecoveryAmnesiaToken,
): JeditEditSubmissionIdentity {
  if (token.schemaVersion !== JEDIT_RECOVERY_AMNESIA_TOKEN_SCHEMA) {
    throw new TypeError('Unsupported jedit recovery amnesia token schema version.');
  }
  return {
    submissionId: token.submissionId,
    idempotencyKeyDigest: token.idempotencyKeyDigest,
    canonicalEnvelopeDigest: token.canonicalEnvelopeDigest,
    clientOperationId: token.clientOperationId,
    causalBasisDigest: token.causalBasisDigest,
  };
}
