import type {
  EchoRecoveryDiagnostic,
  EchoRecoveryPort,
  EchoRecoveryReadingChainRequest,
} from './echo-recovery.js';
import type { JeditEditSubmissionIdentity } from './jedit-edit-submission-identity.js';
import type { JeditLocalFallbackTripwire } from './jedit-local-fallback-tripwire.js';
import type { JeditRecoveryEvidenceReport } from './jedit-recovery-evidence-report.js';
import type { JeditRecoveredBoundedReadingResult } from './jedit-recovered-bounded-reading.js';

export const JEDIT_RECOVERY_GATE_SCENARIO_READY = 'JEDIT_RECOVERY_GATE_SCENARIO_READY';
export const JEDIT_RECOVERY_GATE_SCENARIO_BLOCKED = 'JEDIT_RECOVERY_GATE_SCENARIO_BLOCKED';

export interface JeditRecoveryGateScenarioInput {
  readonly recovery: EchoRecoveryPort;
  readonly identity: JeditEditSubmissionIdentity;
  readonly reading: EchoRecoveryReadingChainRequest;
  readonly tripwire: JeditLocalFallbackTripwire;
}

export interface JeditRecoveryGateScenarioReady {
  readonly status: typeof JEDIT_RECOVERY_GATE_SCENARIO_READY;
  readonly report: JeditRecoveryEvidenceReport;
  readonly recoveredReading: JeditRecoveredBoundedReadingResult;
}

export interface JeditRecoveryGateScenarioBlocked {
  readonly status: typeof JEDIT_RECOVERY_GATE_SCENARIO_BLOCKED;
  readonly diagnostic: EchoRecoveryDiagnostic;
}

export type JeditRecoveryGateScenarioResult =
  | JeditRecoveryGateScenarioReady
  | JeditRecoveryGateScenarioBlocked;
