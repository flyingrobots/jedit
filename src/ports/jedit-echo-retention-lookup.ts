import type {
  JeditRetainedEvidenceRef,
  JeditRetentionObstruction,
} from './jedit-retained-evidence.js';

export const JEDIT_ECHO_RETENTION_LOOKUP_HIT = 'ECHO_RETENTION_LOOKUP_HIT';
export const JEDIT_ECHO_RETENTION_LOOKUP_MISSING = 'ECHO_RETENTION_LOOKUP_MISSING';

export interface JeditEchoRetainedMaterialRecord {
  readonly byteHash: string;
  readonly materialBytesHex: string;
}

export interface JeditEchoRetentionLookupPort {
  lookupRetainedEvidence(ref: JeditRetainedEvidenceRef): JeditEchoRetentionLookupResult;
}

export interface JeditEchoRetentionLookupHit {
  readonly status: typeof JEDIT_ECHO_RETENTION_LOOKUP_HIT;
  readonly ref: JeditRetainedEvidenceRef;
  readonly materialBytesHex: string;
}

export interface JeditEchoRetentionLookupMissing {
  readonly status: typeof JEDIT_ECHO_RETENTION_LOOKUP_MISSING;
  readonly ref: JeditRetainedEvidenceRef;
  readonly obstruction: JeditRetentionObstruction;
}

export type JeditEchoRetentionLookupResult =
  | JeditEchoRetentionLookupHit
  | JeditEchoRetentionLookupMissing;
