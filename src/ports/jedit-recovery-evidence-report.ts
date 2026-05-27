import type { JeditEditSubmissionIdentity } from './jedit-edit-submission-identity.js';
import type { JeditRecoveredEditPosture } from './recovered-edit-status.js';

export const JEDIT_RECOVERY_EVIDENCE_REPORT_SCHEMA =
  'jedit.echo_recovery_evidence_report.v1';
export const JEDIT_RECOVERY_EVIDENCE_REPORT_PRODUCER = 'jedit';

export const JEDIT_LEGACY_FALLBACK_NOT_DETECTED = 'not_detected';
export const JEDIT_LEGACY_FALLBACK_DETECTED = 'detected';

export interface JeditRecoveryEvidenceReportInput {
  readonly identity: JeditEditSubmissionIdentity;
  readonly recoveredEdit: JeditRecoveredEditPosture;
  readonly echo: JeditEchoRecoveryEvidenceFields;
  readonly legacyFallbackStatus:
    | typeof JEDIT_LEGACY_FALLBACK_NOT_DETECTED
    | typeof JEDIT_LEGACY_FALLBACK_DETECTED;
}

export interface JeditEchoRecoveryEvidenceFields {
  readonly sourceOfTruth: string;
  readonly tailPosture: string;
  readonly lifecyclePosture: string;
  readonly decisionResult: string;
  readonly evidenceHealth: string;
  readonly causalChainStatus: string;
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
  readonly legacyFallbackStatus:
    | typeof JEDIT_LEGACY_FALLBACK_NOT_DETECTED
    | typeof JEDIT_LEGACY_FALLBACK_DETECTED;
}
