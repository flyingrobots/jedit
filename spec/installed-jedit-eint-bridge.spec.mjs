// SPDX-License-Identifier: Apache-2.0
// Spec for src/adapters/installed-jedit-eint-bridge.ts — the EINT decode
// + session-resolve bridge used by the installed in-process transport.

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createInstalledJeditEintBridge,
} from '../dist/adapters/installed-jedit-eint-bridge.js';
import {
  createInMemoryJeditWorldlineSessionPort,
} from '../dist/adapters/in-memory-jedit-worldline-session-port.js';

test('bridge factory requires sessionPort — undefined throws fast', () => {
  // Wire-level DI invariant: the bridge must NOT silently construct a
  // private fallback session port. The shared-port invariant is the entire
  // point of Slice B; a private fallback re-creates the C6 divergence bug
  // by handing the optic client a port the transport never reads from
  // (or vice versa). Mismatch must surface here, not later as a spurious
  // SESSION_NOT_REGISTERED obstruction.
  assert.throws(
    () => createInstalledJeditEintBridge({ sessionPort: undefined }),
    /sessionPort/,
  );
});

test('bridge factory requires sessionPort — null throws fast', () => {
  // JS callers can pass null even when the TS type forbids it. The runtime
  // guard must catch both null and undefined, otherwise a null port blows
  // up later in the bridge's getSession path with an opaque TypeError.
  assert.throws(
    () => createInstalledJeditEintBridge({ sessionPort: null }),
    /sessionPort/,
  );
});

test('bridge factory requires sessionPort — null options throws fast', () => {
  assert.throws(
    () => createInstalledJeditEintBridge(null),
    /sessionPort/,
  );
});

test('bridge factory accepts an explicit sessionPort', () => {
  const sessionPort = createInMemoryJeditWorldlineSessionPort();
  const bridge = createInstalledJeditEintBridge({ sessionPort });
  assert.equal(bridge.sessionPort, sessionPort);
});
