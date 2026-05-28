import {
  JEDIT_DURABILITY_OBSTRUCTION_CODE,
  JEDIT_DURABILITY_POSTURE_UNAVAILABLE,
  JEDIT_ECHO_HOSTED_STATE_POSTURE_EVIDENCE_ONLY,
  JEDIT_HALF_ACCEPTED_SUBMISSION_NOT_CLAIMED,
  JEDIT_RESTART_POSTURE_PARTIAL,
  JEDIT_RESTART_STATE_OWNER_PROCESS_LOCAL_HANDLER,
  type JeditRestartPosture,
} from '../ports/jedit-restart-posture.js';

const DURABILITY_UNAVAILABLE_REASON =
  'jedit contract handler state is process-local in this release-gate slice';

export function currentJeditRestartPosture(): JeditRestartPosture {
  return {
    status: JEDIT_RESTART_POSTURE_PARTIAL,
    stateOwner: JEDIT_RESTART_STATE_OWNER_PROCESS_LOCAL_HANDLER,
    echoHostedStatePosture: JEDIT_ECHO_HOSTED_STATE_POSTURE_EVIDENCE_ONLY,
    acceptedSubmissionRecovery: JEDIT_DURABILITY_POSTURE_UNAVAILABLE,
    halfAcceptedSubmissionClaimed: JEDIT_HALF_ACCEPTED_SUBMISSION_NOT_CLAIMED,
    obstruction: {
      code: JEDIT_DURABILITY_OBSTRUCTION_CODE,
      reason: DURABILITY_UNAVAILABLE_REASON,
    },
  };
}
