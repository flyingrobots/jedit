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
  readonly echoSessionFactory?: InteractiveTextSessionFactory;
  readonly localSessionFactory?: InteractiveTextSessionFactory;
}

export interface InteractiveTextSessionBinding {
  readonly mode: InteractiveTextRuntimeMode;
  readonly session: TextBufferSessionPort;
}

export interface InteractiveTextSessionFactory {
  create(): TextBufferSessionPort;
}

export class InteractiveTextSessionError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'InteractiveTextSessionError';
  }
}

export function createInteractiveTextSession(
  options: InteractiveTextSessionOptions,
): InteractiveTextSessionBinding {
  if (options.mode === INTERACTIVE_TEXT_RUNTIME_ECHO) {
    return echoBackedSession(options.echoSessionFactory ?? defaultEchoSessionFactory());
  }
  if (options.mode === INTERACTIVE_TEXT_RUNTIME_LOCAL) {
    return localSession(options.localSessionFactory ?? defaultLocalSessionFactory());
  }
  throw new InteractiveTextSessionError('Unsupported interactive text runtime mode.');
}

function echoBackedSession(factory: InteractiveTextSessionFactory): InteractiveTextSessionBinding {
  return {
    mode: INTERACTIVE_TEXT_RUNTIME_ECHO,
    session: factory.create(),
  };
}

function localSession(factory: InteractiveTextSessionFactory): InteractiveTextSessionBinding {
  return {
    mode: INTERACTIVE_TEXT_RUNTIME_LOCAL,
    session: factory.create(),
  };
}

function defaultEchoSessionFactory(): InteractiveTextSessionFactory {
  return {
    create() {
      const transport = createInstalledJeditContractEchoTransport();
      return createEchoBackedTextBufferSession({
        client: createEchoTransportJeditOpticClient(transport),
      });
    },
  };
}

function defaultLocalSessionFactory(): InteractiveTextSessionFactory {
  return {
    create() {
      const transport = createFakeEchoJeditOpticTransport();
      return createTextBufferSession(createEchoTransportJeditOpticClient(transport));
    },
  };
}
