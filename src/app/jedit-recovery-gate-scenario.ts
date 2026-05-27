import {
  ECHO_RECOVERY_PORT_AVAILABLE,
} from '../ports/echo-recovery.js';
import { mapEchoRecoveryToRecoveredEditPosture } from './echo-recovery-posture.js';
import { legacyFallbackStatusFromTripwire } from './jedit-local-fallback-tripwire.js';
import { readRecoveredBoundedReading } from './jedit-recovered-bounded-reading.js';
import {
  createJeditRecoveryEvidenceReport,
  extractJeditEchoRecoveryEvidenceFields,
} from './jedit-recovery-evidence-report.js';
import {
  JEDIT_RECOVERY_GATE_SCENARIO_BLOCKED,
  JEDIT_RECOVERY_GATE_SCENARIO_READY,
  type JeditRecoveryGateScenarioInput,
  type JeditRecoveryGateScenarioResult,
} from '../ports/jedit-recovery-gate-scenario.js';

export async function runJeditRecoveryGateScenario(
  input: JeditRecoveryGateScenarioInput,
): Promise<JeditRecoveryGateScenarioResult> {
  const recovery = await input.recovery.readExternalAppRecoveryGate({
    submissionId: input.identity.submissionId,
    canonicalEnvelopeDigest: input.identity.canonicalEnvelopeDigest,
    reading: input.reading,
  });
  if (recovery.status !== ECHO_RECOVERY_PORT_AVAILABLE) {
    return {
      status: JEDIT_RECOVERY_GATE_SCENARIO_BLOCKED,
      diagnostic: recovery.diagnostic,
    };
  }
  const recoveredEdit = mapEchoRecoveryToRecoveredEditPosture(recovery.report);
  const legacyFallbackStatus = legacyFallbackStatusFromTripwire(input.tripwire.snapshot());
  const echo = extractJeditEchoRecoveryEvidenceFields(
    recovery.report,
    recoveredEdit,
    legacyFallbackStatus,
  );
  return {
    status: JEDIT_RECOVERY_GATE_SCENARIO_READY,
    report: createJeditRecoveryEvidenceReport({
      identity: input.identity,
      recoveredEdit,
      echo,
      legacyFallbackStatus,
    }),
    recoveredReading: readRecoveredBoundedReading(recovery.report),
  };
}
