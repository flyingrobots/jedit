export const JEDIT_RESTART_POSTURE_PARTIAL = 'PARTIAL';
export const JEDIT_RESTART_STATE_OWNER_PROCESS_LOCAL_HANDLER = 'PROCESS_LOCAL_HANDLER_STATE';
export const JEDIT_ECHO_HOSTED_STATE_POSTURE_EVIDENCE_ONLY = 'ECHO_PACKAGE_AND_EVIDENCE_ONLY';
export const JEDIT_DURABILITY_POSTURE_UNAVAILABLE = 'UNAVAILABLE';
export const JEDIT_DURABILITY_OBSTRUCTION_CODE = 'DURABLE_ACCEPTED_SUBMISSION_RECOVERY_UNAVAILABLE';

export interface JeditDurabilityObstruction {
  readonly code: typeof JEDIT_DURABILITY_OBSTRUCTION_CODE;
  readonly reason: string;
}

export interface JeditRestartPosture {
  readonly status: typeof JEDIT_RESTART_POSTURE_PARTIAL;
  readonly stateOwner: typeof JEDIT_RESTART_STATE_OWNER_PROCESS_LOCAL_HANDLER;
  readonly echoHostedStatePosture: typeof JEDIT_ECHO_HOSTED_STATE_POSTURE_EVIDENCE_ONLY;
  readonly acceptedSubmissionRecovery: typeof JEDIT_DURABILITY_POSTURE_UNAVAILABLE;
  readonly halfAcceptedSubmissionClaimed: false;
  readonly obstruction: JeditDurabilityObstruction;
}
