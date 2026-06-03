import assert from 'node:assert/strict';
import test from 'node:test';
import { importDist } from './workspace-helpers.mjs';

const PENDING_COMMAND = Symbol('pending-command');

test('workspace time tick command returns a cleanup handle immediately', async () => {
  const [commands, messages] = await Promise.all([
    importDist('adapters', 'workspace-animation-commands.js'),
    importDist('app', 'workspace', 'msg.js'),
  ]);
  const emitted = [];
  let pulseHandler;
  let disposed = false;

  const cleanup = {
    dispose: () => {
      disposed = true;
    },
  };
  const result = commands.createWorkspaceTimeTickCmd()(
    (msg) => emitted.push(msg),
    {
      onPulse: (handler) => {
        pulseHandler = handler;
        return cleanup;
      },
    },
  );
  const completion = Promise.resolve(result);
  const immediateResult = await Promise.race([
    completion,
    new Promise((resolve) => setImmediate(() => resolve(PENDING_COMMAND))),
  ]);

  assert.notEqual(immediateResult, PENDING_COMMAND);
  assert.equal(immediateResult, cleanup);
  assert.equal(typeof pulseHandler, 'function');

  pulseHandler(0.017);

  assert.deepEqual(emitted, [{
    type: messages.WorkspaceMessageTypes.TimeTick,
    time: 0.017,
  }]);

  immediateResult.dispose();

  assert.equal(disposed, true);
});
