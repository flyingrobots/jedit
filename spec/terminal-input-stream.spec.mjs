import assert from 'node:assert/strict';
import test from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { importDist } from './workspace-helpers.mjs';

const ESCAPE_SETTLE_MS = 60;

async function stream() {
  const { terminalInputStream } = await importDist('adapters', 'terminal-input-stream.js');
  const tokens = [];
  return { tokens, input: terminalInputStream((token) => tokens.push(token)) };
}

test('complete escape sequences and printable keys are split into tokens', async () => {
  const { tokens, input } = await stream();
  input.accept('a\u001b[Ab');
  assert.deepEqual(tokens, ['a', '\u001b[A', 'b']);
  input.dispose();
});

test('an unfinished CSI prefix is flushed after the escape delay', async () => {
  const { tokens, input } = await stream();
  input.accept('\u001b[');
  await delay(ESCAPE_SETTLE_MS);
  input.accept('\u0003');
  assert.deepEqual(tokens, ['\u001b[', '\u0003']);
  input.dispose();
});

test('control keys inside an unfinished CSI prefix are delivered on their own', async () => {
  const { tokens, input } = await stream();
  input.accept('\u001b[');
  input.accept('\u0003');
  assert.deepEqual(tokens, ['\u001b[', '\u0003']);
  input.dispose();
});
