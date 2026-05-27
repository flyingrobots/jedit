import {
  JEDIT_LEGACY_FALLBACK_DETECTED,
  JEDIT_LEGACY_FALLBACK_NOT_DETECTED,
} from '../ports/jedit-recovery-evidence-report.js';
import {
  JEDIT_LOCAL_FALLBACK_TRIPWIRE_CLEAR,
  JEDIT_LOCAL_FALLBACK_TRIPWIRE_DISABLED,
  JEDIT_LOCAL_FALLBACK_TRIPWIRE_ENFORCED,
  JEDIT_LOCAL_FALLBACK_TRIPWIRE_IGNORED,
  JEDIT_LOCAL_FALLBACK_TRIPWIRE_TRIPPED,
  type JeditLocalFallbackAttempt,
  type JeditLocalFallbackTripwire,
  type JeditLocalFallbackTripwireConfig,
  type JeditLocalFallbackTripwireSnapshot,
} from '../ports/jedit-local-fallback-tripwire.js';

export function createJeditLocalFallbackTripwire(
  config: JeditLocalFallbackTripwireConfig,
): JeditLocalFallbackTripwire {
  const attempts: JeditLocalFallbackAttempt[] = [];

  return {
    recordLocalFallbackAttempt(attempt) {
      attempts.push(attempt);
      return snapshot(config, attempts);
    },
    snapshot() {
      return snapshot(config, attempts);
    },
  };
}

export function legacyFallbackStatusFromTripwire(
  snapshotValue: JeditLocalFallbackTripwireSnapshot,
) {
  return snapshotValue.status === JEDIT_LOCAL_FALLBACK_TRIPWIRE_TRIPPED
    || snapshotValue.status === JEDIT_LOCAL_FALLBACK_TRIPWIRE_IGNORED
    ? JEDIT_LEGACY_FALLBACK_DETECTED
    : JEDIT_LEGACY_FALLBACK_NOT_DETECTED;
}

function snapshot(
  config: JeditLocalFallbackTripwireConfig,
  attempts: readonly JeditLocalFallbackAttempt[],
): JeditLocalFallbackTripwireSnapshot {
  return {
    mode: config.mode,
    status: statusForSnapshot(config, attempts),
    attempts: [...attempts],
  };
}

function statusForSnapshot(
  config: JeditLocalFallbackTripwireConfig,
  attempts: readonly JeditLocalFallbackAttempt[],
) {
  if (config.mode === JEDIT_LOCAL_FALLBACK_TRIPWIRE_DISABLED) {
    return attempts.length === 0
      ? JEDIT_LOCAL_FALLBACK_TRIPWIRE_CLEAR
      : JEDIT_LOCAL_FALLBACK_TRIPWIRE_IGNORED;
  }
  if (config.mode === JEDIT_LOCAL_FALLBACK_TRIPWIRE_ENFORCED) {
    return attempts.length === 0
      ? JEDIT_LOCAL_FALLBACK_TRIPWIRE_CLEAR
      : JEDIT_LOCAL_FALLBACK_TRIPWIRE_TRIPPED;
  }
  return JEDIT_LOCAL_FALLBACK_TRIPWIRE_TRIPPED;
}
