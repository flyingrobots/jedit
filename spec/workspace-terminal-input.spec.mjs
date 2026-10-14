import assert from 'node:assert/strict';
import test from 'node:test';
import { createEventBus } from '@flyingrobots/bijou-tui';
import { importDist } from './dist-helpers.mjs';

 test('the production input boundary emits Unicode, modified arrows, and hover through the Bijou event bus', async () => {
  const { workspaceTerminalIO } = await importDist('adapters', 'workspace-terminal-io.js');
  let input;
  let disposed = false;
  const rawIO = { rawInput: (handler) => {
    input = handler;
    return { dispose: () => { disposed = true; } };
  }, onResize: () => ({ dispose() {} }) };
  const bus = createEventBus();
  const received = [];
  bus.on((msg) => received.push(msg));
  const connection = bus.connectIO(workspaceTerminalIO(rawIO), { mouse: true });
  input('/é界🦀');
  input('\x1b[1;3A');
  input('\x1b[<35;6;8M');
  assert.deepEqual(received.map((msg) => msg.key ?? msg.action), ['/', 'é', '界', '🦀', 'up', 'move']);
  assert.equal(received[4].alt, true);
  assert.equal(received[5].col, 5);
  assert.equal(received[5].row, 7);
  connection.dispose();
  assert.equal(disposed, true);
});

 test('split escape sequences stay intact, ordinary keys preserve modifiers, and lone Escape is delivered', async () => {
  const { workspaceTerminalIO } = await importDist('adapters', 'workspace-terminal-io.js');
  let input;
  const rawIO = { rawInput: (handler) => { input = handler; return { dispose() {} }; }, onResize: () => ({ dispose() {} }) };
  const bus = createEventBus();
  const received = [];
  bus.on((msg) => received.push(msg));
  const connection = bus.connectIO(workspaceTerminalIO(rawIO), { mouse: true });
  input('\x1b[1;'); input('3A'); input('J\x02'); input('\x1b');
  await new Promise((resolve) => setTimeout(resolve, 40));
  assert.deepEqual(received.map((msg) => msg.key), ['up', 'j', 'b', 'escape']);
  assert.equal(received[1].shift, true);
  assert.equal(received[2].ctrl, true);
  connection.dispose();
});
