import type { JeditEditSubmissionIdentity } from './jedit-edit-submission-identity.js';

export const JEDIT_RECOVERY_AMNESIA_TOKEN_SCHEMA = 'jedit.recovery_amnesia_token.v1';

export interface JeditRecoveryAmnesiaToken {
  readonly schemaVersion: typeof JEDIT_RECOVERY_AMNESIA_TOKEN_SCHEMA;
  readonly submissionId: string;
  readonly idempotencyKeyDigest: string;
  readonly canonicalEnvelopeDigest: string;
  readonly clientOperationId: string;
  readonly causalBasisDigest: string;
}

export interface JeditRecoveryAmnesiaTokenInput {
  readonly identity: JeditEditSubmissionIdentity;
}
