import {
  ECHO_EVIDENCE_HEALTH_COMPLETE,
  ECHO_RECOVERY_SOURCE_OF_TRUTH_ECHO,
  ECHO_RECOVERY_SOURCE_OF_TRUTH_INCOMPLETE,
  ECHO_RECOVERY_SOURCE_OF_TRUTH_LOCAL_FALLBACK_DETECTED,
  ECHO_RECOVERY_SOURCE_OF_TRUTH_UNKNOWN,
  type EchoRecoverySourceOfTruth,
  type EchoRecoveryGateReport,
} from '../ports/echo-recovery.js';
import {
  JEDIT_LEGACY_FALLBACK_DETECTED,
  JEDIT_LEGACY_FALLBACK_NOT_DETECTED,
  JEDIT_RECOVERY_EVIDENCE_REPORT_PRODUCER,
  JEDIT_RECOVERY_EVIDENCE_REPORT_SCHEMA,
  type JeditLegacyFallbackStatus,
  type JeditRecoveryEvidenceReport,
  type JeditRecoveryEvidenceReportInput,
} from '../ports/jedit-recovery-evidence-report.js';
import {
  JEDIT_RECOVERED_EDIT_APPLIED,
  JEDIT_RECOVERED_EDIT_BLOCKED,
  JEDIT_RECOVERED_EDIT_ERROR,
  JEDIT_RECOVERED_EDIT_INCOMPLETE,
  JEDIT_RECOVERED_EDIT_PENDING,
  JEDIT_RECOVERED_EDIT_PROCESSING,
  JEDIT_RECOVERED_EDIT_REJECTED,
  JEDIT_RECOVERED_EDIT_UNKNOWN,
  JEDIT_RECOVERED_EDIT_UNSUPPORTED,
  type JeditRecoveredEditPosture,
  type JeditRecoveredEditStatus,
} from '../ports/recovered-edit-status.js';

const RECOVERED_EDIT_SOURCE_OF_TRUTH: Record<JeditRecoveredEditStatus, EchoRecoverySourceOfTruth> = {
  [JEDIT_RECOVERED_EDIT_APPLIED]: ECHO_RECOVERY_SOURCE_OF_TRUTH_ECHO,
  [JEDIT_RECOVERED_EDIT_BLOCKED]: ECHO_RECOVERY_SOURCE_OF_TRUTH_ECHO,
  [JEDIT_RECOVERED_EDIT_ERROR]: ECHO_RECOVERY_SOURCE_OF_TRUTH_INCOMPLETE,
  [JEDIT_RECOVERED_EDIT_INCOMPLETE]: ECHO_RECOVERY_SOURCE_OF_TRUTH_INCOMPLETE,
  [JEDIT_RECOVERED_EDIT_PENDING]: ECHO_RECOVERY_SOURCE_OF_TRUTH_ECHO,
  [JEDIT_RECOVERED_EDIT_PROCESSING]: ECHO_RECOVERY_SOURCE_OF_TRUTH_ECHO,
  [JEDIT_RECOVERED_EDIT_REJECTED]: ECHO_RECOVERY_SOURCE_OF_TRUTH_ECHO,
  [JEDIT_RECOVERED_EDIT_UNKNOWN]: ECHO_RECOVERY_SOURCE_OF_TRUTH_ECHO,
  [JEDIT_RECOVERED_EDIT_UNSUPPORTED]: ECHO_RECOVERY_SOURCE_OF_TRUTH_UNKNOWN,
};

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
  legacyFallbackStatus: JeditLegacyFallbackStatus,
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
  legacyFallbackStatus: JeditLegacyFallbackStatus,
): EchoRecoverySourceOfTruth {
  switch (legacyFallbackStatus) {
    case JEDIT_LEGACY_FALLBACK_DETECTED:
      return ECHO_RECOVERY_SOURCE_OF_TRUTH_LOCAL_FALLBACK_DETECTED;
    case JEDIT_LEGACY_FALLBACK_NOT_DETECTED:
      return sourceOfTruthWithoutFallback(report, recoveredEdit);
  }
  return unsupportedFallbackStatus(legacyFallbackStatus);
}

function sourceOfTruthWithoutFallback(
  report: EchoRecoveryGateReport,
  recoveredEdit: JeditRecoveredEditPosture,
): EchoRecoverySourceOfTruth {
  if (report.submission.evidenceHealth.status !== ECHO_EVIDENCE_HEALTH_COMPLETE) {
    return ECHO_RECOVERY_SOURCE_OF_TRUTH_INCOMPLETE;
  }
  return sourceFromRecoveredEdit(recoveredEdit);
}

function sourceFromRecoveredEdit(recoveredEdit: JeditRecoveredEditPosture): EchoRecoverySourceOfTruth {
  return RECOVERED_EDIT_SOURCE_OF_TRUTH[recoveredEdit.status];
}

function unsupportedFallbackStatus(status: never): EchoRecoverySourceOfTruth {
  return status;
}
