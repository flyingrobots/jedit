import type {
  JeditIntentHandle,
  JeditIntentOutcome,
} from '../ports/jedit-intent-outcomes.js';
import type { JeditRestartRecoveryPort } from '../ports/jedit-restart-recovery.js';
import type { JeditRestartWitnessPosture } from '../ports/jedit-restart-witness.js';
import type { JeditSubmissionLedgerPort } from '../ports/jedit-submission-ledger.js';
import { recoverJeditSubmissionAfterRestart } from './jedit-restart-witness.js';

export function createJeditRestartRecoveryPort(
  ledger: JeditSubmissionLedgerPort,
): JeditRestartRecoveryPort {
  return {
    loadSubmissionPosture(intent, outcome) {
      return loadSubmissionPosture(ledger, intent, outcome);
    },
  };
}

function loadSubmissionPosture(
  ledger: JeditSubmissionLedgerPort,
  intent: JeditIntentHandle,
  outcome: JeditIntentOutcome,
): JeditRestartWitnessPosture {
  return recoverJeditSubmissionAfterRestart(ledger, intent, outcome);
}
