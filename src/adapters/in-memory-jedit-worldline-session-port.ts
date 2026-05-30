// SPDX-License-Identifier: Apache-2.0
// In-memory adapter for JeditWorldlineSessionPort. Stores the latest session
// per worldlineId. Optic client registers a session before each call;
// transport resolves it by the worldlineId carried in the decoded input.

import type { JeditWorldlineSession } from '../app/jedit-contract-runtime.js';
import {
  JeditWorldlineSessionNotRegisteredError,
  type JeditWorldlineId,
  type JeditWorldlineSessionPort,
} from '../ports/jedit-worldline-session-port.js';

export function createInMemoryJeditWorldlineSessionPort(): JeditWorldlineSessionPort {
  const sessionsByWorldlineId = new Map<JeditWorldlineId, JeditWorldlineSession>();

  return {
    registerSession(session) {
      sessionsByWorldlineId.set(session.worldline.worldlineId, session);
    },
    getSession(worldlineId) {
      const session = sessionsByWorldlineId.get(worldlineId);
      if (session === undefined) {
        throw new JeditWorldlineSessionNotRegisteredError(worldlineId);
      }
      return session;
    },
    clearSession(worldlineId) {
      sessionsByWorldlineId.delete(worldlineId);
    },
  };
}
