export interface EchoRunUntilIdleRequest {
  readonly cycleLimit: number;
}

export interface EchoRunUntilIdleResult {
  readonly accepted: boolean;
  readonly lastRunCompletion: string;
}

export interface TrustedEchoRuntimeLifecyclePort {
  requestRunUntilIdle(request: EchoRunUntilIdleRequest): EchoRunUntilIdleResult;
}

export interface EchoRuntimeLifecycleCodec {
  encodeRunUntilIdleRequest(request: EchoRunUntilIdleRequest): Uint8Array;
  decodeRunUntilIdleResponse(responseBytes: Uint8Array): EchoRunUntilIdleResult;
}
