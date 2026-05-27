export const JEDIT_EDIT_SUBMISSION_ID_PREFIX = 'jedit-submission:';
export const JEDIT_EDIT_IDEMPOTENCY_KEY_PREFIX = 'jedit-idempotency:';

export interface JeditEditSubmissionIdentityInput {
  readonly appInstanceId: string;
  readonly sessionId: string;
  readonly clientOperationId: string;
  readonly contractPackageId: string;
  readonly contractOperationName: string;
  readonly causalBasisDigest: string;
  readonly canonicalEnvelopeDigest: string;
}

export interface JeditEditSubmissionIdentity {
  readonly submissionId: string;
  readonly idempotencyKeyDigest: string;
  readonly canonicalEnvelopeDigest: string;
  readonly clientOperationId: string;
  readonly causalBasisDigest: string;
}
