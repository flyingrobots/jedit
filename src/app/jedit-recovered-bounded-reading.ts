import {
  ECHO_EVIDENCE_HEALTH_COMPLETE,
  ECHO_RECOVERY_CHAIN_EVALUATED,
  ECHO_RECOVERY_CHAIN_INCOMPLETE,
  ECHO_RECOVERY_CHAIN_NOT_REQUESTED,
  type EchoRecoveryChainStatus,
  type EchoRecoveryCausalChainReport,
  type EchoRecoveryGateReport,
} from '../ports/echo-recovery.js';
import {
  JEDIT_RECOVERED_READING_AVAILABLE,
  JEDIT_RECOVERED_READING_INCOMPLETE,
  JEDIT_RECOVERED_READING_NOT_REQUESTED,
  type JeditRecoveredBoundedReading,
  type JeditRecoveredBoundedReadingResult,
} from '../ports/jedit-recovered-bounded-reading.js';

const REASON_CHAIN_NOT_EVALUATED = 'echo_causal_chain_not_evaluated';
const REASON_CHAIN_INCOMPLETE = 'echo_causal_chain_incomplete';
const REASON_CHAIN_EVIDENCE_INCOMPLETE = 'echo_causal_chain_evidence_incomplete';
const REASON_CHAIN_MISSING_READING_FIELDS = 'echo_causal_chain_missing_reading_fields';

export function readRecoveredBoundedReading(
  report: EchoRecoveryGateReport,
): JeditRecoveredBoundedReadingResult {
  return readRecoveredBoundedReadingFromChain(report.causalChain);
}

export function readRecoveredBoundedReadingFromChain(
  chain: EchoRecoveryCausalChainReport,
): JeditRecoveredBoundedReadingResult {
  switch (chain.status) {
    case ECHO_RECOVERY_CHAIN_NOT_REQUESTED:
      return {
        status: JEDIT_RECOVERED_READING_NOT_REQUESTED,
      };
    case ECHO_RECOVERY_CHAIN_INCOMPLETE:
      return incomplete(REASON_CHAIN_INCOMPLETE);
    case ECHO_RECOVERY_CHAIN_EVALUATED:
      return readEvaluatedRecoveredBoundedReading(chain);
  }
  return unknownChainStatus(chain.status);
}

function readEvaluatedRecoveredBoundedReading(
  chain: EchoRecoveryCausalChainReport,
): JeditRecoveredBoundedReadingResult {
  if (chain.evidenceHealth !== ECHO_EVIDENCE_HEALTH_COMPLETE) {
    return incomplete(REASON_CHAIN_EVIDENCE_INCOMPLETE);
  }
  const reading = recoveredReading(chain);
  return reading == null
    ? incomplete(REASON_CHAIN_MISSING_READING_FIELDS)
    : {
      status: JEDIT_RECOVERED_READING_AVAILABLE,
      reading,
    };
}

function recoveredReading(
  chain: EchoRecoveryCausalChainReport,
): JeditRecoveredBoundedReading | null {
  const readingId = chain.readingId;
  const basisDigest = chain.basisDigest;
  const readingBasisDigest = chain.readingBasisDigest;
  const semanticCoordinateDigest = chain.semanticCoordinateDigest;
  const readingSource = chain.readingSource;
  const readingAuthority = chain.readingAuthority;

  if (readingId == null
    || basisDigest == null
    || readingBasisDigest == null
    || semanticCoordinateDigest == null
    || readingSource == null
    || readingAuthority == null) {
    return null;
  }
  return {
    readingId,
    basisDigest,
    readingBasisDigest,
    semanticCoordinateDigest,
    readingSource,
    readingAuthority,
  };
}

function incomplete(reason: string): JeditRecoveredBoundedReadingResult {
  return {
    status: JEDIT_RECOVERED_READING_INCOMPLETE,
    reason,
  };
}

function unknownChainStatus(status: never): JeditRecoveredBoundedReadingResult {
  const chainStatus: EchoRecoveryChainStatus = status;
  return incomplete(`${REASON_CHAIN_NOT_EVALUATED}:${chainStatus}`);
}
