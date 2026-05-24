import type { JeditReceiptHandle } from './jedit-intent-outcomes.js';

export const JEDIT_RESTART_WITNESS_PENDING = 'JEDIT_RESTART_WITNESS_PENDING';
export const JEDIT_RESTART_WITNESS_DECIDED = 'JEDIT_RESTART_WITNESS_DECIDED';
export const JEDIT_RESTART_WITNESS_REJECTED = 'JEDIT_RESTART_WITNESS_REJECTED';
export const JEDIT_RESTART_WITNESS_UNKNOWN = 'JEDIT_RESTART_WITNESS_UNKNOWN';
export const JEDIT_RESTART_WITNESS_HALF_ACCEPTED_BLOCKED = 'JEDIT_RESTART_WITNESS_HALF_ACCEPTED_BLOCKED';
export const JEDIT_RESTART_WITNESS_HALF_ACCEPTED_OBSTRUCTION_CODE = 'JEDIT_HALF_ACCEPTED_SUBMISSION_BLOCKED';

export interface JeditRestartWitnessPending {
  readonly status: typeof JEDIT_RESTART_WITNESS_PENDING;
  readonly submissionId: string;
}

export interface JeditRestartWitnessDecided {
  readonly status: typeof JEDIT_RESTART_WITNESS_DECIDED;
  readonly submissionId: string;
  readonly receipt: JeditReceiptHandle;
}

export interface JeditRestartWitnessRejected {
  readonly status: typeof JEDIT_RESTART_WITNESS_REJECTED;
  readonly submissionId: string;
  readonly reason: string;
}

export interface JeditRestartWitnessUnknown {
  readonly status: typeof JEDIT_RESTART_WITNESS_UNKNOWN;
  readonly submissionId: string;
}

export interface JeditRestartWitnessHalfAcceptedBlocked {
  readonly status: typeof JEDIT_RESTART_WITNESS_HALF_ACCEPTED_BLOCKED;
  readonly submissionId: string;
  readonly obstructionCode: typeof JEDIT_RESTART_WITNESS_HALF_ACCEPTED_OBSTRUCTION_CODE;
}

export type JeditRestartWitnessPosture =
  | JeditRestartWitnessPending
  | JeditRestartWitnessDecided
  | JeditRestartWitnessRejected
  | JeditRestartWitnessUnknown
  | JeditRestartWitnessHalfAcceptedBlocked;
