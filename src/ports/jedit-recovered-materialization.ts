import type { HashPort } from './hash.js';
import type { JeditRecoveredBoundedReadingResult } from './jedit-recovered-bounded-reading.js';

export const JEDIT_RECOVERED_MATERIALIZATION_READY =
  'JEDIT_RECOVERED_MATERIALIZATION_READY';
export const JEDIT_RECOVERED_MATERIALIZATION_BLOCKED =
  'JEDIT_RECOVERED_MATERIALIZATION_BLOCKED';
export const JEDIT_RECOVERED_PAYLOAD_SOURCE_ECHO_READING =
  'echo_recovered_reading';

export interface JeditRecoveredMaterializationPayload {
  readonly source: string;
  readonly text: string;
  readonly textDigest: string;
  readonly readingId: string;
  readonly basisDigest: string;
  readonly readingBasisDigest: string;
  readonly semanticCoordinateDigest: string;
}

export interface JeditRecoveredMaterializationInput {
  readonly recoveredReading: JeditRecoveredBoundedReadingResult;
  readonly payload: JeditRecoveredMaterializationPayload;
  readonly hash: HashPort;
}

export interface JeditRecoveredTextArtifact {
  readonly readingId: string;
  readonly basisDigest: string;
  readonly text: string;
  readonly textDigest: string;
}

export interface JeditRecoveredMaterializationReady {
  readonly status: typeof JEDIT_RECOVERED_MATERIALIZATION_READY;
  readonly artifact: JeditRecoveredTextArtifact;
}

export interface JeditRecoveredMaterializationBlocked {
  readonly status: typeof JEDIT_RECOVERED_MATERIALIZATION_BLOCKED;
  readonly reason: string;
}

export type JeditRecoveredMaterializationResult =
  | JeditRecoveredMaterializationReady
  | JeditRecoveredMaterializationBlocked;
