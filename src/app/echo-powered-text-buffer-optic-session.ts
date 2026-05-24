import { createTextBufferOpticSession } from './text-buffer-optic-session.js';
import type {
  JeditOpticClient,
  OpticSession,
} from '../ports/jedit-optic-client.js';

export interface EchoPoweredTextBufferOpticSessionOptions {
  readonly client: JeditOpticClient;
}

export function createEchoPoweredTextBufferOpticSession(
  options: EchoPoweredTextBufferOpticSessionOptions,
): OpticSession {
  return createTextBufferOpticSession(options.client);
}
