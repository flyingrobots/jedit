export const JEDIT_RECOVERED_READING_AVAILABLE = 'JEDIT_RECOVERED_READING_AVAILABLE';
export const JEDIT_RECOVERED_READING_INCOMPLETE = 'JEDIT_RECOVERED_READING_INCOMPLETE';
export const JEDIT_RECOVERED_READING_NOT_REQUESTED = 'JEDIT_RECOVERED_READING_NOT_REQUESTED';

export interface JeditRecoveredBoundedReading {
  readonly readingId: string;
  readonly basisDigest: string;
  readonly readingBasisDigest: string;
  readonly semanticCoordinateDigest: string;
  readonly readingSource: string;
  readonly readingAuthority: string;
}

export interface JeditRecoveredReadingAvailable {
  readonly status: typeof JEDIT_RECOVERED_READING_AVAILABLE;
  readonly reading: JeditRecoveredBoundedReading;
}

export interface JeditRecoveredReadingIncomplete {
  readonly status: typeof JEDIT_RECOVERED_READING_INCOMPLETE;
  readonly reason: string;
}

export interface JeditRecoveredReadingNotRequested {
  readonly status: typeof JEDIT_RECOVERED_READING_NOT_REQUESTED;
}

export type JeditRecoveredBoundedReadingResult =
  | JeditRecoveredReadingAvailable
  | JeditRecoveredReadingIncomplete
  | JeditRecoveredReadingNotRequested;
