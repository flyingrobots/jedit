import type { RuntimeIssue } from '@flyingrobots/bijou-tui';
import type { TextRuntimeProfile } from '../text-runtime-profile.js';
import type { WorkspaceWorldlineMaterializationKind } from './worldline-types.js';
import {
  WorkspaceTextAuthorityKinds,
  workspaceTextAuthorityPosture,
  type WorkspaceTextAuthority,
  type WorkspaceTextAuthorityKind,
  type WorkspaceTextHostBasisKind,
  type WorkspaceTextIntentStatus,
} from './workspace-text-authority.js';
import {
  WorkspaceTextReadingPostures,
  type WorkspaceTextReadingCache,
  type WorkspaceTextReadingCoverage,
  type WorkspaceTextReadingPosture,
} from './workspace-text-reading-cache.js';

const SOURCE_LOCAL_EDITOR_PROVENANCE = 'local-editor-provenance';
const SOURCE_LOCAL_TEXT_WINDOW_ENVELOPE = 'local-text-window-envelope';
const SOURCE_RECEIPT_REFERENCE = 'receipt-reference';
const SOURCE_ECHO_READING_ENVELOPE = 'echo-reading-envelope';
const SOURCE_TRANSLATED_EVIDENCE = 'translated-evidence';
const SOURCE_NATIVE_EVIDENCE = 'native-evidence';
const POSTURE_AVAILABLE = 'available';
const POSTURE_MISSING_ENVELOPE = 'missing-envelope';
const POSTURE_STALE_BASIS = 'stale-basis';
const POSTURE_OBSTRUCTED = 'obstructed';
const POSTURE_UNAVAILABLE = 'unavailable';
const NO_READING_ID = 'no-reading';
const NO_BASIS = 'no-basis';

export const JeditWhyEvidenceSourceKinds = Object.freeze({
  LocalEditorProvenance: SOURCE_LOCAL_EDITOR_PROVENANCE,
  LocalTextWindowEnvelope: SOURCE_LOCAL_TEXT_WINDOW_ENVELOPE,
  ReceiptReference: SOURCE_RECEIPT_REFERENCE,
  EchoReadingEnvelope: SOURCE_ECHO_READING_ENVELOPE,
  TranslatedEvidence: SOURCE_TRANSLATED_EVIDENCE,
  NativeEvidence: SOURCE_NATIVE_EVIDENCE,
});

export const JeditWhyEvidencePostures = Object.freeze({
  Available: POSTURE_AVAILABLE,
  MissingEnvelope: POSTURE_MISSING_ENVELOPE,
  StaleBasis: POSTURE_STALE_BASIS,
  Obstructed: POSTURE_OBSTRUCTED,
  Unavailable: POSTURE_UNAVAILABLE,
});

export type JeditWhyEvidenceSourceKind =
  | typeof SOURCE_LOCAL_EDITOR_PROVENANCE
  | typeof SOURCE_LOCAL_TEXT_WINDOW_ENVELOPE
  | typeof SOURCE_RECEIPT_REFERENCE
  | typeof SOURCE_ECHO_READING_ENVELOPE
  | typeof SOURCE_TRANSLATED_EVIDENCE
  | typeof SOURCE_NATIVE_EVIDENCE;

export type JeditWhyEvidencePosture =
  | typeof POSTURE_AVAILABLE
  | typeof POSTURE_MISSING_ENVELOPE
  | typeof POSTURE_STALE_BASIS
  | typeof POSTURE_OBSTRUCTED
  | typeof POSTURE_UNAVAILABLE;

export interface CreateJeditWhyObservationInput {
  readonly basisDigest?: string;
  readonly extraEvidenceSources?: readonly JeditWhyEvidenceSource[];
  readonly target?: JeditWhyObservationTarget;
  readonly textAuthority: WorkspaceTextAuthority;
}

export interface JeditWhyObservation {
  readonly authority: JeditWhyObservationAuthority;
  readonly coordinate: JeditWhyCoordinate;
  readonly evidence: JeditWhyObservationEvidence;
}

export interface JeditWhyCoordinate {
  readonly aperture?: JeditWhyObservationAperture;
  readonly basisDigest?: string;
  readonly bufferId?: string;
  readonly filePath?: string;
  readonly readingId?: string;
  readonly target?: JeditWhyObservationTarget;
}

export interface JeditWhyObservationAperture {
  readonly coverage: WorkspaceTextReadingCoverage;
  readonly cursorLine: number;
  readonly hasMoreAfter: boolean;
  readonly hasMoreBefore: boolean;
  readonly returnedLineCount: number;
  readonly startLine: number;
  readonly totalLineCount: number;
  readonly truncated: boolean;
  readonly viewportLineCount: number;
}

export interface JeditWhyObservationAuthority {
  readonly bufferId?: string;
  readonly dirty?: boolean;
  readonly filePath?: string;
  readonly hostBasis?: WorkspaceTextHostBasisKind;
  readonly kind: WorkspaceTextAuthorityKind;
  readonly materialization?: WorkspaceWorldlineMaterializationKind;
  readonly pendingIntentStatus?: WorkspaceTextIntentStatus;
  readonly profile: TextRuntimeProfile;
  readonly readOnly?: boolean;
  readonly readingPosture: WorkspaceTextReadingPosture;
}

export interface JeditWhyObservationEvidence {
  readonly nativeContinuumWitness: boolean;
  readonly obstruction?: JeditWhyObservationObstruction;
  readonly posture: JeditWhyEvidencePosture;
  readonly sources: readonly JeditWhyEvidenceSource[];
}

export interface JeditWhyEvidenceSource {
  readonly kind: JeditWhyEvidenceSourceKind;
  readonly posture: JeditWhyEvidencePosture;
  readonly referenceId?: string;
}

export interface JeditWhyObservationTarget {
  readonly basisDigest: string;
  readonly rangeEnd: number;
  readonly rangeStart: number;
  readonly shape: string;
}

export interface JeditWhyObservationObstruction {
  readonly level: RuntimeIssue['level'];
  readonly message: string;
  readonly source: RuntimeIssue['source'];
}

export function createJeditWhyObservation(
  input: CreateJeditWhyObservationInput,
): JeditWhyObservation {
  const cache = readingCache(input.textAuthority);
  const posture = evidencePosture(input.textAuthority, cache);
  const sources = evidenceSources(input, cache, posture);
  return {
    authority: observationAuthority(input.textAuthority),
    coordinate: observationCoordinate(input, cache),
    evidence: {
      posture,
      sources,
      nativeContinuumWitness: hasNativeContinuumWitness(sources),
      obstruction: observationObstruction(input.textAuthority),
    },
  };
}

export function jeditWhyObservationMessage(observation: JeditWhyObservation): string {
  const basis = observation.coordinate.basisDigest ?? NO_BASIS;
  const reading = observation.coordinate.readingId ?? NO_READING_ID;
  return `observation: ${observation.evidence.posture} ${observation.authority.kind} ${basis} ${reading}`;
}

function observationAuthority(authority: WorkspaceTextAuthority): JeditWhyObservationAuthority {
  const readingPosture = authorityReadingPosture(authority);
  if (authority.kind === WorkspaceTextAuthorityKinds.Opened) {
    return {
      kind: authority.kind,
      profile: authority.profile,
      filePath: authority.filePath,
      bufferId: authority.bufferId,
      readOnly: authority.readOnly,
      dirty: authority.dirty,
      materialization: authority.materialization,
      hostBasis: authority.hostBasis,
      pendingIntentStatus: authority.pendingIntentStatus,
      readingPosture,
    };
  }
  return {
    kind: authority.kind,
    profile: authority.profile,
    filePath: authority.kind === WorkspaceTextAuthorityKinds.None ? undefined : authority.filePath,
    readingPosture,
  };
}

function observationCoordinate(
  input: CreateJeditWhyObservationInput,
  cache: WorkspaceTextReadingCache | undefined,
): JeditWhyCoordinate {
  return {
    basisDigest: input.basisDigest,
    filePath: authorityFilePath(input.textAuthority),
    bufferId: authorityBufferId(input.textAuthority),
    readingId: cache?.readingId,
    aperture: cache == null ? undefined : apertureFromCache(cache),
    target: input.target,
  };
}

function evidenceSources(
  input: CreateJeditWhyObservationInput,
  cache: WorkspaceTextReadingCache | undefined,
  posture: JeditWhyEvidencePosture,
): readonly JeditWhyEvidenceSource[] {
  return [
    evidenceSource(SOURCE_LOCAL_EDITOR_PROVENANCE, POSTURE_AVAILABLE, input.basisDigest),
    ...authorityEvidenceSources(input.textAuthority, cache, posture),
    ...receiptEvidenceSources(input.textAuthority),
    ...extraEvidenceSources(input.extraEvidenceSources),
  ];
}

function authorityEvidenceSources(
  authority: WorkspaceTextAuthority,
  cache: WorkspaceTextReadingCache | undefined,
  posture: JeditWhyEvidencePosture,
): readonly JeditWhyEvidenceSource[] {
  const readingId = cache?.readingId;
  if (authority.kind !== WorkspaceTextAuthorityKinds.Opened || readingId == null) {
    return [evidenceSource(SOURCE_LOCAL_TEXT_WINDOW_ENVELOPE, posture)];
  }
  return [evidenceSource(SOURCE_LOCAL_TEXT_WINDOW_ENVELOPE, posture, readingId)];
}

function receiptEvidenceSources(
  authority: WorkspaceTextAuthority,
): readonly JeditWhyEvidenceSource[] {
  if (authority.kind !== WorkspaceTextAuthorityKinds.Opened) {
    return [];
  }
  const receiptId = authority.lastReceiptId ?? authority.pendingReceiptId;
  return receiptId == null ? [] : [evidenceSource(SOURCE_RECEIPT_REFERENCE, POSTURE_AVAILABLE, receiptId)];
}

function evidencePosture(
  authority: WorkspaceTextAuthority,
  cache: WorkspaceTextReadingCache | undefined,
): JeditWhyEvidencePosture {
  if (obstructionIssue(authority) != null) {
    return POSTURE_OBSTRUCTED;
  }
  if (authority.kind !== WorkspaceTextAuthorityKinds.Opened) {
    return authority.kind === WorkspaceTextAuthorityKinds.Obstructed
      ? POSTURE_OBSTRUCTED
      : POSTURE_UNAVAILABLE;
  }
  if (cache == null) {
    return POSTURE_MISSING_ENVELOPE;
  }
  return authority.dirty ? POSTURE_STALE_BASIS : POSTURE_AVAILABLE;
}

function authorityReadingPosture(authority: WorkspaceTextAuthority): WorkspaceTextReadingPosture {
  return obstructionIssue(authority) == null
    ? workspaceTextAuthorityPosture(authority)
    : WorkspaceTextReadingPostures.Obstructed;
}

function readingCache(authority: WorkspaceTextAuthority): WorkspaceTextReadingCache | undefined {
  return authority.kind === WorkspaceTextAuthorityKinds.Opened ? authority.cache : undefined;
}

function authorityFilePath(authority: WorkspaceTextAuthority): string | undefined {
  return authority.kind === WorkspaceTextAuthorityKinds.None ? undefined : authority.filePath;
}

function authorityBufferId(authority: WorkspaceTextAuthority): string | undefined {
  return authority.kind === WorkspaceTextAuthorityKinds.Opened ? authority.bufferId : undefined;
}

function apertureFromCache(cache: WorkspaceTextReadingCache): JeditWhyObservationAperture {
  return {
    coverage: cache.coverage,
    startLine: cache.startLine,
    returnedLineCount: cache.returnedLineCount,
    totalLineCount: cache.totalLineCount,
    hasMoreBefore: cache.hasMoreBefore,
    hasMoreAfter: cache.hasMoreAfter,
    cursorLine: cache.cursorLine,
    viewportLineCount: cache.viewportLineCount,
    truncated: cache.truncated,
  };
}

function obstructionIssue(authority: WorkspaceTextAuthority): RuntimeIssue | undefined {
  if (authority.kind === WorkspaceTextAuthorityKinds.Obstructed) {
    return authority.issue;
  }
  return authority.kind === WorkspaceTextAuthorityKinds.Opened
    ? authority.lastObstruction
    : undefined;
}

function observationObstruction(
  authority: WorkspaceTextAuthority,
): JeditWhyObservationObstruction | undefined {
  const issue = obstructionIssue(authority);
  return issue == null
    ? undefined
    : {
      message: issue.message,
      level: issue.level,
      source: issue.source,
    };
}

function evidenceSource(
  kind: JeditWhyEvidenceSourceKind,
  posture: JeditWhyEvidencePosture,
  referenceId?: string,
): JeditWhyEvidenceSource {
  return referenceId == null ? { kind, posture } : { kind, posture, referenceId };
}

function extraEvidenceSources(
  sources: readonly JeditWhyEvidenceSource[] | undefined,
): readonly JeditWhyEvidenceSource[] {
  return sources ?? [];
}

function hasNativeContinuumWitness(sources: readonly JeditWhyEvidenceSource[]): boolean {
  return sources.some((source) => {
    return source.kind === SOURCE_NATIVE_EVIDENCE && source.posture === POSTURE_AVAILABLE;
  });
}
