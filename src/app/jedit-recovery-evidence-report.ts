import {
  ECHO_EVIDENCE_HEALTH_COMPLETE,
  ECHO_RECOVERY_SOURCE_OF_TRUTH_ECHO,
  ECHO_RECOVERY_SOURCE_OF_TRUTH_INCOMPLETE,
  ECHO_RECOVERY_SOURCE_OF_TRUTH_LOCAL_FALLBACK_DETECTED,
  ECHO_RECOVERY_SOURCE_OF_TRUTH_UNKNOWN,
  type EchoRecoveryGateReport,
} from '../ports/echo-recovery.js';
import {
  JEDIT_LEGACY_FALLBACK_DETECTED,
  JEDIT_LEGACY_FALLBACK_NOT_DETECTED,
  JEDIT_RECOVERY_EVIDENCE_REPORT_PRODUCER,
  JEDIT_RECOVERY_EVIDENCE_REPORT_SCHEMA,
  type JeditRecoveryEvidenceReport,
  type JeditRecoveryEvidenceReportInput,
} from '../ports/jedit-recovery-evidence-report.js';
import {
  JEDIT_RECOVERED_EDIT_ERROR,
  JEDIT_RECOVERED_EDIT_INCOMPLETE,
  JEDIT_RECOVERED_EDIT_UNSUPPORTED,
  type JeditRecoveredEditPosture,
} from '../ports/recovered-edit-status.js';

export function createJeditRecoveryEvidenceReport(
  input: JeditRecoveryEvidenceReportInput,
): JeditRecoveryEvidenceReport {
  return {
    schemaVersion: JEDIT_RECOVERY_EVIDENCE_REPORT_SCHEMA,
    producer: JEDIT_RECOVERY_EVIDENCE_REPORT_PRODUCER,
    identity: input.identity,
    recoveredEdit: input.recoveredEdit,
    echo: input.echo,
    legacyFallbackStatus: input.legacyFallbackStatus,
  };
}

export function extractJeditEchoRecoveryEvidenceFields(
  report: EchoRecoveryGateReport,
  recoveredEdit: JeditRecoveredEditPosture,
  legacyFallbackStatus: string,
) {
  return {
    sourceOfTruth: sourceOfTruth(report, recoveredEdit, legacyFallbackStatus),
    tailPosture: report.tailPosture,
    lifecyclePosture: report.submission.lifecycle.posture,
    decisionResult: report.submission.decision.result,
    evidenceHealth: report.submission.evidenceHealth.status,
    causalChainStatus: report.causalChain.status,
    readingSource: report.causalChain.readingSource,
    readingAuthority: report.causalChain.readingAuthority,
    commitEvidenceCount: report.commitEvidence.evidence.length,
  };
}

function sourceOfTruth(
  report: EchoRecoveryGateReport,
  recoveredEdit: JeditRecoveredEditPosture,
  legacyFallbackStatus: string,
): string {
  if (legacyFallbackStatus === JEDIT_LEGACY_FALLBACK_DETECTED) {
    return ECHO_RECOVERY_SOURCE_OF_TRUTH_LOCAL_FALLBACK_DETECTED;
  }
  if (legacyFallbackStatus !== JEDIT_LEGACY_FALLBACK_NOT_DETECTED) {
    return ECHO_RECOVERY_SOURCE_OF_TRUTH_UNKNOWN;
  }
  if (report.submission.evidenceHealth.status !== ECHO_EVIDENCE_HEALTH_COMPLETE) {
    return ECHO_RECOVERY_SOURCE_OF_TRUTH_INCOMPLETE;
  }
  return sourceFromRecoveredEdit(recoveredEdit);
}

function sourceFromRecoveredEdit(recoveredEdit: JeditRecoveredEditPosture): string {
  if (recoveredEdit.status === JEDIT_RECOVERED_EDIT_ERROR) {
    return ECHO_RECOVERY_SOURCE_OF_TRUTH_INCOMPLETE;
  }
  if (recoveredEdit.status === JEDIT_RECOVERED_EDIT_INCOMPLETE) {
    return ECHO_RECOVERY_SOURCE_OF_TRUTH_INCOMPLETE;
  }
  if (recoveredEdit.status === JEDIT_RECOVERED_EDIT_UNSUPPORTED) {
    return ECHO_RECOVERY_SOURCE_OF_TRUTH_UNKNOWN;
  }
  return ECHO_RECOVERY_SOURCE_OF_TRUTH_ECHO;
}
