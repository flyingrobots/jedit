import type {
  EchoRunUntilIdleResult,
  EchoStopResult,
  TrustedEchoRuntimeLifecyclePort,
} from '../ports/echo-runtime-lifecycle.js';

export const TRUSTED_ECHO_RUNTIME_LOOP_RUNNING = 'RUNNING';
export const TRUSTED_ECHO_RUNTIME_LOOP_STOPPED = 'STOPPED';
export const TRUSTED_ECHO_RUNTIME_LOOP_NOT_RUNNING = 'not-running';

export type TrustedEchoRuntimeLoopState =
  | typeof TRUSTED_ECHO_RUNTIME_LOOP_RUNNING
  | typeof TRUSTED_ECHO_RUNTIME_LOOP_STOPPED;

export interface TrustedEchoRuntimeStartRequest {
  readonly tickFrequencyHz: number;
  readonly cycleLimit: number;
}

export interface TrustedEchoRuntimeLoopStatus {
  readonly state: TrustedEchoRuntimeLoopState;
  readonly tickFrequencyHz?: number;
  readonly cycleLimit?: number;
}

export interface TrustedEchoRuntimeLoop {
  start(request: TrustedEchoRuntimeStartRequest): TrustedEchoRuntimeLoopStatus;
  drain(): EchoRunUntilIdleResult;
  stop(): EchoStopResult;
  status(): TrustedEchoRuntimeLoopStatus;
}

export interface TrustedEchoRuntimeLoopOptions {
  readonly lifecycle: TrustedEchoRuntimeLifecyclePort;
}

export function createTrustedEchoRuntimeLoop(
  options: TrustedEchoRuntimeLoopOptions,
): TrustedEchoRuntimeLoop {
  let currentStatus: TrustedEchoRuntimeLoopStatus = stoppedStatus();
  let currentCycleLimit: number | undefined;

  return {
    start(request) {
      currentStatus = {
        state: TRUSTED_ECHO_RUNTIME_LOOP_RUNNING,
        tickFrequencyHz: request.tickFrequencyHz,
        cycleLimit: request.cycleLimit,
      };
      currentCycleLimit = request.cycleLimit;
      return currentStatus;
    },
    drain() {
      if (
        currentStatus.state !== TRUSTED_ECHO_RUNTIME_LOOP_RUNNING
        || currentCycleLimit === undefined
      ) {
        return notRunningResult();
      }
      return options.lifecycle.requestRunUntilIdle({
        cycleLimit: currentCycleLimit,
      });
    },
    stop() {
      const result = options.lifecycle.requestStop();
      currentStatus = stoppedStatus();
      currentCycleLimit = undefined;
      return result;
    },
    status() {
      return currentStatus;
    },
  };
}

function stoppedStatus(): TrustedEchoRuntimeLoopStatus {
  return {
    state: TRUSTED_ECHO_RUNTIME_LOOP_STOPPED,
  };
}

function notRunningResult(): EchoRunUntilIdleResult {
  return {
    accepted: false,
    lastRunCompletion: TRUSTED_ECHO_RUNTIME_LOOP_NOT_RUNNING,
  };
}
