import { createTextBufferOpticSession } from './text-buffer-optic-session.js';
import type { TrustedEchoRuntimeLifecyclePort } from '../ports/echo-runtime-lifecycle.js';
import type {
  JeditOpticClient,
  OpticSession,
} from '../ports/jedit-optic-client.js';

export interface EchoPoweredTextBufferOpticSessionOptions {
  readonly client: JeditOpticClient;
  readonly lifecycle: TrustedEchoRuntimeLifecyclePort;
  readonly cycleLimit: number;
}

export function createEchoPoweredTextBufferOpticSession(
  options: EchoPoweredTextBufferOpticSessionOptions,
): OpticSession {
  return createTextBufferOpticSession(echoPoweredClient(options));
}

function echoPoweredClient(
  options: EchoPoweredTextBufferOpticSessionOptions,
): JeditOpticClient {
  return {
    openTextBuffer(input) {
      const opened = options.client.openTextBuffer(input);
      requestRunUntilIdle(options);
      return opened;
    },
    createBufferWorldline(input) {
      const created = options.client.createBufferWorldline(input);
      requestRunUntilIdle(options);
      return created;
    },
    replaceRangeAsTick(session, input) {
      const replaced = options.client.replaceRangeAsTick(session, input);
      requestRunUntilIdle(options);
      return replaced;
    },
    createCheckpoint(session, input) {
      const checkpoint = options.client.createCheckpoint(session, input);
      requestRunUntilIdle(options);
      return checkpoint;
    },
    worldlineSnapshot(session, frontierRef, input) {
      return options.client.worldlineSnapshot(session, frontierRef, input);
    },
    textWindow(session, frontierRef, readBasisHandle, input) {
      return options.client.textWindow(session, frontierRef, readBasisHandle, input);
    },
  };
}

function requestRunUntilIdle(options: EchoPoweredTextBufferOpticSessionOptions): void {
  options.lifecycle.requestRunUntilIdle({
    cycleLimit: options.cycleLimit,
  });
}
