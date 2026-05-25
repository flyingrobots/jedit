import { createEchoTransportJeditOpticClient } from './jedit-echo-optic-client.js';
import { createFakeEchoJeditOpticTransport } from './fake-echo-jedit-optic-transport.js';
import { createInstalledJeditContractEchoTransport } from './installed-jedit-contract-echo-transport.js';
import { createEchoBackedTextBufferSession } from './echo-backed-text-buffer-session.js';
import { createTextBufferSession } from '../app/text-buffer-session.js';
import {
  TEXT_RUNTIME_PROFILE_ECHO_HOSTED,
  TEXT_RUNTIME_PROFILE_TEST_LOCAL,
  type TextRuntimeProfile,
} from '../app/text-runtime-profile.js';
import type { TextBufferSessionPort } from '../ports/text-buffer-session.js';

export interface TextRuntimeProfileSessionOptions {
  readonly profile: TextRuntimeProfile;
  readonly echoHostedSessionFactory?: TextRuntimeProfileSessionFactory;
  readonly testLocalSessionFactory?: TextRuntimeProfileSessionFactory;
}

export interface TextRuntimeProfileSessionBinding {
  readonly profile: TextRuntimeProfile;
  readonly session: TextBufferSessionPort;
}

export interface TextRuntimeProfileSessionFactory {
  create(): TextBufferSessionPort;
}

export class TextRuntimeProfileSessionError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'TextRuntimeProfileSessionError';
  }
}

export function createTextRuntimeProfileSession(
  options: TextRuntimeProfileSessionOptions,
): TextRuntimeProfileSessionBinding {
  if (options.profile === TEXT_RUNTIME_PROFILE_ECHO_HOSTED) {
    return echoHostedSession(options.echoHostedSessionFactory ?? defaultEchoHostedSessionFactory());
  }
  if (options.profile === TEXT_RUNTIME_PROFILE_TEST_LOCAL) {
    return testLocalSession(options.testLocalSessionFactory ?? defaultTestLocalSessionFactory());
  }
  throw new TextRuntimeProfileSessionError('Unsupported text runtime profile.');
}

function echoHostedSession(
  factory: TextRuntimeProfileSessionFactory,
): TextRuntimeProfileSessionBinding {
  return {
    profile: TEXT_RUNTIME_PROFILE_ECHO_HOSTED,
    session: factory.create(),
  };
}

function testLocalSession(
  factory: TextRuntimeProfileSessionFactory,
): TextRuntimeProfileSessionBinding {
  return {
    profile: TEXT_RUNTIME_PROFILE_TEST_LOCAL,
    session: factory.create(),
  };
}

function defaultEchoHostedSessionFactory(): TextRuntimeProfileSessionFactory {
  return {
    create() {
      const transport = createInstalledJeditContractEchoTransport();
      return createEchoBackedTextBufferSession({
        client: createEchoTransportJeditOpticClient(transport),
      });
    },
  };
}

function defaultTestLocalSessionFactory(): TextRuntimeProfileSessionFactory {
  return {
    create() {
      const transport = createFakeEchoJeditOpticTransport();
      return createTextBufferSession(createEchoTransportJeditOpticClient(transport));
    },
  };
}
