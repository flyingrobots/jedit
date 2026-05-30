import type {
  EchoEvidenceHealthStatus,
  EchoRecoveryChainStatus,
  EchoRecoverySourceOfTruth,
  EchoRecoveryTailPosture,
  EchoSubmissionDecisionResult,
  EchoSubmissionLifecycleStatus,
} from './echo-recovery.js';
import type { JeditEditSubmissionIdentity } from './jedit-edit-submission-identity.js';
import type { JeditRecoveredEditPosture } from './recovered-edit-status.js';

export const JEDIT_RECOVERY_EVIDENCE_REPORT_SCHEMA =
  'jedit.echo_recovery_evidence_report.v1';
export const JEDIT_RECOVERY_EVIDENCE_REPORT_PRODUCER = 'jedit';

export const JEDIT_LEGACY_FALLBACK_NOT_DETECTED = 'not_detected';
export const JEDIT_LEGACY_FALLBACK_DETECTED = 'detected';

export type JeditLegacyFallbackStatus =
  | typeof JEDIT_LEGACY_FALLBACK_NOT_DETECTED
  | typeof JEDIT_LEGACY_FALLBACK_DETECTED;

export interface JeditRecoveryEvidenceReportInput {
  readonly identity: JeditEditSubmissionIdentity;
  readonly recoveredEdit: JeditRecoveredEditPosture;
  readonly echo: JeditEchoRecoveryEvidenceFields;
  readonly legacyFallbackStatus: JeditLegacyFallbackStatus;
}

export interface JeditEchoRecoveryEvidenceFields {
  readonly sourceOfTruth: EchoRecoverySourceOfTruth;
  readonly tailPosture: EchoRecoveryTailPosture;
  readonly lifecyclePosture: EchoSubmissionLifecycleStatus;
  readonly decisionResult: EchoSubmissionDecisionResult;
  readonly evidenceHealth: EchoEvidenceHealthStatus;
  readonly causalChainStatus: EchoRecoveryChainStatus;
  readonly readingSource: string | null;
  readonly readingAuthority: string | null;
  readonly commitEvidenceCount: number;
}

export interface JeditRecoveryEvidenceReport {
  readonly schemaVersion: typeof JEDIT_RECOVERY_EVIDENCE_REPORT_SCHEMA;
  readonly producer: typeof JEDIT_RECOVERY_EVIDENCE_REPORT_PRODUCER;
  readonly identity: JeditEditSubmissionIdentity;
  readonly recoveredEdit: JeditRecoveredEditPosture;
  readonly echo: JeditEchoRecoveryEvidenceFields;
  readonly legacyFallbackStatus: JeditLegacyFallbackStatus;
}
