export const ECHO_RECOVERY_PORT_AVAILABLE = 'ECHO_RECOVERY_PORT_AVAILABLE';
export const ECHO_RECOVERY_PORT_UNAVAILABLE = 'ECHO_RECOVERY_PORT_UNAVAILABLE';
export const ECHO_RECOVERY_PORT_INVALID_REQUEST = 'ECHO_RECOVERY_PORT_INVALID_REQUEST';

export const ECHO_RECOVERY_CHAIN_NOT_REQUESTED = 'not_requested';
export const ECHO_RECOVERY_CHAIN_EVALUATED = 'evaluated';
export const ECHO_RECOVERY_CHAIN_INCOMPLETE = 'incomplete';

export const ECHO_RECOVERY_SOURCE_OF_TRUTH_ECHO = 'echo';
export const ECHO_RECOVERY_SOURCE_OF_TRUTH_INCOMPLETE = 'incomplete';
export const ECHO_RECOVERY_SOURCE_OF_TRUTH_UNKNOWN = 'unknown';
export const ECHO_RECOVERY_SOURCE_OF_TRUTH_LOCAL_FALLBACK_DETECTED =
  'local_fallback_detected';

export const ECHO_SUBMISSION_LIFECYCLE_NOT_FOUND = 'not_found';
export const ECHO_SUBMISSION_LIFECYCLE_ACCEPTED_PENDING = 'accepted_pending';
export const ECHO_SUBMISSION_LIFECYCLE_ACCEPTED_DECIDING = 'accepted_deciding';
export const ECHO_SUBMISSION_LIFECYCLE_DECIDED = 'decided';

export const ECHO_SUBMISSION_DECISION_NONE = 'none';
export const ECHO_SUBMISSION_DECISION_APPLIED = 'applied';
export const ECHO_SUBMISSION_DECISION_REJECTED = 'rejected';
export const ECHO_SUBMISSION_DECISION_OBSTRUCTED = 'obstructed';

export const ECHO_EVIDENCE_HEALTH_COMPLETE = 'complete';
export const ECHO_EVIDENCE_HEALTH_INCOMPLETE = 'incomplete_evidence';
export const ECHO_EVIDENCE_HEALTH_CORRUPT = 'corrupt_or_untrusted';
export const ECHO_EVIDENCE_HEALTH_MISSING_RETENTION = 'missing_retention';
export const ECHO_EVIDENCE_HEALTH_REDACTED = 'redacted';

export interface EchoRecoveryGateRequest {
  readonly submissionId: string;
  readonly canonicalEnvelopeDigest: string;
  readonly reading?: EchoRecoveryReadingChainRequest;
}

export interface EchoRecoveryReadingChainRequest {
  readonly basisDigest: string;
  readonly readingBasisDigest: string;
  readonly semanticCoordinateDigest: string;
  readonly readingId: string;
}

export interface EchoRecoveryPort {
  readExternalAppRecoveryGate(
    request: EchoRecoveryGateRequest,
  ): Promise<EchoRecoveryGateResult>;
}

export interface EchoRecoveryGateAvailable {
  readonly status: typeof ECHO_RECOVERY_PORT_AVAILABLE;
  readonly report: EchoRecoveryGateReport;
}

export interface EchoRecoveryGateUnavailable {
  readonly status: typeof ECHO_RECOVERY_PORT_UNAVAILABLE;
  readonly diagnostic: EchoRecoveryDiagnostic;
}

export interface EchoRecoveryGateInvalidRequest {
  readonly status: typeof ECHO_RECOVERY_PORT_INVALID_REQUEST;
  readonly diagnostic: EchoRecoveryDiagnostic;
}

export type EchoRecoveryGateResult =
  | EchoRecoveryGateAvailable
  | EchoRecoveryGateUnavailable
  | EchoRecoveryGateInvalidRequest;

export interface EchoRecoveryDiagnostic {
  readonly code: string;
  readonly message: string;
  readonly field?: string;
}

export interface EchoRecoveryGateReport {
  readonly schemaVersion: string;
  readonly producer: string;
  readonly producerVersion: string;
  readonly compatibility: EchoRecoveryCompatibility;
  readonly tailPosture: string;
  readonly certificate: EchoRecoveryCertificateSummary;
  readonly submission: EchoRecoverySubmissionReport;
  readonly causalChain: EchoRecoveryCausalChainReport;
  readonly commitEvidence: EchoCausalCommitEvidenceEnvelope;
}

export interface EchoRecoveryCompatibility {
  readonly contract: string;
  readonly minimumConsumerSchemaVersion: string;
}

export interface EchoRecoveryCertificateSummary {
  readonly committedTransactionsReplayed: number;
  readonly obstructionCount: number;
  readonly submissionPostureCounts: EchoRecoverySubmissionPostureCounts;
}

export interface EchoRecoverySubmissionPostureCounts {
  readonly total: number;
  readonly acceptedPending: number;
  readonly decidedApplied: number;
  readonly decidedRejected: number;
  readonly obstructed: number;
  readonly recoveryFaulted: number;
}

export interface EchoRecoverySubmissionReport {
  readonly schemaVersion: string;
  readonly producer: string;
  readonly root: string;
  readonly submission: EchoRecoverySubmissionIdentity;
  readonly intake: EchoRecoverySubmissionIntake;
  readonly lifecycle: EchoSubmissionLifecyclePosture;
  readonly decision: EchoSubmissionDecision;
  readonly evidenceHealth: EchoEvidenceHealthReport;
}

export interface EchoRecoverySubmissionIdentity {
  readonly submissionId: string;
  readonly canonicalEnvelopeDigest: string;
}

export interface EchoRecoverySubmissionIntake {
  readonly disposition: string;
  readonly idempotencyLaw: string;
  readonly acceptedEvidence: string;
}

export interface EchoSubmissionLifecyclePosture {
  readonly posture:
    | typeof ECHO_SUBMISSION_LIFECYCLE_NOT_FOUND
    | typeof ECHO_SUBMISSION_LIFECYCLE_ACCEPTED_PENDING
    | typeof ECHO_SUBMISSION_LIFECYCLE_ACCEPTED_DECIDING
    | typeof ECHO_SUBMISSION_LIFECYCLE_DECIDED;
}

export interface EchoSubmissionDecision {
  readonly result:
    | typeof ECHO_SUBMISSION_DECISION_NONE
    | typeof ECHO_SUBMISSION_DECISION_APPLIED
    | typeof ECHO_SUBMISSION_DECISION_REJECTED
    | typeof ECHO_SUBMISSION_DECISION_OBSTRUCTED;
  readonly receiptDigest: string | null;
  readonly ticketDigest: string | null;
}

export interface EchoEvidenceHealthReport {
  readonly status:
    | typeof ECHO_EVIDENCE_HEALTH_COMPLETE
    | typeof ECHO_EVIDENCE_HEALTH_INCOMPLETE
    | typeof ECHO_EVIDENCE_HEALTH_CORRUPT
    | typeof ECHO_EVIDENCE_HEALTH_MISSING_RETENTION
    | typeof ECHO_EVIDENCE_HEALTH_REDACTED;
}

export interface EchoRecoveryCausalChainReport {
  readonly status:
    | typeof ECHO_RECOVERY_CHAIN_NOT_REQUESTED
    | typeof ECHO_RECOVERY_CHAIN_EVALUATED
    | typeof ECHO_RECOVERY_CHAIN_INCOMPLETE;
  readonly posture: string | null;
  readonly evidenceHealth: string | null;
  readonly ticketDigest: string | null;
  readonly receiptDigest: string | null;
  readonly basisDigest: string | null;
  readonly readingBasisDigest: string | null;
  readonly semanticCoordinateDigest: string | null;
  readonly readingId: string | null;
  readonly readingSource: string | null;
  readonly readingAuthority: string | null;
}

export interface EchoCausalCommitEvidenceEnvelope {
  readonly schemaVersion: string;
  readonly producer: string;
  readonly producerVersion: string;
  readonly compatibility: EchoRecoveryCompatibility;
  readonly evidence: readonly EchoCausalCommitEvidence[];
}

export interface EchoCausalCommitEvidence {
  readonly evidenceId: string;
  readonly posture: string;
  readonly source: string;
  readonly durabilityMode: string;
  readonly writerEpoch: string;
  readonly lsn: number;
  readonly transactionId: string;
  readonly commitDigest: string;
  readonly checkpointDigest: string | null;
  readonly recoveryCertificateDigest: string | null;
  readonly obstructionDigest: string | null;
  readonly reason: string | null;
}
