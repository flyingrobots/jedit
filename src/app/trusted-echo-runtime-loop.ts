import type {
  EchoRunUntilIdleResult,
  EchoStopResult,
  TrustedEchoRuntimeLifecyclePort,
} from '../ports/echo-runtime-lifecycle.js';

export const TRUSTED_ECHO_RUNTIME_LOOP_RUNNING = 'RUNNING';
export const TRUSTED_ECHO_RUNTIME_LOOP_STOPPED = 'STOPPED';
export const TRUSTED_ECHO_RUNTIME_LOOP_NOT_RUNNING = 'not-running';

const SECONDS_PER_HERTZ = 1;

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
  readonly lastRunCompletion?: string;
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

interface TrustedEchoRuntimeLoopMemory {
  currentStatus: TrustedEchoRuntimeLoopStatus;
  currentCycleLimit?: number;
}

export function createTrustedEchoRuntimeLoop(
  options: TrustedEchoRuntimeLoopOptions,
): TrustedEchoRuntimeLoop {
  const memory: TrustedEchoRuntimeLoopMemory = {
    currentStatus: stoppedStatus(),
  };

  return {
    start(request) {
      return startTrustedEchoRuntimeLoop(options.lifecycle, memory, request);
    },
    drain() {
      return drainTrustedEchoRuntimeLoop(options.lifecycle, memory);
    },
    stop() {
      return stopTrustedEchoRuntimeLoop(options.lifecycle, memory);
    },
    status() {
      return memory.currentStatus;
    },
  };
}

function startTrustedEchoRuntimeLoop(
  lifecycle: TrustedEchoRuntimeLifecyclePort,
  memory: TrustedEchoRuntimeLoopMemory,
  request: TrustedEchoRuntimeStartRequest,
): TrustedEchoRuntimeLoopStatus {
  const startResult = lifecycle.requestStart({
    tickIntervalSeconds: SECONDS_PER_HERTZ / request.tickFrequencyHz,
  });
  if (!startResult.accepted) {
    memory.currentStatus = stoppedStatus(startResult.lastRunCompletion);
    memory.currentCycleLimit = undefined;
    return memory.currentStatus;
  }
  memory.currentStatus = runningStatus(request, startResult.lastRunCompletion);
  memory.currentCycleLimit = request.cycleLimit;
  return memory.currentStatus;
}

function drainTrustedEchoRuntimeLoop(
  lifecycle: TrustedEchoRuntimeLifecyclePort,
  memory: TrustedEchoRuntimeLoopMemory,
): EchoRunUntilIdleResult {
  if (memory.currentStatus.state !== TRUSTED_ECHO_RUNTIME_LOOP_RUNNING) {
    return notRunningResult();
  }
  if (memory.currentCycleLimit === undefined) {
    return notRunningResult();
  }
  return lifecycle.requestRunUntilIdle({
    cycleLimit: memory.currentCycleLimit,
  });
}

function stopTrustedEchoRuntimeLoop(
  lifecycle: TrustedEchoRuntimeLifecyclePort,
  memory: TrustedEchoRuntimeLoopMemory,
): EchoStopResult {
  const result = lifecycle.requestStop();
  memory.currentStatus = stoppedStatus();
  memory.currentCycleLimit = undefined;
  return result;
}

function runningStatus(
  request: TrustedEchoRuntimeStartRequest,
  lastRunCompletion: string,
): TrustedEchoRuntimeLoopStatus {
  return {
    state: TRUSTED_ECHO_RUNTIME_LOOP_RUNNING,
    tickFrequencyHz: request.tickFrequencyHz,
    cycleLimit: request.cycleLimit,
    lastRunCompletion,
  };
}

function stoppedStatus(): TrustedEchoRuntimeLoopStatus;
function stoppedStatus(lastRunCompletion: string): TrustedEchoRuntimeLoopStatus;
function stoppedStatus(lastRunCompletion?: string): TrustedEchoRuntimeLoopStatus {
  return lastRunCompletion == null
    ? {
      state: TRUSTED_ECHO_RUNTIME_LOOP_STOPPED,
    }
    : {
      state: TRUSTED_ECHO_RUNTIME_LOOP_STOPPED,
      lastRunCompletion,
    };
}

function notRunningResult(): EchoRunUntilIdleResult {
  return {
    accepted: false,
    lastRunCompletion: TRUSTED_ECHO_RUNTIME_LOOP_NOT_RUNNING,
  };
}
