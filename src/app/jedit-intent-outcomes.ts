export {
  createJeditIntentHandle,
  createJeditReceiptHandle,
  JEDIT_INTENT_OUTCOME_ACCEPTED_PENDING,
  JEDIT_INTENT_OUTCOME_APPLIED,
  JEDIT_INTENT_OUTCOME_OBSTRUCTED,
  JEDIT_INTENT_OUTCOME_REJECTED,
  JEDIT_INTENT_OUTCOME_UNKNOWN,
} from '../ports/jedit-intent-outcomes.js';
import {
  JEDIT_INTENT_OUTCOME_ACCEPTED_PENDING,
  JEDIT_INTENT_OUTCOME_APPLIED,
  JEDIT_INTENT_OUTCOME_OBSTRUCTED,
  JEDIT_INTENT_OUTCOME_REJECTED,
  JEDIT_INTENT_OUTCOME_UNKNOWN,
  type JeditAcceptedPendingIntentOutcome,
  type JeditAppliedIntentOutcome,
  type JeditIntentHandle,
  type JeditIntentOutcome,
  type JeditObstructedIntentOutcome,
  type JeditReceiptHandle,
  type JeditRejectedIntentOutcome,
} from '../ports/jedit-intent-outcomes.js';

export interface JeditIntentOutcomeLedger {
  acceptIntent(intent: JeditIntentHandle): JeditAcceptedPendingIntentOutcome;
  applyIntent(
    intent: JeditIntentHandle,
    receipt: JeditReceiptHandle,
  ): JeditAppliedIntentOutcome;
  rejectIntent(intent: JeditIntentHandle, reason: string): JeditRejectedIntentOutcome;
  obstructIntent(
    intent: JeditIntentHandle,
    obstructionCode: string,
  ): JeditObstructedIntentOutcome;
  observeIntent(intent: JeditIntentHandle): JeditIntentOutcome;
}

export function createJeditIntentOutcomeLedger(): JeditIntentOutcomeLedger {
  const outcomes = new Map<string, JeditIntentOutcome>();

  return {
    acceptIntent(intent) {
      return recordOutcome(outcomes, acceptedOutcome(intent));
    },
    applyIntent(intent, receipt) {
      return recordOutcome(outcomes, appliedOutcome(intent, receipt));
    },
    rejectIntent(intent, reason) {
      return recordOutcome(outcomes, rejectedOutcome(intent, reason));
    },
    obstructIntent(intent, obstructionCode) {
      return recordOutcome(outcomes, obstructedOutcome(intent, obstructionCode));
    },
    observeIntent(intent) {
      return outcomes.get(intent.submissionId) ?? {
        status: JEDIT_INTENT_OUTCOME_UNKNOWN,
        intent,
      };
    },
  };
}

function recordOutcome<T extends JeditIntentOutcome>(
  outcomes: Map<string, JeditIntentOutcome>,
  outcome: T,
): T {
  outcomes.set(outcome.intent.submissionId, outcome);
  return outcome;
}

function acceptedOutcome(intent: JeditIntentHandle): JeditAcceptedPendingIntentOutcome {
  return {
    status: JEDIT_INTENT_OUTCOME_ACCEPTED_PENDING,
    intent,
  };
}

function appliedOutcome(
  intent: JeditIntentHandle,
  receipt: JeditReceiptHandle,
): JeditAppliedIntentOutcome {
  return {
    status: JEDIT_INTENT_OUTCOME_APPLIED,
    intent,
    receipt,
  };
}

function rejectedOutcome(intent: JeditIntentHandle, reason: string): JeditRejectedIntentOutcome {
  return {
    status: JEDIT_INTENT_OUTCOME_REJECTED,
    intent,
    reason,
  };
}

function obstructedOutcome(
  intent: JeditIntentHandle,
  obstructionCode: string,
): JeditObstructedIntentOutcome {
  return {
    status: JEDIT_INTENT_OUTCOME_OBSTRUCTED,
    intent,
    obstructionCode,
  };
}
