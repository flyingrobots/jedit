import {
  ECHO_EVIDENCE_HEALTH_COMPLETE,
  ECHO_EVIDENCE_HEALTH_CORRUPT,
  ECHO_EVIDENCE_HEALTH_INCOMPLETE,
  ECHO_EVIDENCE_HEALTH_MISSING_RETENTION,
  ECHO_EVIDENCE_HEALTH_REDACTED,
  ECHO_SUBMISSION_DECISION_APPLIED,
  ECHO_SUBMISSION_DECISION_NONE,
  ECHO_SUBMISSION_DECISION_OBSTRUCTED,
  ECHO_SUBMISSION_DECISION_REJECTED,
  ECHO_SUBMISSION_LIFECYCLE_ACCEPTED_DECIDING,
  ECHO_SUBMISSION_LIFECYCLE_ACCEPTED_PENDING,
  ECHO_SUBMISSION_LIFECYCLE_DECIDED,
  ECHO_SUBMISSION_LIFECYCLE_NOT_FOUND,
  type EchoEvidenceHealthStatus,
  type EchoRecoveryGateReport,
  type EchoSubmissionDecisionResult,
  type EchoSubmissionLifecycleStatus,
} from '../ports/echo-recovery.js';
import {
  JEDIT_RECOVERED_EDIT_APPLIED,
  JEDIT_RECOVERED_EDIT_BLOCKED,
  JEDIT_RECOVERED_EDIT_ERROR,
  JEDIT_RECOVERED_EDIT_INCOMPLETE,
  JEDIT_RECOVERED_EDIT_PENDING,
  JEDIT_RECOVERED_EDIT_PROCESSING,
  JEDIT_RECOVERED_EDIT_REASON_BLOCKED,
  JEDIT_RECOVERED_EDIT_REASON_COMPLETE,
  JEDIT_RECOVERED_EDIT_REASON_CORRUPT,
  JEDIT_RECOVERED_EDIT_REASON_INCOMPLETE,
  JEDIT_RECOVERED_EDIT_REASON_PENDING,
  JEDIT_RECOVERED_EDIT_REASON_PROCESSING,
  JEDIT_RECOVERED_EDIT_REASON_REJECTED,
  JEDIT_RECOVERED_EDIT_REASON_UNKNOWN,
  JEDIT_RECOVERED_EDIT_REASON_UNSUPPORTED,
  JEDIT_RECOVERED_EDIT_REJECTED,
  JEDIT_RECOVERED_EDIT_UNKNOWN,
  JEDIT_RECOVERED_EDIT_UNSUPPORTED,
  type JeditRecoveredEditPosture,
  type JeditRecoveredEditStatus,
} from '../ports/recovered-edit-status.js';

export function mapEchoRecoveryToRecoveredEditPosture(
  report: EchoRecoveryGateReport,
): JeditRecoveredEditPosture {
  const lifecycle = report.submission.lifecycle.posture;
  const decision = report.submission.decision.result;
  const health = report.submission.evidenceHealth.status;
  const status = mapStatus(lifecycle, decision, health);
  return {
    status,
    reason: reasonForStatus(status),
    echoLifecyclePosture: lifecycle,
    echoDecisionResult: decision,
    echoEvidenceHealth: health,
  };
}

function mapStatus(
  lifecycle: EchoSubmissionLifecycleStatus,
  decision: EchoSubmissionDecisionResult,
  health: EchoEvidenceHealthStatus,
): JeditRecoveredEditStatus {
  switch (health) {
    case ECHO_EVIDENCE_HEALTH_CORRUPT:
      return JEDIT_RECOVERED_EDIT_ERROR;
    case ECHO_EVIDENCE_HEALTH_COMPLETE:
      return mapLifecycle(lifecycle, decision);
    case ECHO_EVIDENCE_HEALTH_INCOMPLETE:
    case ECHO_EVIDENCE_HEALTH_MISSING_RETENTION:
    case ECHO_EVIDENCE_HEALTH_REDACTED:
      return JEDIT_RECOVERED_EDIT_INCOMPLETE;
  }
  return unsupportedEvidenceHealth(health);
}

function mapLifecycle(
  lifecycle: EchoSubmissionLifecycleStatus,
  decision: EchoSubmissionDecisionResult,
): JeditRecoveredEditStatus {
  switch (lifecycle) {
    case ECHO_SUBMISSION_LIFECYCLE_NOT_FOUND:
      return JEDIT_RECOVERED_EDIT_UNKNOWN;
    case ECHO_SUBMISSION_LIFECYCLE_ACCEPTED_PENDING:
      return JEDIT_RECOVERED_EDIT_PENDING;
    case ECHO_SUBMISSION_LIFECYCLE_ACCEPTED_DECIDING:
      return JEDIT_RECOVERED_EDIT_PROCESSING;
    case ECHO_SUBMISSION_LIFECYCLE_DECIDED:
      return mapDecision(decision);
  }
  return unsupportedProtocolState();
}

function mapDecision(decision: EchoSubmissionDecisionResult): JeditRecoveredEditStatus {
  switch (decision) {
    case ECHO_SUBMISSION_DECISION_APPLIED:
      return JEDIT_RECOVERED_EDIT_APPLIED;
    case ECHO_SUBMISSION_DECISION_REJECTED:
      return JEDIT_RECOVERED_EDIT_REJECTED;
    case ECHO_SUBMISSION_DECISION_OBSTRUCTED:
      return JEDIT_RECOVERED_EDIT_BLOCKED;
    case ECHO_SUBMISSION_DECISION_NONE:
      return JEDIT_RECOVERED_EDIT_INCOMPLETE;
  }
  return unsupportedProtocolState();
}

function reasonForStatus(status: JeditRecoveredEditStatus): string {
  if (status === JEDIT_RECOVERED_EDIT_APPLIED) {
    return JEDIT_RECOVERED_EDIT_REASON_COMPLETE;
  }
  if (status === JEDIT_RECOVERED_EDIT_PENDING) {
    return JEDIT_RECOVERED_EDIT_REASON_PENDING;
  }
  if (status === JEDIT_RECOVERED_EDIT_PROCESSING) {
    return JEDIT_RECOVERED_EDIT_REASON_PROCESSING;
  }
  if (status === JEDIT_RECOVERED_EDIT_UNKNOWN) {
    return JEDIT_RECOVERED_EDIT_REASON_UNKNOWN;
  }
  return nonAppliedReason(status);
}

function nonAppliedReason(status: JeditRecoveredEditStatus): string {
  if (status === JEDIT_RECOVERED_EDIT_REJECTED) {
    return JEDIT_RECOVERED_EDIT_REASON_REJECTED;
  }
  if (status === JEDIT_RECOVERED_EDIT_BLOCKED) {
    return JEDIT_RECOVERED_EDIT_REASON_BLOCKED;
  }
  if (status === JEDIT_RECOVERED_EDIT_ERROR) {
    return JEDIT_RECOVERED_EDIT_REASON_CORRUPT;
  }
  if (status === JEDIT_RECOVERED_EDIT_UNSUPPORTED) {
    return JEDIT_RECOVERED_EDIT_REASON_UNSUPPORTED;
  }
  return JEDIT_RECOVERED_EDIT_REASON_INCOMPLETE;
}

function unsupportedEvidenceHealth(health: never): JeditRecoveredEditStatus {
  return unsupportedProtocolState(health);
}

function unsupportedProtocolState(): JeditRecoveredEditStatus;
function unsupportedProtocolState(state: never): JeditRecoveredEditStatus;
function unsupportedProtocolState(): JeditRecoveredEditStatus {
  return JEDIT_RECOVERED_EDIT_UNSUPPORTED;
}
