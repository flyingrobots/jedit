import type {
  JeditIntentHandle,
  JeditIntentOutcome,
} from './jedit-intent-outcomes.js';
import type { JeditRestartWitnessPosture } from './jedit-restart-witness.js';

export interface JeditRestartRecoveryPort {
  loadSubmissionPosture(
    intent: JeditIntentHandle,
    outcome: JeditIntentOutcome,
  ): JeditRestartWitnessPosture;
}
