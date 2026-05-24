import type { EchoTrustedHostControlTransport } from '../ports/echo-kernel-transport.js';
import type {
  EchoRuntimeLifecycleCodec,
  TrustedEchoRuntimeLifecyclePort,
} from '../ports/echo-runtime-lifecycle.js';

export interface EchoRuntimeLifecyclePortOptions {
  readonly trustedHost: EchoTrustedHostControlTransport;
  readonly codec: EchoRuntimeLifecycleCodec;
}

export function createTrustedEchoRuntimeLifecyclePort(
  options: EchoRuntimeLifecyclePortOptions,
): TrustedEchoRuntimeLifecyclePort {
  return {
    requestStart(request) {
      return options.codec.decodeStartResponse(
        options.trustedHost.dispatchControlIntentBytes(
          options.codec.encodeStartRequest(request),
        ),
      );
    },
    requestRunUntilIdle(request) {
      return options.codec.decodeRunUntilIdleResponse(
        options.trustedHost.dispatchControlIntentBytes(
          options.codec.encodeRunUntilIdleRequest(request),
        ),
      );
    },
    requestStop() {
      return options.codec.decodeStopResponse(
        options.trustedHost.dispatchControlIntentBytes(
          options.codec.encodeStopRequest(),
        ),
      );
    },
  };
}
