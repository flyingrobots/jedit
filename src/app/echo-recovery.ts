import {
  ECHO_CAUSAL_COMMIT_EVIDENCE_CONTRACT,
  ECHO_CAUSAL_COMMIT_EVIDENCE_SCHEMA_VERSION,
  ECHO_EVIDENCE_HEALTH_COMPLETE,
  ECHO_RECOVERY_ACCEPTED_EVIDENCE_PRESENT,
  ECHO_RECOVERY_CHAIN_NOT_REQUESTED,
  ECHO_RECOVERY_EMPTY_COUNT,
  ECHO_RECOVERY_FIXTURE_ROOT,
  ECHO_RECOVERY_GATE_CONTRACT,
  ECHO_RECOVERY_GATE_SCHEMA_VERSION,
  ECHO_RECOVERY_IDEMPOTENCY_IDEMPOTENT_RETRY,
  ECHO_RECOVERY_INTAKE_DUPLICATE_SAME_SUBMISSION,
  ECHO_RECOVERY_PORT_AVAILABLE,
  ECHO_RECOVERY_PORT_INVALID_REQUEST,
  ECHO_RECOVERY_PORT_UNAVAILABLE,
  ECHO_RECOVERY_PRODUCER_CLI,
  ECHO_RECOVERY_PRODUCER_VERSION,
  ECHO_RECOVERY_SUBMISSION_SCHEMA_VERSION,
  ECHO_RECOVERY_TAIL_CLEAN,
  ECHO_SUBMISSION_DECISION_NONE,
  ECHO_SUBMISSION_LIFECYCLE_NOT_FOUND,
  type EchoCausalCommitEvidenceEnvelope,
  type EchoRecoveryCertificateSummary,
  type EchoRecoveryCompatibility,
  type EchoRecoveryCausalChainReport,
  type EchoRecoveryGateReport,
  type EchoRecoveryGateRequest,
  type EchoRecoveryGateResult,
  type EchoRecoveryPort,
  type EchoRecoverySubmissionReport,
  type EchoRecoverySubmissionPostureCounts,
} from '../ports/echo-recovery.js';

const FIXTURE_KEY_SEPARATOR = '\u{1f}';
const MISSING_SUBMISSION_CODE = 'missing_submission_id';
const MISSING_ENVELOPE_CODE = 'missing_canonical_envelope_digest';
const FIXTURE_NOT_FOUND_CODE = 'echo_recovery_fixture_not_found';

export function createFakeEchoRecoveryPort(
  reports: readonly EchoRecoveryGateReport[],
): EchoRecoveryPort {
  const bySubmission = new Map<string, EchoRecoveryGateReport>();
  for (const report of reports) {
    bySubmission.set(
      fixtureKey(
        report.submission.submission.submissionId,
        report.submission.submission.canonicalEnvelopeDigest,
      ),
      report,
    );
  }

  return {
    async readExternalAppRecoveryGate(request) {
      const invalid = validateEchoRecoveryGateRequest(request);
      if (invalid != null) {
        return invalid;
      }
      const report = bySubmission.get(
        fixtureKey(request.submissionId, request.canonicalEnvelopeDigest),
      );
      if (report == null) {
        return unavailable(
          FIXTURE_NOT_FOUND_CODE,
          `No Echo recovery fixture exists for submission ${request.submissionId}.`,
        );
      }
      return {
        status: ECHO_RECOVERY_PORT_AVAILABLE,
        report,
      };
    },
  };
}

export function validateEchoRecoveryGateRequest(
  request: EchoRecoveryGateRequest,
): EchoRecoveryGateResult | null {
  if (request.submissionId.trim().length === 0) {
    return invalid(
      MISSING_SUBMISSION_CODE,
      'Echo recovery request requires a submission id.',
      'submissionId',
    );
  }
  if (request.canonicalEnvelopeDigest.trim().length === 0) {
    return invalid(
      MISSING_ENVELOPE_CODE,
      'Echo recovery request requires a canonical envelope digest.',
      'canonicalEnvelopeDigest',
    );
  }
  return null;
}

export function createEchoRecoveryGateFixture(
  submissionId: string,
  canonicalEnvelopeDigest: string,
): EchoRecoveryGateReport {
  return {
    schemaVersion: ECHO_RECOVERY_GATE_SCHEMA_VERSION,
    producer: ECHO_RECOVERY_PRODUCER_CLI,
    producerVersion: ECHO_RECOVERY_PRODUCER_VERSION,
    compatibility: compatibility(ECHO_RECOVERY_GATE_CONTRACT),
    tailPosture: ECHO_RECOVERY_TAIL_CLEAN,
    certificate: certificate(),
    submission: submissionReport(submissionId, canonicalEnvelopeDigest),
    causalChain: causalChainNotRequested(),
    commitEvidence: commitEvidenceEnvelope(),
  };
}

function submissionReport(
  submissionId: string,
  canonicalEnvelopeDigest: string,
): EchoRecoverySubmissionReport {
  return {
    schemaVersion: ECHO_RECOVERY_SUBMISSION_SCHEMA_VERSION,
    producer: ECHO_RECOVERY_PRODUCER_CLI,
    root: ECHO_RECOVERY_FIXTURE_ROOT,
    submission: {
      submissionId,
      canonicalEnvelopeDigest,
    },
    intake: {
      disposition: ECHO_RECOVERY_INTAKE_DUPLICATE_SAME_SUBMISSION,
      idempotencyLaw: ECHO_RECOVERY_IDEMPOTENCY_IDEMPOTENT_RETRY,
      acceptedEvidence: ECHO_RECOVERY_ACCEPTED_EVIDENCE_PRESENT,
    },
    lifecycle: {
      posture: ECHO_SUBMISSION_LIFECYCLE_NOT_FOUND,
    },
    decision: {
      result: ECHO_SUBMISSION_DECISION_NONE,
      receiptDigest: null,
      ticketDigest: null,
    },
    evidenceHealth: {
      status: ECHO_EVIDENCE_HEALTH_COMPLETE,
    },
  };
}

function causalChainNotRequested(): EchoRecoveryCausalChainReport {
  return {
    status: ECHO_RECOVERY_CHAIN_NOT_REQUESTED,
    posture: null,
    evidenceHealth: null,
    ticketDigest: null,
    receiptDigest: null,
    basisDigest: null,
    readingBasisDigest: null,
    semanticCoordinateDigest: null,
    readingId: null,
    readingSource: null,
    readingAuthority: null,
  };
}

function fixtureKey(submissionId: string, canonicalEnvelopeDigest: string): string {
  return `${submissionId}${FIXTURE_KEY_SEPARATOR}${canonicalEnvelopeDigest}`;
}

function invalid(
  code: string,
  message: string,
  field: string,
): EchoRecoveryGateResult {
  return {
    status: ECHO_RECOVERY_PORT_INVALID_REQUEST,
    diagnostic: {
      code,
      message,
      field,
    },
  };
}

function unavailable(code: string, message: string): EchoRecoveryGateResult {
  return {
    status: ECHO_RECOVERY_PORT_UNAVAILABLE,
    diagnostic: {
      code,
      message,
    },
  };
}

function compatibility(contract: string): EchoRecoveryCompatibility {
  return {
    contract,
    minimumConsumerSchemaVersion: `${contract}.v1`,
  };
}

function certificate(): EchoRecoveryCertificateSummary {
  return {
    committedTransactionsReplayed: ECHO_RECOVERY_EMPTY_COUNT,
    obstructionCount: ECHO_RECOVERY_EMPTY_COUNT,
    submissionPostureCounts: postureCounts(),
  };
}

function postureCounts(): EchoRecoverySubmissionPostureCounts {
  return {
    total: ECHO_RECOVERY_EMPTY_COUNT,
    acceptedPending: ECHO_RECOVERY_EMPTY_COUNT,
    decidedApplied: ECHO_RECOVERY_EMPTY_COUNT,
    decidedRejected: ECHO_RECOVERY_EMPTY_COUNT,
    obstructed: ECHO_RECOVERY_EMPTY_COUNT,
    recoveryFaulted: ECHO_RECOVERY_EMPTY_COUNT,
  };
}

function commitEvidenceEnvelope(): EchoCausalCommitEvidenceEnvelope {
  return {
    schemaVersion: ECHO_CAUSAL_COMMIT_EVIDENCE_SCHEMA_VERSION,
    producer: ECHO_RECOVERY_PRODUCER_CLI,
    producerVersion: ECHO_RECOVERY_PRODUCER_VERSION,
    compatibility: compatibility(ECHO_CAUSAL_COMMIT_EVIDENCE_CONTRACT),
    evidence: [],
  };
}
