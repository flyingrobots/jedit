export const JEDIT_RECOVERED_EDIT_UNKNOWN = 'edit_unknown';
export const JEDIT_RECOVERED_EDIT_PENDING = 'edit_pending';
export const JEDIT_RECOVERED_EDIT_PROCESSING = 'edit_processing';
export const JEDIT_RECOVERED_EDIT_APPLIED = 'edit_applied';
export const JEDIT_RECOVERED_EDIT_REJECTED = 'edit_rejected';
export const JEDIT_RECOVERED_EDIT_BLOCKED = 'edit_blocked';
export const JEDIT_RECOVERED_EDIT_INCOMPLETE = 'edit_recovery_incomplete';
export const JEDIT_RECOVERED_EDIT_ERROR = 'echo_recovery_error';
export const JEDIT_RECOVERED_EDIT_UNSUPPORTED = 'unsupported_echo_posture';

export type JeditRecoveredEditStatus =
  | typeof JEDIT_RECOVERED_EDIT_UNKNOWN
  | typeof JEDIT_RECOVERED_EDIT_PENDING
  | typeof JEDIT_RECOVERED_EDIT_PROCESSING
  | typeof JEDIT_RECOVERED_EDIT_APPLIED
  | typeof JEDIT_RECOVERED_EDIT_REJECTED
  | typeof JEDIT_RECOVERED_EDIT_BLOCKED
  | typeof JEDIT_RECOVERED_EDIT_INCOMPLETE
  | typeof JEDIT_RECOVERED_EDIT_ERROR
  | typeof JEDIT_RECOVERED_EDIT_UNSUPPORTED;

export interface JeditRecoveredEditPosture {
  readonly status: JeditRecoveredEditStatus;
  readonly reason: string;
  readonly echoLifecyclePosture: string;
  readonly echoDecisionResult: string;
  readonly echoEvidenceHealth: string;
}
