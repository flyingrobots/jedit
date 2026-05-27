import {
  ECHO_EVIDENCE_HEALTH_COMPLETE,
  ECHO_RECOVERY_CHAIN_NOT_REQUESTED,
  ECHO_RECOVERY_PORT_AVAILABLE,
  ECHO_RECOVERY_PORT_INVALID_REQUEST,
  ECHO_RECOVERY_PORT_UNAVAILABLE,
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
  if (request.submissionId.length === 0) {
    return invalid(
      MISSING_SUBMISSION_CODE,
      'Echo recovery request requires a submission id.',
      'submissionId',
    );
  }
  if (request.canonicalEnvelopeDigest.length === 0) {
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
    schemaVersion: 'echo.recovery.external_app_gate.v1',
    producer: 'echo-cli',
    producerVersion: '0.1.0',
    compatibility: compatibility('echo.recovery.external_app_gate'),
    tailPosture: 'Clean',
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
    schemaVersion: 'echo.recovery.submission_posture.v1',
    producer: 'echo-cli',
    root: '.echo-test-fixture',
    submission: {
      submissionId,
      canonicalEnvelopeDigest,
    },
    intake: {
      disposition: 'duplicate_same_submission',
      idempotencyLaw: 'idempotent_retry',
      acceptedEvidence: 'present',
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
    committedTransactionsReplayed: 0,
    obstructionCount: 0,
    submissionPostureCounts: postureCounts(),
  };
}

function postureCounts(): EchoRecoverySubmissionPostureCounts {
  return {
    total: 0,
    acceptedPending: 0,
    decidedApplied: 0,
    decidedRejected: 0,
    obstructed: 0,
    recoveryFaulted: 0,
  };
}

function commitEvidenceEnvelope(): EchoCausalCommitEvidenceEnvelope {
  return {
    schemaVersion: 'echo.causal_commit_evidence.v1',
    producer: 'echo-cli',
    producerVersion: '0.1.0',
    compatibility: compatibility('echo.causal_commit_evidence'),
    evidence: [],
  };
}
