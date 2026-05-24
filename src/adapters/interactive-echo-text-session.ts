import { createEchoTransportJeditOpticClient } from './jedit-echo-optic-client.js';
import { createFakeEchoJeditOpticTransport } from './fake-echo-jedit-optic-transport.js';
import { createInstalledJeditContractEchoTransport } from './installed-jedit-contract-echo-transport.js';
import { createEchoBackedTextBufferSession } from './echo-backed-text-buffer-session.js';
import { createTextBufferSession } from '../app/text-buffer-session.js';
import {
  INTERACTIVE_TEXT_RUNTIME_ECHO,
  INTERACTIVE_TEXT_RUNTIME_LOCAL,
  type InteractiveTextRuntimeMode,
} from '../app/interactive-text-runtime-mode.js';
import type { TextBufferSessionPort } from '../ports/text-buffer-session.js';

export interface InteractiveTextSessionOptions {
  readonly mode: InteractiveTextRuntimeMode;
}

export interface InteractiveTextSessionBinding {
  readonly mode: InteractiveTextRuntimeMode;
  readonly session: TextBufferSessionPort;
}

export function createInteractiveTextSession(
  options: InteractiveTextSessionOptions,
): InteractiveTextSessionBinding {
  return options.mode === INTERACTIVE_TEXT_RUNTIME_ECHO
    ? echoBackedSession()
    : localSession();
}

function echoBackedSession(): InteractiveTextSessionBinding {
  const transport = createInstalledJeditContractEchoTransport();
  return {
    mode: INTERACTIVE_TEXT_RUNTIME_ECHO,
    session: createEchoBackedTextBufferSession({
      client: createEchoTransportJeditOpticClient(transport),
    }),
  };
}

function localSession(): InteractiveTextSessionBinding {
  const transport = createFakeEchoJeditOpticTransport();
  return {
    mode: INTERACTIVE_TEXT_RUNTIME_LOCAL,
    session: createTextBufferSession(createEchoTransportJeditOpticClient(transport)),
  };
}
