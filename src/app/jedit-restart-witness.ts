export {
  JEDIT_RESTART_WITNESS_DECIDED,
  JEDIT_RESTART_WITNESS_HALF_ACCEPTED_BLOCKED,
  JEDIT_RESTART_WITNESS_HALF_ACCEPTED_OBSTRUCTION_CODE,
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
  JEDIT_RESTART_WITNESS_HALF_ACCEPTED_OBSTRUCTION_CODE,
  JEDIT_RESTART_WITNESS_PENDING,
  JEDIT_RESTART_WITNESS_REJECTED,
  JEDIT_RESTART_WITNESS_UNKNOWN,
  type JeditRestartWitnessPosture,
} from '../ports/jedit-restart-witness.js';
import {
  JEDIT_SUBMISSION_LEDGER_READ_MISSING,
  type JeditSubmissionLedgerPort,
} from '../ports/jedit-submission-ledger.js';

type JeditRestartOutcomeRecovery = (
  intent: JeditIntentHandle,
  outcome: JeditIntentOutcome,
) => JeditRestartWitnessPosture;

const MISSING_SUBMISSION_READ_STATUSES: ReadonlySet<string> = new Set([
  JEDIT_SUBMISSION_LEDGER_READ_MISSING,
]);
const UNKNOWN_OUTCOME_STATUSES: ReadonlySet<string> = new Set([
  JEDIT_INTENT_OUTCOME_UNKNOWN,
]);
const KNOWN_SUBMISSION_RECOVERY_BY_OUTCOME_STATUS: ReadonlyMap<string, JeditRestartOutcomeRecovery> = new Map([
  [JEDIT_INTENT_OUTCOME_ACCEPTED_PENDING, pendingPosture],
  [JEDIT_INTENT_OUTCOME_APPLIED, decidedPosture],
  [JEDIT_INTENT_OUTCOME_REJECTED, rejectedOutcomePosture],
  [JEDIT_INTENT_OUTCOME_OBSTRUCTED, obstructedOutcomePosture],
  [JEDIT_INTENT_OUTCOME_UNKNOWN, pendingPosture],
]);

export function recoverJeditSubmissionAfterRestart(
  ledger: JeditSubmissionLedgerPort,
  intent: JeditIntentHandle,
  outcome: JeditIntentOutcome,
): JeditRestartWitnessPosture {
  const read = ledger.readSubmission(intent.submissionId);
  if (MISSING_SUBMISSION_READ_STATUSES.has(read.status)) {
    return UNKNOWN_OUTCOME_STATUSES.has(outcome.status)
      ? unknownPosture(intent)
      : halfAcceptedPosture(intent);
  }

  return knownSubmissionPosture(intent, outcome);
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

function knownSubmissionPosture(
  intent: JeditIntentHandle,
  outcome: JeditIntentOutcome,
): JeditRestartWitnessPosture {
  return KNOWN_SUBMISSION_RECOVERY_BY_OUTCOME_STATUS.get(outcome.status)?.(intent, outcome)
    ?? pendingPosture(intent);
}

function decidedPosture(
  intent: JeditIntentHandle,
  outcome: JeditIntentOutcome,
): JeditRestartWitnessPosture {
  if (!('receipt' in outcome)) {
    return halfAcceptedPosture(intent);
  }
  return {
    status: JEDIT_RESTART_WITNESS_DECIDED,
    submissionId: intent.submissionId,
    receipt: outcome.receipt,
  };
}

function rejectedOutcomePosture(
  intent: JeditIntentHandle,
  outcome: JeditIntentOutcome,
): JeditRestartWitnessPosture {
  return 'reason' in outcome
    ? rejectedPosture(intent, outcome.reason)
    : halfAcceptedPosture(intent);
}

function obstructedOutcomePosture(
  intent: JeditIntentHandle,
  outcome: JeditIntentOutcome,
): JeditRestartWitnessPosture {
  return 'obstructionCode' in outcome
    ? rejectedPosture(intent, outcome.obstructionCode)
    : halfAcceptedPosture(intent);
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
    obstructionCode: JEDIT_RESTART_WITNESS_HALF_ACCEPTED_OBSTRUCTION_CODE,
  };
}
