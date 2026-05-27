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
const REASON_PAYLOAD_EVIDENCE_MISMATCH = 'recovered_payload_evidence_mismatch';
const REASON_PAYLOAD_DIGEST_MISMATCH = 'recovered_payload_digest_mismatch';
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
