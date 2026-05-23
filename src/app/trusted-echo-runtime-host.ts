import type {
  EchoStopResult,
  TrustedEchoRuntimeLifecyclePort,
} from '../ports/echo-runtime-lifecycle.js';

export interface TrustedEchoRuntimeShutdownReport extends EchoStopResult {
  readonly appCanTick: false;
}

export function stopTrustedEchoRuntime(
  lifecycle: TrustedEchoRuntimeLifecyclePort,
): TrustedEchoRuntimeShutdownReport {
  const result = lifecycle.requestStop();
  return {
    ...result,
    appCanTick: false,
  };
}
