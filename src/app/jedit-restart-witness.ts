export {
  JEDIT_RESTART_WITNESS_DECIDED,
  JEDIT_RESTART_WITNESS_HALF_ACCEPTED_BLOCKED,
  JEDIT_RESTART_WITNESS_PENDING,
  JEDIT_RESTART_WITNESS_REJECTED,
  JEDIT_RESTART_WITNESS_UNKNOWN,
} from '../ports/jedit-restart-witness.js';
import {
  JEDIT_INTENT_OUTCOME_ACCEPTED_PENDING,
  JEDIT_INTENT_OUTCOME_APPLIED,
  JEDIT_INTENT_OUTCOME_OBSTRUCTED,
  JEDIT_INTENT_OUTCOME_REJECTED,
  JEDIT_INTENT_OUTCOME_UNKNOWN,
  type JeditIntentHandle,
  type JeditIntentOutcome,
} from '../ports/jedit-intent-outcomes.js';
import {
  JEDIT_RESTART_WITNESS_DECIDED,
  JEDIT_RESTART_WITNESS_HALF_ACCEPTED_BLOCKED,
  JEDIT_RESTART_WITNESS_PENDING,
  JEDIT_RESTART_WITNESS_REJECTED,
  JEDIT_RESTART_WITNESS_UNKNOWN,
  type JeditRestartWitnessPosture,
} from '../ports/jedit-restart-witness.js';
import {
  JEDIT_SUBMISSION_LEDGER_READ_MISSING,
  type JeditSubmissionLedgerPort,
} from '../ports/jedit-submission-ledger.js';

const HALF_ACCEPTED_OBSTRUCTION_CODE = 'JEDIT_HALF_ACCEPTED_SUBMISSION_BLOCKED';

export function recoverJeditSubmissionAfterRestart(
  ledger: JeditSubmissionLedgerPort,
  intent: JeditIntentHandle,
  outcome: JeditIntentOutcome,
): JeditRestartWitnessPosture {
  const read = ledger.readSubmission(intent.submissionId);
  if (read.status === JEDIT_SUBMISSION_LEDGER_READ_MISSING) {
    return outcome.status === JEDIT_INTENT_OUTCOME_UNKNOWN
      ? unknownPosture(intent)
      : halfAcceptedPosture(intent);
  }

  switch (outcome.status) {
    case JEDIT_INTENT_OUTCOME_ACCEPTED_PENDING:
      return pendingPosture(intent);
    case JEDIT_INTENT_OUTCOME_APPLIED:
      return {
        status: JEDIT_RESTART_WITNESS_DECIDED,
        submissionId: intent.submissionId,
        receipt: outcome.receipt,
      };
    case JEDIT_INTENT_OUTCOME_REJECTED:
      return rejectedPosture(intent, outcome.reason);
    case JEDIT_INTENT_OUTCOME_OBSTRUCTED:
      return rejectedPosture(intent, outcome.obstructionCode);
    case JEDIT_INTENT_OUTCOME_UNKNOWN:
      return pendingPosture(intent);
  }
}

function pendingPosture(intent: JeditIntentHandle): JeditRestartWitnessPosture {
  return {
    status: JEDIT_RESTART_WITNESS_PENDING,
    submissionId: intent.submissionId,
  };
}

function rejectedPosture(
  intent: JeditIntentHandle,
  reason: string,
): JeditRestartWitnessPosture {
  return {
    status: JEDIT_RESTART_WITNESS_REJECTED,
    submissionId: intent.submissionId,
    reason,
  };
}

function unknownPosture(intent: JeditIntentHandle): JeditRestartWitnessPosture {
  return {
    status: JEDIT_RESTART_WITNESS_UNKNOWN,
    submissionId: intent.submissionId,
  };
}

function halfAcceptedPosture(intent: JeditIntentHandle): JeditRestartWitnessPosture {
  return {
    status: JEDIT_RESTART_WITNESS_HALF_ACCEPTED_BLOCKED,
    submissionId: intent.submissionId,
    obstructionCode: HALF_ACCEPTED_OBSTRUCTION_CODE,
  };
}
