import {
  JEDIT_RECOVERED_MATERIALIZATION_BLOCKED,
  JEDIT_RECOVERED_MATERIALIZATION_READY,
  JEDIT_RECOVERED_PAYLOAD_SOURCE_ECHO_READING,
  type JeditRecoveredMaterializationInput,
  type JeditRecoveredMaterializationResult,
} from '../ports/jedit-recovered-materialization.js';
import {
  JEDIT_RECOVERED_READING_AVAILABLE,
} from '../ports/jedit-recovered-bounded-reading.js';

const REASON_READING_UNAVAILABLE = 'recovered_reading_unavailable';
const REASON_UNTRUSTED_PAYLOAD_SOURCE = 'recovered_payload_source_not_echo';
const REASON_REQUIRES_FULL_PROJECTION = 'materialization_requires_full_projection';
const REASON_BOUNDED_READING_NOT_MATERIALIZABLE = 'bounded_reading_not_materializable';
const REASON_PAYLOAD_EVIDENCE_MISMATCH = 'recovered_payload_evidence_mismatch';
const REASON_PAYLOAD_DIGEST_MISMATCH = 'recovered_payload_digest_mismatch';
const READING_COVERAGE_FULL = 'full';
const FIRST_READING_LINE = 0;
const SHA256_PREFIX = 'sha256:';

export function materializeJeditTextArtifactFromRecoveredBasis(
  input: JeditRecoveredMaterializationInput,
): JeditRecoveredMaterializationResult {
  if (input.recoveredReading.status !== JEDIT_RECOVERED_READING_AVAILABLE) {
    return blocked(REASON_READING_UNAVAILABLE);
  }
  if (input.payload.source !== JEDIT_RECOVERED_PAYLOAD_SOURCE_ECHO_READING) {
    return blocked(REASON_UNTRUSTED_PAYLOAD_SOURCE);
  }
  const coverageBlock = payloadCoverageBlock(input.payload);
  if (coverageBlock != null) {
    return blocked(coverageBlock);
  }
  if (!payloadMatchesReading(input)) {
    return blocked(REASON_PAYLOAD_EVIDENCE_MISMATCH);
  }
  const textDigest = `${SHA256_PREFIX}${input.hash.sha256Hex(input.payload.text)}`;
  if (input.payload.textDigest !== textDigest) {
    return blocked(REASON_PAYLOAD_DIGEST_MISMATCH);
  }
  return {
    status: JEDIT_RECOVERED_MATERIALIZATION_READY,
    artifact: {
      readingId: input.recoveredReading.reading.readingId,
      basisDigest: input.recoveredReading.reading.basisDigest,
      text: input.payload.text,
      textDigest,
    },
  };
}

function payloadCoverageBlock(payload: JeditRecoveredMaterializationInput['payload']): string | undefined {
  if (payload.coverage == null) {
    return REASON_REQUIRES_FULL_PROJECTION;
  }
  return payloadCoversFullProjection(payload)
    ? undefined
    : REASON_BOUNDED_READING_NOT_MATERIALIZABLE;
}

function payloadCoversFullProjection(payload: JeditRecoveredMaterializationInput['payload']): boolean {
  return payload.coverage === READING_COVERAGE_FULL
    && payload.startLine === FIRST_READING_LINE
    && payload.truncated !== true
    && payload.returnedLineCount === payload.totalLineCount;
}

function payloadMatchesReading(input: JeditRecoveredMaterializationInput): boolean {
  if (input.recoveredReading.status !== JEDIT_RECOVERED_READING_AVAILABLE) {
    return false;
  }
  return input.payload.readingId === input.recoveredReading.reading.readingId
    && input.payload.basisDigest === input.recoveredReading.reading.basisDigest
    && input.payload.readingBasisDigest === input.recoveredReading.reading.readingBasisDigest
    && input.payload.semanticCoordinateDigest
      === input.recoveredReading.reading.semanticCoordinateDigest;
}

function blocked(reason: string): JeditRecoveredMaterializationResult {
  return {
    status: JEDIT_RECOVERED_MATERIALIZATION_BLOCKED,
    reason,
  };
}
