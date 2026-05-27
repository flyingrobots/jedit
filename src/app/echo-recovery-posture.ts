import {
  ECHO_EVIDENCE_HEALTH_COMPLETE,
  ECHO_EVIDENCE_HEALTH_CORRUPT,
  ECHO_SUBMISSION_DECISION_APPLIED,
  ECHO_SUBMISSION_DECISION_NONE,
  ECHO_SUBMISSION_DECISION_OBSTRUCTED,
  ECHO_SUBMISSION_DECISION_REJECTED,
  ECHO_SUBMISSION_LIFECYCLE_ACCEPTED_DECIDING,
  ECHO_SUBMISSION_LIFECYCLE_ACCEPTED_PENDING,
  ECHO_SUBMISSION_LIFECYCLE_DECIDED,
  ECHO_SUBMISSION_LIFECYCLE_NOT_FOUND,
  type EchoRecoveryGateReport,
} from '../ports/echo-recovery.js';
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

const COMPLETE_REASON = 'echo_recovery_complete';
const PENDING_REASON = 'echo_accepted_pending';
const PROCESSING_REASON = 'echo_accepted_deciding';
const UNKNOWN_REASON = 'echo_submission_not_found';
const REJECTED_REASON = 'echo_decision_rejected';
const BLOCKED_REASON = 'echo_decision_obstructed';
const INCOMPLETE_REASON = 'echo_recovery_incomplete';
const CORRUPT_REASON = 'echo_recovery_corrupt_or_untrusted';
const UNSUPPORTED_REASON = 'unsupported_echo_posture';

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

function mapStatus(lifecycle: string, decision: string, health: string): JeditRecoveredEditStatus {
  if (health === ECHO_EVIDENCE_HEALTH_CORRUPT) {
    return JEDIT_RECOVERED_EDIT_ERROR;
  }
  if (health !== ECHO_EVIDENCE_HEALTH_COMPLETE) {
    return JEDIT_RECOVERED_EDIT_INCOMPLETE;
  }
  if (lifecycle === ECHO_SUBMISSION_LIFECYCLE_NOT_FOUND) {
    return JEDIT_RECOVERED_EDIT_UNKNOWN;
  }
  if (lifecycle === ECHO_SUBMISSION_LIFECYCLE_ACCEPTED_PENDING) {
    return JEDIT_RECOVERED_EDIT_PENDING;
  }
  if (lifecycle === ECHO_SUBMISSION_LIFECYCLE_ACCEPTED_DECIDING) {
    return JEDIT_RECOVERED_EDIT_PROCESSING;
  }
  if (lifecycle !== ECHO_SUBMISSION_LIFECYCLE_DECIDED) {
    return JEDIT_RECOVERED_EDIT_UNSUPPORTED;
  }
  return mapDecision(decision);
}

function mapDecision(decision: string): JeditRecoveredEditStatus {
  if (decision === ECHO_SUBMISSION_DECISION_APPLIED) {
    return JEDIT_RECOVERED_EDIT_APPLIED;
  }
  if (decision === ECHO_SUBMISSION_DECISION_REJECTED) {
    return JEDIT_RECOVERED_EDIT_REJECTED;
  }
  if (decision === ECHO_SUBMISSION_DECISION_OBSTRUCTED) {
    return JEDIT_RECOVERED_EDIT_BLOCKED;
  }
  if (decision === ECHO_SUBMISSION_DECISION_NONE) {
    return JEDIT_RECOVERED_EDIT_INCOMPLETE;
  }
  return JEDIT_RECOVERED_EDIT_UNSUPPORTED;
}

function reasonForStatus(status: JeditRecoveredEditStatus): string {
  if (status === JEDIT_RECOVERED_EDIT_APPLIED) {
    return COMPLETE_REASON;
  }
  if (status === JEDIT_RECOVERED_EDIT_PENDING) {
    return PENDING_REASON;
  }
  if (status === JEDIT_RECOVERED_EDIT_PROCESSING) {
    return PROCESSING_REASON;
  }
  if (status === JEDIT_RECOVERED_EDIT_UNKNOWN) {
    return UNKNOWN_REASON;
  }
  return nonAppliedReason(status);
}

function nonAppliedReason(status: JeditRecoveredEditStatus): string {
  if (status === JEDIT_RECOVERED_EDIT_REJECTED) {
    return REJECTED_REASON;
  }
  if (status === JEDIT_RECOVERED_EDIT_BLOCKED) {
    return BLOCKED_REASON;
  }
  if (status === JEDIT_RECOVERED_EDIT_ERROR) {
    return CORRUPT_REASON;
  }
  if (status === JEDIT_RECOVERED_EDIT_UNSUPPORTED) {
    return UNSUPPORTED_REASON;
  }
  return INCOMPLETE_REASON;
}
