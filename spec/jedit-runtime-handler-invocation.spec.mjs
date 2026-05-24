import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';

const REPO_ROOT = process.cwd();
const INVOCATION_MODULE_PATH = path.join(REPO_ROOT, 'dist', 'app', 'jedit-runtime-handler-invocation.js');
const OPERATION_NAME = 'createBufferWorldline';

let invocationModulePromise;

test('scheduler authority invokes a registered jedit mutation handler', async () => {
  const invocation = await loadInvocationModule();
  const calls = [];
  const registry = {
    executeMutation(request) {
      calls.push(request.operationName);
      return {
        handled: request.operationName,
      };
    },
  };

  const outcome = invocation.invokeJeditMutationHandler(registry, {
    authority: invocation.JEDIT_HANDLER_INVOCATION_SCHEDULER_AUTHORITY,
    mutation: {
      operationName: OPERATION_NAME,
    },
  });

  assert.equal(outcome.status, invocation.JEDIT_HANDLER_INVOCATION_STATUS_INVOKED);
  assert.deepEqual(calls, [OPERATION_NAME]);
  assert.deepEqual(outcome.result, { handled: OPERATION_NAME });
});

test('application authority is blocked before jedit mutation handler execution', async () => {
  const invocation = await loadInvocationModule();
  const registry = {
    executeMutation() {
      assert.fail('application authority must not invoke mutation handlers');
    },
  };

  const outcome = invocation.invokeJeditMutationHandler(registry, {
    authority: invocation.JEDIT_HANDLER_INVOCATION_APPLICATION_AUTHORITY,
    mutation: {
      operationName: OPERATION_NAME,
    },
  });

  assert.equal(outcome.status, invocation.JEDIT_HANDLER_INVOCATION_STATUS_BLOCKED);
  assert.equal(outcome.obstruction.code, invocation.JEDIT_HANDLER_INVOCATION_BLOCKED_CODE);
});

async function loadInvocationModule() {
  if (invocationModulePromise) {
    return invocationModulePromise;
  }

  invocationModulePromise = (async () => {
    const build = spawnSync('npm', ['run', '--silent', 'build'], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
    });

    assert.equal(build.status, 0, build.stderr || build.stdout);

    return import(pathToFileURL(INVOCATION_MODULE_PATH).href);
  })();

  return invocationModulePromise;
}
