import {
  ECHO_RECOVERY_PORT_INVALID_REQUEST,
  ECHO_RECOVERY_PORT_UNAVAILABLE,
  type EchoRecoveryGateRequest,
  type EchoRecoveryGateResult,
  type EchoRecoveryPort,
} from '../ports/echo-recovery.js';
import type { EchoRecoveryCommandPort } from '../ports/echo-recovery-command.js';
import { decodeEchoRecoveryGateReport } from './echo-recovery-codec.js';

const COMMAND_FAILED_CODE = 'echo_recovery_command_failed';
const MISSING_SUBMISSION_CODE = 'missing_submission_id';
const MISSING_ENVELOPE_CODE = 'missing_canonical_envelope_digest';
const FORMAT_FLAG = '--format';
const JSON_FORMAT = 'json';
const RECOVERY_COMMAND = 'recovery';
const GATE_COMMAND = 'gate';
const SUBMISSION_ID_FLAG = '--submission-id';
const ENVELOPE_DIGEST_FLAG = '--canonical-envelope-digest';
const BASIS_DIGEST_FLAG = '--basis-digest';
const READING_BASIS_DIGEST_FLAG = '--reading-basis-digest';
const SEMANTIC_COORDINATE_DIGEST_FLAG = '--semantic-coordinate-digest';
const READING_ID_FLAG = '--reading-id';
const EMPTY_COMMAND_FAILURE_MESSAGE = 'Echo recovery command failed without stderr output.';

export interface EchoCliRecoveryAdapterConfig {
  readonly command: EchoRecoveryCommandPort;
  readonly executable: string;
  readonly root: string;
  readonly cwd?: string;
  readonly timeoutMs?: number;
}

export function createEchoCliRecoveryAdapter(
  config: EchoCliRecoveryAdapterConfig,
): EchoRecoveryPort {
  return {
    async readExternalAppRecoveryGate(request) {
      const invalid = validateRequest(request);
      if (invalid != null) {
        return invalid;
      }
      const command = await config.command.run({
        executable: config.executable,
        args: gateArgs(config.root, request),
        cwd: config.cwd,
        timeoutMs: config.timeoutMs,
      });
      if (command.exitCode !== 0) {
        return commandUnavailable(command.stderr);
      }
      return decodeEchoRecoveryGateReport(command.stdout);
    },
  };
}

function validateRequest(request: EchoRecoveryGateRequest): EchoRecoveryGateResult | null {
  if (request.submissionId.trim().length === 0) {
    return invalid(MISSING_SUBMISSION_CODE, 'Echo recovery requires a submission id.');
  }
  if (request.canonicalEnvelopeDigest.trim().length === 0) {
    return invalid(MISSING_ENVELOPE_CODE, 'Echo recovery requires an envelope digest.');
  }
  return null;
}

function gateArgs(root: string, request: EchoRecoveryGateRequest): readonly string[] {
  const args = [
    FORMAT_FLAG,
    JSON_FORMAT,
    RECOVERY_COMMAND,
    GATE_COMMAND,
    root,
    SUBMISSION_ID_FLAG,
    request.submissionId,
    ENVELOPE_DIGEST_FLAG,
    request.canonicalEnvelopeDigest,
  ];
  return request.reading == null ? args : [...args, ...readingArgs(request)];
}

function readingArgs(request: EchoRecoveryGateRequest): readonly string[] {
  if (request.reading == null) {
    return [];
  }
  return [
    BASIS_DIGEST_FLAG,
    request.reading.basisDigest,
    READING_BASIS_DIGEST_FLAG,
    request.reading.readingBasisDigest,
    SEMANTIC_COORDINATE_DIGEST_FLAG,
    request.reading.semanticCoordinateDigest,
    READING_ID_FLAG,
    request.reading.readingId,
  ];
}

function invalid(code: string, message: string): EchoRecoveryGateResult {
  return {
    status: ECHO_RECOVERY_PORT_INVALID_REQUEST,
    diagnostic: {
      code,
      message,
    },
  };
}

function commandUnavailable(stderr: string): EchoRecoveryGateResult {
  const message = stderr.length === 0
    ? EMPTY_COMMAND_FAILURE_MESSAGE
    : stderr;
  return {
    status: ECHO_RECOVERY_PORT_UNAVAILABLE,
    diagnostic: {
      code: COMMAND_FAILED_CODE,
      message,
    },
  };
}
