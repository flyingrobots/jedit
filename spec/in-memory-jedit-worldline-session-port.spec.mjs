// SPDX-License-Identifier: Apache-2.0
// Spec for src/adapters/in-memory-jedit-worldline-session-port.ts.
//
// The session port is the seam introduced by Slice B of the EINT cutover. It
// holds the jedit-side cache (worldline + state + tickMetadata +
// checkpointMetadata) keyed by worldlineId so that the wire only needs to
// carry (op_id, input) — the session never crosses the engine boundary. See
// docs/method/backlog/bad-code/optic-codec-mixes-wire-with-session.md.

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createInMemoryJeditWorldlineSessionPort,
} from '../dist/adapters/in-memory-jedit-worldline-session-port.js';
import {
  JeditWorldlineSessionNotRegisteredError,
} from '../dist/ports/jedit-worldline-session-port.js';

function makeSession(worldlineId, canonicalHeadId = 'head-1') {
  return {
    worldline: {
      worldlineId,
      canonicalHeadId,
    },
    state: { roots: [], ticks: [], editGroups: [], checkpoints: [] },
    tickMetadata: [],
    checkpointMetadata: [],
  };
}

test('registerSession then getSession returns the stored session', () => {
  const port = createInMemoryJeditWorldlineSessionPort();
  const session = makeSession('worldline-a');

  port.registerSession(session);

  assert.equal(port.getSession('worldline-a'), session);
});

test('registerSession overwrites an existing entry for the same worldlineId', () => {
  const port = createInMemoryJeditWorldlineSessionPort();
  const first = makeSession('worldline-a', 'head-1');
  const second = makeSession('worldline-a', 'head-2');

  port.registerSession(first);
  port.registerSession(second);

  assert.equal(port.getSession('worldline-a'), second);
});

test('getSession throws JeditWorldlineSessionNotRegisteredError for unknown id', () => {
  const port = createInMemoryJeditWorldlineSessionPort();

  assert.throws(
    () => port.getSession('worldline-missing'),
    (error) => {
      assert.ok(error instanceof JeditWorldlineSessionNotRegisteredError);
      assert.equal(error.worldlineId, 'worldline-missing');
      return true;
    },
  );
});

test('clearSession removes the entry; subsequent getSession throws', () => {
  const port = createInMemoryJeditWorldlineSessionPort();
  const session = makeSession('worldline-b');
  port.registerSession(session);

  port.clearSession('worldline-b');

  assert.throws(
    () => port.getSession('worldline-b'),
    JeditWorldlineSessionNotRegisteredError,
  );
});

test('clearSession on a missing id is a no-op', () => {
  const port = createInMemoryJeditWorldlineSessionPort();

  assert.doesNotThrow(() => port.clearSession('never-registered'));
});

test('two worldlines are tracked independently', () => {
  const port = createInMemoryJeditWorldlineSessionPort();
  const a = makeSession('worldline-a');
  const b = makeSession('worldline-b');

  port.registerSession(a);
  port.registerSession(b);

  assert.equal(port.getSession('worldline-a'), a);
  assert.equal(port.getSession('worldline-b'), b);

  port.clearSession('worldline-a');
  assert.throws(() => port.getSession('worldline-a'), JeditWorldlineSessionNotRegisteredError);
  assert.equal(port.getSession('worldline-b'), b);
});
