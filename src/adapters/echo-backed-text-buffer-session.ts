import { createTextBufferSession } from '../app/text-buffer-session.js';
import type { JeditOpticClient } from '../ports/jedit-optic-client.js';
import type { TextBufferSessionPort } from '../ports/text-buffer-session.js';

export interface EchoBackedTextBufferSessionOptions {
  readonly client: JeditOpticClient;
}

export function createEchoBackedTextBufferSession(
  options: EchoBackedTextBufferSessionOptions,
): TextBufferSessionPort {
  return createTextBufferSession(options.client);
}
