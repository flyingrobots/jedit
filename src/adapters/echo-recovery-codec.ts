import { z } from 'zod';

import {
  ECHO_EVIDENCE_HEALTH_COMPLETE,
  ECHO_EVIDENCE_HEALTH_CORRUPT,
  ECHO_EVIDENCE_HEALTH_INCOMPLETE,
  ECHO_EVIDENCE_HEALTH_MISSING_RETENTION,
  ECHO_EVIDENCE_HEALTH_REDACTED,
  ECHO_RECOVERY_CHAIN_EVALUATED,
  ECHO_RECOVERY_CHAIN_INCOMPLETE,
  ECHO_RECOVERY_CHAIN_NOT_REQUESTED,
  ECHO_RECOVERY_PORT_AVAILABLE,
  ECHO_RECOVERY_PORT_UNAVAILABLE,
  ECHO_SUBMISSION_DECISION_APPLIED,
  ECHO_SUBMISSION_DECISION_NONE,
  ECHO_SUBMISSION_DECISION_OBSTRUCTED,
  ECHO_SUBMISSION_DECISION_REJECTED,
  ECHO_SUBMISSION_LIFECYCLE_ACCEPTED_DECIDING,
  ECHO_SUBMISSION_LIFECYCLE_ACCEPTED_PENDING,
  ECHO_SUBMISSION_LIFECYCLE_DECIDED,
  ECHO_SUBMISSION_LIFECYCLE_NOT_FOUND,
  type EchoCausalCommitEvidence,
  type EchoCausalCommitEvidenceEnvelope,
  type EchoRecoveryCertificateSummary,
  type EchoRecoveryCompatibility,
  type EchoRecoveryGateReport,
  type EchoRecoveryGateResult,
  type EchoRecoveryGateUnavailable,
  type EchoRecoverySubmissionPostureCounts,
} from '../ports/echo-recovery.js';

const ECHO_RECOVERY_JSON_PARSED = 'ECHO_RECOVERY_JSON_PARSED';
const DECODE_FAILED_CODE = 'echo_recovery_decode_failed';
const ROOT_FIELD = 'stdout';

interface EchoRecoveryJsonParsed {
  readonly status: typeof ECHO_RECOVERY_JSON_PARSED;
  readonly report: JSON;
}

type EchoRecoveryJsonParseResult =
  | EchoRecoveryJsonParsed
  | EchoRecoveryGateUnavailable;

const CompatibilityJsonSchema = z.object({
  contract: z.string(),
  minimum_consumer_schema_version: z.string(),
});

const PostureCountsJsonSchema = z.object({
  total: z.number(),
  accepted_pending: z.number(),
  decided_applied: z.number(),
  decided_rejected: z.number(),
  obstructed: z.number(),
  recovery_faulted: z.number(),
});

const CertificateJsonSchema = z.object({
  committed_transactions_replayed: z.number(),
  obstruction_count: z.number(),
  submission_posture_counts: PostureCountsJsonSchema,
});

const SubmissionJsonSchema = z.object({
  schema_version: z.string(),
  producer: z.string(),
  root: z.string(),
  submission: z.object({
    submission_id: z.string(),
    canonical_envelope_digest: z.string(),
  }),
  intake: z.object({
    disposition: z.string(),
    idempotency_law: z.string(),
    accepted_evidence: z.string(),
  }),
  lifecycle: z.object({
    posture: z.union([
      z.literal(ECHO_SUBMISSION_LIFECYCLE_NOT_FOUND),
      z.literal(ECHO_SUBMISSION_LIFECYCLE_ACCEPTED_PENDING),
      z.literal(ECHO_SUBMISSION_LIFECYCLE_ACCEPTED_DECIDING),
      z.literal(ECHO_SUBMISSION_LIFECYCLE_DECIDED),
    ]),
  }),
  decision: z.object({
    result: z.union([
      z.literal(ECHO_SUBMISSION_DECISION_NONE),
      z.literal(ECHO_SUBMISSION_DECISION_APPLIED),
      z.literal(ECHO_SUBMISSION_DECISION_REJECTED),
      z.literal(ECHO_SUBMISSION_DECISION_OBSTRUCTED),
    ]),
    receipt_digest: z.string().nullable(),
    ticket_digest: z.string().nullable(),
  }),
  evidence_health: z.object({
    status: z.union([
      z.literal(ECHO_EVIDENCE_HEALTH_COMPLETE),
      z.literal(ECHO_EVIDENCE_HEALTH_INCOMPLETE),
      z.literal(ECHO_EVIDENCE_HEALTH_CORRUPT),
      z.literal(ECHO_EVIDENCE_HEALTH_MISSING_RETENTION),
      z.literal(ECHO_EVIDENCE_HEALTH_REDACTED),
    ]),
  }),
});

const CausalChainJsonSchema = z.object({
  status: z.union([
    z.literal(ECHO_RECOVERY_CHAIN_NOT_REQUESTED),
    z.literal(ECHO_RECOVERY_CHAIN_EVALUATED),
    z.literal(ECHO_RECOVERY_CHAIN_INCOMPLETE),
  ]),
  posture: z.string().nullable(),
  evidence_health: z.string().nullable(),
  ticket_digest: z.string().nullable(),
  receipt_digest: z.string().nullable(),
  basis_digest: z.string().nullable(),
  reading_basis_digest: z.string().nullable(),
  semantic_coordinate_digest: z.string().nullable(),
  reading_id: z.string().nullable(),
  reading_source: z.string().nullable(),
  reading_authority: z.string().nullable(),
});

const CommitEvidenceJsonSchema = z.object({
  evidence_id: z.string(),
  posture: z.string(),
  source: z.string(),
  durability_mode: z.string(),
  writer_epoch: z.string(),
  lsn: z.number(),
  transaction_id: z.string(),
  commit_digest: z.string(),
  checkpoint_digest: z.string().nullable(),
  recovery_certificate_digest: z.string().nullable(),
  obstruction_digest: z.string().nullable(),
  reason: z.string().nullable(),
});

const CommitEvidenceEnvelopeJsonSchema = z.object({
  schema_version: z.string(),
  producer: z.string(),
  producer_version: z.string(),
  compatibility: CompatibilityJsonSchema,
  evidence: z.array(CommitEvidenceJsonSchema),
});

const GateJsonSchema = z.object({
  schema_version: z.string(),
  producer: z.string(),
  producer_version: z.string(),
  compatibility: CompatibilityJsonSchema,
  tail_posture: z.string(),
  certificate: CertificateJsonSchema,
  submission: SubmissionJsonSchema,
  causal_chain: CausalChainJsonSchema,
  commit_evidence: CommitEvidenceEnvelopeJsonSchema,
});

type GateJson = z.infer<typeof GateJsonSchema>;
type CompatibilityJson = z.infer<typeof CompatibilityJsonSchema>;
type PostureCountsJson = z.infer<typeof PostureCountsJsonSchema>;
type CommitEvidenceJson = z.infer<typeof CommitEvidenceJsonSchema>;

export function decodeEchoRecoveryGateReport(stdout: string): EchoRecoveryGateResult {
  const json = parseJson(stdout);
  if (json.status === ECHO_RECOVERY_PORT_UNAVAILABLE) {
    return json;
  }
  const parsed = GateJsonSchema.safeParse(json.report);
  if (!parsed.success) {
    return decodeUnavailable(parsed.error.message);
  }
  return {
    status: ECHO_RECOVERY_PORT_AVAILABLE,
    report: toGateReport(parsed.data),
  };
}

function parseJson(stdout: string): EchoRecoveryJsonParseResult {
  try {
    return {
      status: ECHO_RECOVERY_JSON_PARSED,
      report: JSON.parse(stdout),
    };
  } catch {
    return decodeUnavailable('Echo recovery output was not valid JSON.');
  }
}

function decodeUnavailable(message: string): EchoRecoveryGateUnavailable {
  return {
    status: ECHO_RECOVERY_PORT_UNAVAILABLE,
    diagnostic: {
      code: DECODE_FAILED_CODE,
      message,
      field: ROOT_FIELD,
    },
  };
}

function toGateReport(json: GateJson): EchoRecoveryGateReport {
  return {
    schemaVersion: json.schema_version,
    producer: json.producer,
    producerVersion: json.producer_version,
    compatibility: toCompatibility(json.compatibility),
    tailPosture: json.tail_posture,
    certificate: toCertificate(json.certificate),
    submission: toSubmission(json),
    causalChain: toCausalChain(json),
    commitEvidence: toCommitEvidenceEnvelope(json.commit_evidence),
  };
}

function toCompatibility(json: CompatibilityJson): EchoRecoveryCompatibility {
  return {
    contract: json.contract,
    minimumConsumerSchemaVersion: json.minimum_consumer_schema_version,
  };
}

function toCertificate(json: GateJson['certificate']): EchoRecoveryCertificateSummary {
  return {
    committedTransactionsReplayed: json.committed_transactions_replayed,
    obstructionCount: json.obstruction_count,
    submissionPostureCounts: toPostureCounts(json.submission_posture_counts),
  };
}

function toPostureCounts(json: PostureCountsJson): EchoRecoverySubmissionPostureCounts {
  return {
    total: json.total,
    acceptedPending: json.accepted_pending,
    decidedApplied: json.decided_applied,
    decidedRejected: json.decided_rejected,
    obstructed: json.obstructed,
    recoveryFaulted: json.recovery_faulted,
  };
}

function toSubmission(json: GateJson): EchoRecoveryGateReport['submission'] {
  return {
    schemaVersion: json.submission.schema_version,
    producer: json.submission.producer,
    root: json.submission.root,
    submission: {
      submissionId: json.submission.submission.submission_id,
      canonicalEnvelopeDigest: json.submission.submission.canonical_envelope_digest,
    },
    intake: {
      disposition: json.submission.intake.disposition,
      idempotencyLaw: json.submission.intake.idempotency_law,
      acceptedEvidence: json.submission.intake.accepted_evidence,
    },
    lifecycle: json.submission.lifecycle,
    decision: {
      result: json.submission.decision.result,
      receiptDigest: json.submission.decision.receipt_digest,
      ticketDigest: json.submission.decision.ticket_digest,
    },
    evidenceHealth: {
      status: json.submission.evidence_health.status,
    },
  };
}

function toCausalChain(json: GateJson): EchoRecoveryGateReport['causalChain'] {
  return {
    status: json.causal_chain.status,
    posture: json.causal_chain.posture,
    evidenceHealth: json.causal_chain.evidence_health,
    ticketDigest: json.causal_chain.ticket_digest,
    receiptDigest: json.causal_chain.receipt_digest,
    basisDigest: json.causal_chain.basis_digest,
    readingBasisDigest: json.causal_chain.reading_basis_digest,
    semanticCoordinateDigest: json.causal_chain.semantic_coordinate_digest,
    readingId: json.causal_chain.reading_id,
    readingSource: json.causal_chain.reading_source,
    readingAuthority: json.causal_chain.reading_authority,
  };
}

function toCommitEvidenceEnvelope(
  json: GateJson['commit_evidence'],
): EchoCausalCommitEvidenceEnvelope {
  return {
    schemaVersion: json.schema_version,
    producer: json.producer,
    producerVersion: json.producer_version,
    compatibility: toCompatibility(json.compatibility),
    evidence: json.evidence.map(toCommitEvidence),
  };
}

function toCommitEvidence(json: CommitEvidenceJson): EchoCausalCommitEvidence {
  return {
    evidenceId: json.evidence_id,
    posture: json.posture,
    source: json.source,
    durabilityMode: json.durability_mode,
    writerEpoch: json.writer_epoch,
    lsn: json.lsn,
    transactionId: json.transaction_id,
    commitDigest: json.commit_digest,
    checkpointDigest: json.checkpoint_digest,
    recoveryCertificateDigest: json.recovery_certificate_digest,
    obstructionDigest: json.obstruction_digest,
    reason: json.reason,
  };
}
