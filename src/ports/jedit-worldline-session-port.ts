// SPDX-License-Identifier: Apache-2.0
// Port for resolving JeditWorldlineSession by worldlineId on the transport
// side. Introduced as the architectural seam for the EINT cutover so the wire
// no longer carries session payloads — the optic client registers the session
// before each call and the transport looks it up by the worldlineId embedded
// in the decoded input. See
// docs/method/backlog/bad-code/optic-codec-mixes-wire-with-session.md.

import type { JeditWorldlineSession } from '../app/jedit-contract-runtime.js';

export interface JeditWorldlineSessionPort {
  registerSession(session: JeditWorldlineSession): void;
  getSession(worldlineId: string): JeditWorldlineSession;
  clearSession(worldlineId: string): void;
}

export class JeditWorldlineSessionNotRegisteredError extends Error {
  public readonly worldlineId: string;

  public constructor(worldlineId: string) {
    super(`No jedit worldline session registered for worldlineId=${worldlineId}`);
    this.name = 'JeditWorldlineSessionNotRegisteredError';
    this.worldlineId = worldlineId;
  }
}
