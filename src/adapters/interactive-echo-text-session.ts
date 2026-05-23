import { createEchoTransportJeditOpticClient } from './jedit-echo-optic-client.js';
import { createFakeEchoJeditOpticTransport } from './fake-echo-jedit-optic-transport.js';
import { createInstalledJeditContractEchoTransport } from './installed-jedit-contract-echo-transport.js';
import { createEchoPoweredTextBufferOpticSession } from '../app/echo-powered-text-buffer-optic-session.js';
import { createTextBufferOpticSession } from '../app/text-buffer-optic-session.js';
import {
  INTERACTIVE_TEXT_RUNTIME_ECHO,
  INTERACTIVE_TEXT_RUNTIME_LOCAL,
  type InteractiveTextRuntimeMode,
} from '../app/interactive-text-runtime-mode.js';
import type { TrustedEchoRuntimeLifecyclePort } from '../ports/echo-runtime-lifecycle.js';
import type { OpticSession } from '../ports/jedit-optic-client.js';

export interface InteractiveTextSessionOptions {
  readonly mode: InteractiveTextRuntimeMode;
  readonly lifecycle: TrustedEchoRuntimeLifecyclePort;
  readonly cycleLimit: number;
}

export interface InteractiveTextSessionBinding {
  readonly mode: InteractiveTextRuntimeMode;
  readonly session: OpticSession;
}

export function createInteractiveTextSession(
  options: InteractiveTextSessionOptions,
): InteractiveTextSessionBinding {
  return options.mode === INTERACTIVE_TEXT_RUNTIME_ECHO
    ? echoBackedSession(options)
    : localSession();
}

function echoBackedSession(options: InteractiveTextSessionOptions): InteractiveTextSessionBinding {
  const transport = createInstalledJeditContractEchoTransport();
  return {
    mode: INTERACTIVE_TEXT_RUNTIME_ECHO,
    session: createEchoPoweredTextBufferOpticSession({
      client: createEchoTransportJeditOpticClient(transport),
      lifecycle: options.lifecycle,
      cycleLimit: options.cycleLimit,
    }),
  };
}

function localSession(): InteractiveTextSessionBinding {
  const transport = createFakeEchoJeditOpticTransport();
  return {
    mode: INTERACTIVE_TEXT_RUNTIME_LOCAL,
    session: createTextBufferOpticSession(createEchoTransportJeditOpticClient(transport)),
  };
}
