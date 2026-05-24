export interface EchoRunUntilIdleRequest {
  readonly cycleLimit: number;
}

export interface EchoStartRequest {
  readonly tickIntervalSeconds: number;
}

export interface EchoStartResult {
  readonly accepted: boolean;
  readonly lastRunCompletion: string;
}

export interface EchoRunUntilIdleResult {
  readonly accepted: boolean;
  readonly lastRunCompletion: string;
}

export interface EchoStopResult {
  readonly accepted: boolean;
  readonly lastRunCompletion: string;
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
