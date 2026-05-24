import type {
  JeditEchoAgentWitnessPort,
  JeditEchoWitnessRequest,
  JeditEchoWitnessRunSummary,
} from '../ports/jedit-echo-agent-witness.js';

export const JEDIT_LOCAL_REPLAY_MATCH = 'MATCH';
export const JEDIT_LOCAL_REPLAY_MISMATCH = 'MISMATCH';

const WALL_CLOCK_CADENCE_IS_SEMANTIC = false;

export interface JeditLocalReplayIdentity {
  readonly packageId: string;
  readonly outcomeStatus: string;
  readonly receiptId: string;
  readonly readingId: string;
  readonly text: string;
}

export interface JeditLocalReplayMatch {
  readonly status: typeof JEDIT_LOCAL_REPLAY_MATCH;
  readonly first: JeditLocalReplayIdentity;
  readonly second: JeditLocalReplayIdentity;
  readonly wallClockCadenceSemantic: false;
}

export interface JeditLocalReplayMismatch {
  readonly status: typeof JEDIT_LOCAL_REPLAY_MISMATCH;
  readonly first: JeditLocalReplayIdentity;
  readonly second: JeditLocalReplayIdentity;
  readonly mismatchField: keyof JeditLocalReplayIdentity;
  readonly wallClockCadenceSemantic: false;
}

export type JeditLocalReplayProof =
  | JeditLocalReplayMatch
  | JeditLocalReplayMismatch;

export interface JeditLocalReplayProofOptions {
  readonly witness: JeditEchoAgentWitnessPort;
}

interface JeditLocalReplayIdentityField {
  readonly name: keyof JeditLocalReplayIdentity;
  read(identity: JeditLocalReplayIdentity): string;
}

const REPLAY_IDENTITY_FIELDS: readonly JeditLocalReplayIdentityField[] = Object.freeze([
  Object.freeze({
    name: 'packageId',
    read(identity: JeditLocalReplayIdentity) {
      return identity.packageId;
    },
  }),
  Object.freeze({
    name: 'outcomeStatus',
    read(identity: JeditLocalReplayIdentity) {
      return identity.outcomeStatus;
    },
  }),
  Object.freeze({
    name: 'receiptId',
    read(identity: JeditLocalReplayIdentity) {
      return identity.receiptId;
    },
  }),
  Object.freeze({
    name: 'readingId',
    read(identity: JeditLocalReplayIdentity) {
      return identity.readingId;
    },
  }),
  Object.freeze({
    name: 'text',
    read(identity: JeditLocalReplayIdentity) {
      return identity.text;
    },
  }),
]);

export async function proveLocalJeditReplay(
  options: JeditLocalReplayProofOptions,
  request: JeditEchoWitnessRequest,
): Promise<JeditLocalReplayProof> {
  const first = toReplayIdentity(await options.witness.run(request));
  const second = toReplayIdentity(await options.witness.run(request));
  const mismatchField = firstMismatch(first, second);

  if (mismatchField == null) {
    return {
      status: JEDIT_LOCAL_REPLAY_MATCH,
      first,
      second,
      wallClockCadenceSemantic: WALL_CLOCK_CADENCE_IS_SEMANTIC,
    };
  }

  return {
    status: JEDIT_LOCAL_REPLAY_MISMATCH,
    first,
    second,
    mismatchField,
    wallClockCadenceSemantic: WALL_CLOCK_CADENCE_IS_SEMANTIC,
  };
}

function toReplayIdentity(summary: JeditEchoWitnessRunSummary): JeditLocalReplayIdentity {
  return {
    packageId: summary.install.packageId,
    outcomeStatus: summary.report.outcome.status,
    receiptId: summary.report.receiptId,
    readingId: summary.report.readingId,
    text: summary.report.text,
  };
}

function firstMismatch(
  first: JeditLocalReplayIdentity,
  second: JeditLocalReplayIdentity,
): keyof JeditLocalReplayIdentity | undefined {
  for (const field of REPLAY_IDENTITY_FIELDS) {
    if (field.read(first) !== field.read(second)) {
      return field.name;
    }
  }
  return undefined;
}
