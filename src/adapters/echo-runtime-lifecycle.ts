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
    requestRunUntilIdle(request) {
      return options.codec.decodeRunUntilIdleResponse(
        options.trustedHost.dispatchControlIntentBytes(
          options.codec.encodeRunUntilIdleRequest(request),
        ),
      );
    },
  };
}
