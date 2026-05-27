import { spawn } from 'node:child_process';

import {
  ECHO_RECOVERY_COMMAND_EXITED,
  type EchoRecoveryCommandPort,
  type EchoRecoveryCommandRequest,
  type EchoRecoveryCommandResult,
} from '../ports/echo-recovery-command.js';

const UTF8_ENCODING = 'utf8';
const COMMAND_FAILED_EXIT_CODE = 1;
const TIMEOUT_KILL_SIGNAL = 'SIGTERM';

export function createNodeEchoRecoveryCommandPort(): EchoRecoveryCommandPort {
  return {
    async run(request) {
      return runEchoRecoveryCommand(request);
    },
  };
}

function runEchoRecoveryCommand(
  request: EchoRecoveryCommandRequest,
): Promise<EchoRecoveryCommandResult> {
  return new Promise((resolve) => {
    const child = spawn(request.executable, [...request.args], {
      cwd: request.cwd,
    });
    const state = mutableCommandState();
    child.stdout.setEncoding(UTF8_ENCODING);
    child.stderr.setEncoding(UTF8_ENCODING);
    child.stdout.on('data', (chunk) => {
      state.stdout += chunk;
    });
    child.stderr.on('data', (chunk) => {
      state.stderr += chunk;
    });
    const timer = scheduleTimeout(child, state, request);
    child.on('error', (error) => {
      resolveOnce(resolve, outputWithError(state, error.message), COMMAND_FAILED_EXIT_CODE, timer, state);
    });
    child.on('close', (code, signal) => {
      const errorMessage = closeErrorMessage({ state, signal });
      resolveOnce(resolve, outputWithError(state, errorMessage), code ?? COMMAND_FAILED_EXIT_CODE, timer, state);
    });
  });
}

interface MutableCommandState {
  stdout: string;
  stderr: string;
  timedOut: boolean;
  settled: boolean;
}

interface CommandOutput {
  readonly stdout: string;
  readonly stderr: string;
  readonly errorMessage: string;
}

interface ClosePosture {
  readonly state: MutableCommandState;
  readonly signal: NodeJS.Signals | null;
}

function mutableCommandState(): MutableCommandState {
  return {
    stdout: '',
    stderr: '',
    timedOut: false,
    settled: false,
  };
}

function scheduleTimeout(
  child: ReturnType<typeof spawn>,
  state: MutableCommandState,
  request: EchoRecoveryCommandRequest,
): ReturnType<typeof setTimeout> | null {
  if (request.timeoutMs == null) {
    return null;
  }
  return setTimeout(() => {
    state.timedOut = true;
    child.kill(TIMEOUT_KILL_SIGNAL);
  }, request.timeoutMs);
}

function outputWithError(state: MutableCommandState, errorMessage: string): CommandOutput {
  return {
    stdout: state.stdout,
    stderr: state.stderr,
    errorMessage,
  };
}

function resolveOnce(
  resolve: (result: EchoRecoveryCommandResult) => void,
  output: CommandOutput,
  exitCode: number,
  timer: ReturnType<typeof setTimeout> | null,
  state: MutableCommandState,
): void {
  if (state.settled) {
    return;
  }
  state.settled = true;
  if (timer != null) {
    clearTimeout(timer);
  }
  resolve({
    status: ECHO_RECOVERY_COMMAND_EXITED,
    exitCode,
    stdout: output.stdout,
    stderr: stderrForResult(output.stderr, output.errorMessage),
  });
}

function closeErrorMessage(posture: ClosePosture): string {
  if (posture.state.timedOut) {
    return 'Echo recovery command timed out.';
  }
  if (posture.signal == null) {
    return '';
  }
  return `Echo recovery command exited after signal ${posture.signal}.`;
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
