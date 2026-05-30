// SPDX-License-Identifier: Apache-2.0
// Port for resolving JeditWorldlineSession by worldlineId on the transport
// side. Introduced as the architectural seam for the EINT cutover so the wire
// no longer carries session payloads — the optic client registers the session
// before each call and the transport looks it up by the worldlineId embedded
// in the decoded input. See
// docs/method/backlog/bad-code/optic-codec-mixes-wire-with-session.md.

import type { JeditWorldlineSession } from '../app/jedit-contract-runtime.js';

/**
 * Canonical worldline identifier as exposed by the session port.
 *
 * Today this is a string alias (no runtime brand) because the broader
 * worldlineId surface across src/app, src/ports, and the generated rope
 * contract still uses raw `string`. Promoting to a true branded value
 * object is a coordinated refactor scoped to the Phase 2 implementation
 * of echo cycle 0025 (sessions as causal contexts) — at that point the
 * engine-side `SessionId` and `WorldlineId` become first-class types and
 * jedit threads them through instead of inventing client-side variants.
 *
 * Until then, the alias gives consumers something to import and name so
 * that future migration can be a single-point change here rather than a
 * search-and-replace across every caller.
 *
 * Canonical form invariant: must equal the `worldlineId` of a
 * `JeditWorldlineSession.worldline` obtained from the contract runtime.
 * Constructing one by string concatenation is undefined behavior.
 */
export type JeditWorldlineId = string;

export interface JeditWorldlineSessionPort {
  registerSession(session: JeditWorldlineSession): void;
  getSession(worldlineId: JeditWorldlineId): JeditWorldlineSession;
  clearSession(worldlineId: JeditWorldlineId): void;
}

export class JeditWorldlineSessionNotRegisteredError extends Error {
  public readonly worldlineId: JeditWorldlineId;

  public constructor(worldlineId: JeditWorldlineId) {
    super(`No jedit worldline session registered for worldlineId=${worldlineId}`);
    this.name = 'JeditWorldlineSessionNotRegisteredError';
    this.worldlineId = worldlineId;
  }
}
