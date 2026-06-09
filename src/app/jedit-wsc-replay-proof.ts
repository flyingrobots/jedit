import {
  JEDIT_WSC_HISTORY_APPLIED,
  type JeditWscHistoryListed,
  type JeditWscHistoryRecord,
} from '../ports/jedit-wsc-history-listing.js';
import {
  JEDIT_WSC_REPLAY_CLOSEOUT_OBSTRUCTED,
  JEDIT_WSC_REPLAY_CLOSEOUT_READY,
  JEDIT_WSC_REPLAY_MATCH,
  JEDIT_WSC_REPLAY_MISMATCH,
  JEDIT_WSC_REPLAY_MISSING_NON_APPLIED_OUTCOME,
  JEDIT_WSC_REPLAY_MISSING_STAGE_COVERAGE,
  type JeditWscReplayCloseout,
  type JeditWscReplayCloseoutStage,
  type JeditWscReplayEvidenceCoordinate,
  type JeditWscReplayIdentityField,
  type JeditWscReplayIdentityRecord,
  type JeditWscReplayProof,
} from '../ports/jedit-wsc-replay-proof.js';

const WALL_CLOCK_CADENCE_IS_SEMANTIC = false;

const REPLAY_IDENTITY_FIELDS: readonly JeditWscReplayIdentityField[] = Object.freeze([
  identityField('filePath'),
  identityField('bufferId'),
  identityField('commandKind'),
  identityField('outcomeStatus'),
  identityField('receiptId'),
  identityField('readingId'),
  identityField('readingLineCount'),
  identityField('readingTextDigest'),
  identityField('checkpointId'),
  identityField('submissionId'),
  identityField('admissionId'),
  identityField('ticketId'),
  identityField('executionId'),
  identityField('rejectionReason'),
]);

const CLOSEOUT_STAGES: readonly JeditWscReplayCloseoutStage[] = Object.freeze([
  closeoutStage('submission', (record) => record.submissionId != null),
  closeoutStage('admission', (record) => record.admissionId != null),
  closeoutStage('ticket', (record) => record.ticketId != null),
  closeoutStage('execution', (record) => record.executionId != null),
  closeoutStage('receipt', (record) => record.receiptId != null),
  closeoutStage('reading', (record) => record.readingId != null),
  closeoutStage('retention', (record) => record.basisId === record.envelopeId),
  closeoutStage('export', (record) => record.exportEvidenceId != null),
]);

export function proveJeditWscReplay(
  firstHistory: JeditWscHistoryListed,
  secondHistory: JeditWscHistoryListed,
): JeditWscReplayProof {
  const first = replayIdentity(firstHistory);
  const second = replayIdentity(secondHistory);
  const mismatchCoordinate = replayMismatchCoordinate(first, second);
  if (mismatchCoordinate == null) {
    return {
      status: JEDIT_WSC_REPLAY_MATCH,
      first,
      second,
      wallClockCadenceSemantic: WALL_CLOCK_CADENCE_IS_SEMANTIC,
    };
  }
  return {
    status: JEDIT_WSC_REPLAY_MISMATCH,
    first,
    second,
    mismatchCoordinate,
    wallClockCadenceSemantic: WALL_CLOCK_CADENCE_IS_SEMANTIC,
  };
}

export function jeditWscReplayCloseout(
  history: JeditWscHistoryListed,
): JeditWscReplayCloseout {
  const evidenceCoordinates = history.records.map(evidenceCoordinate);
  const coveredStages = CLOSEOUT_STAGES
    .filter((stage) => history.records.some(stage.coveredBy))
    .map((stage) => stage.name);
  const missingStage = CLOSEOUT_STAGES.find((stage) => !coveredStages.includes(stage.name));
  if (missingStage != null) {
    return closeoutObstructed(JEDIT_WSC_REPLAY_MISSING_STAGE_COVERAGE, missingStage.name, evidenceCoordinates);
  }
  const nonAppliedOutcomeCount = history.records
    .filter((record) => record.outcomeStatus !== JEDIT_WSC_HISTORY_APPLIED)
    .length;
  if (nonAppliedOutcomeCount === 0) {
    return closeoutObstructed(
      JEDIT_WSC_REPLAY_MISSING_NON_APPLIED_OUTCOME,
      'replay closeout requires at least one retained non-applied outcome',
      evidenceCoordinates,
    );
  }
  return {
    status: JEDIT_WSC_REPLAY_CLOSEOUT_READY,
    evidenceCoordinates,
    coveredStages,
    nonAppliedOutcomeCount,
    deterministicOnCleanCheckout: true,
  };
}

function replayIdentity(history: JeditWscHistoryListed): readonly JeditWscReplayIdentityRecord[] {
  return history.records.map((record) => ({
    filePath: record.filePath,
    bufferId: record.bufferId,
    commandKind: record.commandKind,
    outcomeStatus: record.outcomeStatus,
    receiptId: record.receiptId,
    readingId: record.readingId,
    readingLineCount: record.readingLineCount,
    readingTextDigest: record.readingTextDigest,
    checkpointId: record.checkpointId,
    submissionId: record.submissionId,
    admissionId: record.admissionId,
    ticketId: record.ticketId,
    executionId: record.executionId,
    rejectionReason: record.rejectionReason,
  }));
}

function replayMismatchCoordinate(
  first: readonly JeditWscReplayIdentityRecord[],
  second: readonly JeditWscReplayIdentityRecord[],
): string | undefined {
  if (first.length !== second.length) {
    return 'history.length';
  }
  for (let index = 0; index < first.length; index += 1) {
    const mismatchField = recordMismatchField(first[index], second[index]);
    if (mismatchField != null) {
      return `history[${String(index)}].${mismatchField}`;
    }
  }
  return undefined;
}

function recordMismatchField(
  first: JeditWscReplayIdentityRecord | undefined,
  second: JeditWscReplayIdentityRecord | undefined,
): keyof JeditWscReplayIdentityRecord | undefined {
  if (first == null || second == null) {
    return 'outcomeStatus';
  }
  for (const field of REPLAY_IDENTITY_FIELDS) {
    if (field.read(first) !== field.read(second)) {
      return field.name;
    }
  }
  return undefined;
}

function evidenceCoordinate(record: JeditWscHistoryRecord): JeditWscReplayEvidenceCoordinate {
  return {
    basisId: record.basisId,
    outcomeStatus: record.outcomeStatus,
    receiptId: record.receiptId,
    readingId: record.readingId,
    exportEvidenceId: record.exportEvidenceId,
    rejectionReason: record.rejectionReason,
  };
}

function closeoutObstructed(
  code: string,
  message: string,
  evidenceCoordinates: readonly JeditWscReplayEvidenceCoordinate[],
): JeditWscReplayCloseout {
  return {
    status: JEDIT_WSC_REPLAY_CLOSEOUT_OBSTRUCTED,
    obstruction: { code, message },
    evidenceCoordinates,
  };
}

function identityField(name: keyof JeditWscReplayIdentityRecord): JeditWscReplayIdentityField {
  return {
    name,
    read(record) {
      return record[name];
    },
  };
}

function closeoutStage(
  name: string,
  coveredBy: (record: JeditWscHistoryRecord) => boolean,
): JeditWscReplayCloseoutStage {
  return { name, coveredBy };
}
