export const JEDIT_LOCAL_FALLBACK_TRIPWIRE_ENFORCED = 'enforced';
export const JEDIT_LOCAL_FALLBACK_TRIPWIRE_DISABLED = 'disabled';

export const JEDIT_LOCAL_FALLBACK_TRIPWIRE_CLEAR = 'clear';
export const JEDIT_LOCAL_FALLBACK_TRIPWIRE_TRIPPED = 'tripped';
export const JEDIT_LOCAL_FALLBACK_TRIPWIRE_IGNORED = 'ignored';

export interface JeditLocalFallbackTripwireConfig {
  readonly mode:
    | typeof JEDIT_LOCAL_FALLBACK_TRIPWIRE_ENFORCED
    | typeof JEDIT_LOCAL_FALLBACK_TRIPWIRE_DISABLED;
}

export interface JeditLocalFallbackAttempt {
  readonly code: string;
  readonly message: string;
}

export interface JeditLocalFallbackTripwireSnapshot {
  readonly mode:
    | typeof JEDIT_LOCAL_FALLBACK_TRIPWIRE_ENFORCED
    | typeof JEDIT_LOCAL_FALLBACK_TRIPWIRE_DISABLED;
  readonly status:
    | typeof JEDIT_LOCAL_FALLBACK_TRIPWIRE_CLEAR
    | typeof JEDIT_LOCAL_FALLBACK_TRIPWIRE_TRIPPED
    | typeof JEDIT_LOCAL_FALLBACK_TRIPWIRE_IGNORED;
  readonly attempts: readonly JeditLocalFallbackAttempt[];
}

export interface JeditLocalFallbackTripwire {
  recordLocalFallbackAttempt(
    attempt: JeditLocalFallbackAttempt,
  ): JeditLocalFallbackTripwireSnapshot;
  snapshot(): JeditLocalFallbackTripwireSnapshot;
}
