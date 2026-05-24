export interface EchoRunUntilIdleRequest {
  readonly cycleLimit: number;
}

export interface EchoStartRequest {
  readonly tickIntervalSeconds: number;
}

export const ECHO_RUN_COMPLETION_STARTED = 'started';
export const ECHO_RUN_COMPLETION_QUIESCED = 'quiesced';
export const ECHO_RUN_COMPLETION_STOPPED = 'stopped';
export const ECHO_RUN_COMPLETION_NOT_RUNNING = 'not-running';
export const ECHO_RUN_COMPLETION_START_REJECTED = 'start-rejected';
export const ECHO_RUN_COMPLETION_STOP_REJECTED = 'stop-rejected';
export const ECHO_RUN_COMPLETION_INVALID_START_REQUEST = 'invalid-start-request';

export type EchoRunCompletion =
  | typeof ECHO_RUN_COMPLETION_STARTED
  | typeof ECHO_RUN_COMPLETION_QUIESCED
  | typeof ECHO_RUN_COMPLETION_STOPPED
  | typeof ECHO_RUN_COMPLETION_NOT_RUNNING
  | typeof ECHO_RUN_COMPLETION_START_REJECTED
  | typeof ECHO_RUN_COMPLETION_STOP_REJECTED
  | typeof ECHO_RUN_COMPLETION_INVALID_START_REQUEST;

export interface EchoStartResult {
  readonly accepted: boolean;
  readonly lastRunCompletion: EchoRunCompletion;
}

export interface EchoRunUntilIdleResult {
  readonly accepted: boolean;
  readonly lastRunCompletion: EchoRunCompletion;
}

export interface EchoStopResult {
  readonly accepted: boolean;
  readonly lastRunCompletion: EchoRunCompletion;
}

export interface TrustedEchoRuntimeLifecyclePort {
  requestStart(request: EchoStartRequest): EchoStartResult;
  requestRunUntilIdle(request: EchoRunUntilIdleRequest): EchoRunUntilIdleResult;
  requestStop(): EchoStopResult;
}

export interface EchoRuntimeLifecycleCodec {
  encodeStartRequest(request: EchoStartRequest): Uint8Array;
  decodeStartResponse(responseBytes: Uint8Array): EchoStartResult;
  encodeRunUntilIdleRequest(request: EchoRunUntilIdleRequest): Uint8Array;
  decodeRunUntilIdleResponse(responseBytes: Uint8Array): EchoRunUntilIdleResult;
  encodeStopRequest(): Uint8Array;
  decodeStopResponse(responseBytes: Uint8Array): EchoStopResult;
}
