import type {
  JeditEchoAgentWitnessPort,
  JeditEchoWitnessRequest,
  JeditEchoWitnessRunSummary,
} from '../ports/jedit-echo-agent-witness.js';

export const JEDIT_LOCAL_REPLAY_MATCH = 'MATCH';
export const JEDIT_LOCAL_REPLAY_MISMATCH = 'MISMATCH';

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
      wallClockCadenceSemantic: false,
    };
  }

  return {
    status: JEDIT_LOCAL_REPLAY_MISMATCH,
    first,
    second,
    mismatchField,
    wallClockCadenceSemantic: false,
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
  if (first.packageId !== second.packageId) {
    return 'packageId';
  }
  if (first.outcomeStatus !== second.outcomeStatus) {
    return 'outcomeStatus';
  }
  if (first.receiptId !== second.receiptId) {
    return 'receiptId';
  }
  if (first.readingId !== second.readingId) {
    return 'readingId';
  }
  if (first.text !== second.text) {
    return 'text';
  }
  return undefined;
}
