import { bytesToHex } from './echo-wasm-cbor.mjs';

const UTF8_DECODER = new TextDecoder();
export const INLINE_PAYLOAD_PREVIEW_BYTE_LIMIT = 128;

export const WITNESS_REPORT_SCHEMA_VERSION = 2;
export const RETAINED_EVIDENCE_POSTURE_MISSING = 'missing_retention';
export const REPLAY_OBSTRUCTION_DURABLE_UNAVAILABLE = 'durable_replay_unavailable';

export function createWitnessReport({
  appReading,
  artifact,
  cycleLimit,
  fixtureName,
  jeditGeneratedContract,
  operationIds,
  queryBytes,
  textWindowBasis,
}) {
  const artifactHash = bytesToHex(artifact.artifact_hash);
  const readingId = appReading.reading.readingId;
  return {
    schemaVersion: WITNESS_REPORT_SCHEMA_VERSION,
    authority: {
      applicationDispatch: 'submitIntentBytes',
      trustedHostControl: 'dispatchControlIntentBytes',
      runtimeControlHistory: 'trusted-host-control',
      tickReceiptAuthority: 'echo-scheduler',
    },
    runtimeControl: {
      command: 'start',
      mode: 'until_idle',
      cycleLimit,
      createsTickDirectly: false,
    },
    fixture: fixtureName,
    operations: operationIds,
    jeditGeneratedContract,
    retainedEvidence: createRetainedEvidenceInventory({
      appReading,
      artifact,
      artifactHash,
      queryBytes,
      textWindowBasis,
    }),
    replay: createReplayPosture({ artifactHash, readingId }),
    reading: createReadingSummary({
      appReading,
      artifact,
      artifactHash,
      readingId,
      textWindowBasis,
    }),
  };
}

function createRetainedEvidenceInventory({
  appReading,
  artifact,
  artifactHash,
  queryBytes,
  textWindowBasis,
}) {
  return {
    posture: RETAINED_EVIDENCE_POSTURE_MISSING,
    availableInline: [
      {
        role: 'reading_payload',
        source: 'ObservationPayload::QueryBytes',
        byteLength: queryBytes.length,
        contentPreviewUtf8: UTF8_DECODER.decode(
          queryBytes.slice(0, INLINE_PAYLOAD_PREVIEW_BYTE_LIMIT),
        ),
        contentPreviewTruncated: queryBytes.length > INLINE_PAYLOAD_PREVIEW_BYTE_LIMIT,
      },
      {
        role: 'reading_envelope',
        source: 'ObservationArtifact.reading',
        residualPosture: artifact.reading.residual_posture,
        observerBasis: artifact.reading.observer_basis,
      },
    ],
    missing: [
      {
        role: 'contract_receipt',
        posture: RETAINED_EVIDENCE_POSTURE_MISSING,
        reason: 'current stack witness does not expose retained tick receipt refs',
      },
      {
        role: 'reading_payload_ref',
        posture: RETAINED_EVIDENCE_POSTURE_MISSING,
        reason: 'current stack witness carries query bytes inline without a retained payload ref',
      },
      {
        role: 'reading_envelope_ref',
        posture: RETAINED_EVIDENCE_POSTURE_MISSING,
        reason: 'current stack witness carries the reading envelope inline without a retained envelope ref',
      },
    ],
    semanticCoordinates: {
      artifactHash,
      readingId: appReading.reading.readingId,
      queryId: artifact.projection.query_id,
      basisWorldlineId: textWindowBasis.worldlineIdHex,
    },
  };
}

function createReplayPosture({ artifactHash, readingId }) {
  return {
    status: 'obstructed',
    obstruction: REPLAY_OBSTRUCTION_DURABLE_UNAVAILABLE,
    reason: 'current witness proves deterministic reading identity but not durable replay',
    readingIdentity: {
      readingId,
      artifactHash,
    },
  };
}

function createReadingSummary({
  appReading,
  artifact,
  artifactHash,
  readingId,
  textWindowBasis,
}) {
  return {
    operationName: appReading.operationName,
    frontierRef: appReading.frontierRef,
    text: appReading.reading.lines.map((line) => line.text).join('\n'),
    readingId,
    artifactHash,
    residualPosture: artifact.reading.residual_posture,
    observerBasis: artifact.reading.observer_basis,
    frame: artifact.frame,
    queryId: artifact.projection.query_id,
    basisWorldlineId: textWindowBasis.worldlineIdHex,
  };
}
