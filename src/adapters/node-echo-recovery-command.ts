import { spawnSync } from 'node:child_process';

import {
  ECHO_RECOVERY_COMMAND_EXITED,
  type EchoRecoveryCommandPort,
  type EchoRecoveryCommandRequest,
  type EchoRecoveryCommandResult,
} from '../ports/echo-recovery-command.js';

const UTF8_ENCODING = 'utf8';

export function createNodeEchoRecoveryCommandPort(): EchoRecoveryCommandPort {
  return {
    async run(request) {
      return runEchoRecoveryCommand(request);
    },
  };
}

function runEchoRecoveryCommand(
  request: EchoRecoveryCommandRequest,
): EchoRecoveryCommandResult {
  const result = spawnSync(request.executable, [...request.args], {
    cwd: request.cwd,
    encoding: UTF8_ENCODING,
    timeout: request.timeoutMs,
  });
  return {
    status: ECHO_RECOVERY_COMMAND_EXITED,
    exitCode: result.status ?? 1,
    stdout: result.stdout ?? '',
    stderr: stderrForResult(result.stderr ?? '', result.error?.message ?? ''),
  };
}

function stderrForResult(stderr: string, errorMessage: string): string {
  if (stderr.length === 0) {
    return errorMessage;
  }
  if (errorMessage.length === 0) {
    return stderr;
  }
  return `${stderr}\n${errorMessage}`;
}
