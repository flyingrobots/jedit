// SPDX-License-Identifier: Apache-2.0
// Jedit-specific extension of EchoWasmKernelTransport for the in-process
// Slice B EINT cutover. Carries the session-port instance that the
// in-process transport reads from and the optic client writes to, so they
// can share one port without leaking jedit concepts into the generic
// transport contract.
//
// This interface is a temporary compatibility scaffold. It exists only
// because the wire (EINT) does not yet carry session attribution. Once
// echo cycle 0025 ships Session as a first-class engine surface, this
// seam — and the jeditSessionPort field — gets deleted per
// docs/method/backlog/asap/sessions-migration.md.

import type { EchoWasmKernelTransport } from './echo-kernel-transport.js';
import type { JeditWorldlineSessionPort } from './jedit-worldline-session-port.js';

export interface JeditTransportSeam extends EchoWasmKernelTransport {
  /**
   * Session port the in-process transport will read from at EINT decode
   * time. The optic client must register sessions on this same instance
   * before each call.
   *
   * Real-WASM transports do not implement `JeditTransportSeam` (they
   * remain a plain `EchoWasmKernelTransport`), so this field never
   * appears on the generic kernel transport contract.
   *
   * @deprecated Slated for deletion once echo cycle 0025 ships
   *   Session as an engine-side concept and jedit threads `SessionId`
   *   through its optic client surface. See
   *   `docs/method/backlog/asap/sessions-migration.md` for the
   *   migration phases and deletion criteria.
   */
  readonly jeditSessionPort: JeditWorldlineSessionPort;
}

/**
 * Type guard: does this transport expose a jedit session port?
 *
   * In-process installed and fixture transports return `JeditTransportSeam`;
   * the real-WASM transport returns plain `EchoWasmKernelTransport`. The optic
   * client uses this guard to enforce the shared-port invariant without
   * silently creating a private fallback port for the in-process case.
 *
 * The `in` check is sufficient: `JeditTransportSeam` declares
 * `jeditSessionPort` as a required field, so any object that has the key
 * also satisfies the type. Implementations that bypass TypeScript and
 * return `undefined` despite the type are violating the contract.
 */
export function isJeditTransportSeam(
  transport: EchoWasmKernelTransport,
): transport is JeditTransportSeam {
  if (!('jeditSessionPort' in transport)) {
    return false;
  }
  const candidate = transport.jeditSessionPort;
  if (candidate === null || candidate === undefined || typeof candidate !== 'object') {
    return false;
  }
  // Validate the required runtime surface so downstream consumers don't
  // immediately crash on .registerSession(...) when a transport returns a
  // half-shaped object that happens to have the discriminator key.
  return hasFunctionProperty(candidate, 'registerSession')
    && hasFunctionProperty(candidate, 'getSession')
    && hasFunctionProperty(candidate, 'clearSession');
}

function hasFunctionProperty(
  value: object,
  name: 'registerSession' | 'getSession' | 'clearSession',
): boolean {
  if (!(name in value)) {
    return false;
  }
  const descriptor = Object.getOwnPropertyDescriptor(value, name)
    ?? Object.getOwnPropertyDescriptor(Object.getPrototypeOf(value), name);
  return typeof descriptor?.value === 'function';
}
