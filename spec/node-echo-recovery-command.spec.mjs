import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';

const REPO_ROOT = process.cwd();
const COMMAND_MODULE_PATH = path.join(REPO_ROOT, 'dist', 'adapters', 'node-echo-recovery-command.js');

let modulePromise;

test('node Echo recovery command preserves spawn errors in stderr diagnostics', async () => {
  const module = await loadModule();
  const port = module.createNodeEchoRecoveryCommandPort();

  const result = await port.run({
    executable: 'definitely-missing-echo-cli-for-jedit-test',
    args: [],
    timeoutMs: 1_000,
  });

  assert.equal(result.status, 'ECHO_RECOVERY_COMMAND_EXITED');
  assert.equal(result.exitCode, 1);
  assert.equal(result.stdout, '');
  assert.match(result.stderr, /ENOENT|spawn/u);
});

test('node Echo recovery command terminates timed out subprocesses', async () => {
  const module = await loadModule();
  const port = module.createNodeEchoRecoveryCommandPort();

  const result = await port.run({
    executable: process.execPath,
    args: ['-e', 'setTimeout(() => {}, 10000);'],
    timeoutMs: 10,
  });

  assert.equal(result.status, 'ECHO_RECOVERY_COMMAND_EXITED');
  assert.equal(result.exitCode, 1);
  assert.match(result.stderr, /timed out/u);
});

async function loadModule() {
  if (modulePromise) {
    return modulePromise;
  }

  modulePromise = (async () => {    return import(pathToFileURL(COMMAND_MODULE_PATH).href);
  })();

  return modulePromise;
}
