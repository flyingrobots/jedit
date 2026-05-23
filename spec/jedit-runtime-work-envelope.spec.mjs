import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';

const REPO_ROOT = process.cwd();
const ENVELOPE_MODULE_PATH = path.join(REPO_ROOT, 'dist', 'ports', 'jedit-runtime-work-envelope.js');
const HASH_MODULE_PATH = path.join(REPO_ROOT, 'dist', 'adapters', 'hash.js');
const ENVELOPE_SOURCE_PATH = path.join(REPO_ROOT, 'src', 'ports', 'jedit-runtime-work-envelope.ts');
const PACKAGE_ID = 'jedit-hot-text-runtime';
const OPERATION_NAME = 'replaceRangeAsTick';
const FIRST_REQUEST = new Uint8Array([1, 2, 3, 4]);
const SECOND_REQUEST = new Uint8Array([1, 2, 3, 5]);

let modulesPromise;

test('runtime work envelope identity is content addressed by generic request material', async () => {
  const modules = await loadModules();
  const hash = modules.hash.createHashPort();

  const first = modules.envelope.createJeditRuntimeWorkEnvelope({
    packageId: PACKAGE_ID,
    operationName: OPERATION_NAME,
    operationKind: modules.envelope.JEDIT_RUNTIME_WORK_OPERATION_KIND_MUTATION,
    canonicalRequestBytes: FIRST_REQUEST,
  }, hash);
  const same = modules.envelope.createJeditRuntimeWorkEnvelope({
    packageId: PACKAGE_ID,
    operationName: OPERATION_NAME,
    operationKind: modules.envelope.JEDIT_RUNTIME_WORK_OPERATION_KIND_MUTATION,
    canonicalRequestBytes: FIRST_REQUEST,
  }, hash);
  const changed = modules.envelope.createJeditRuntimeWorkEnvelope({
    packageId: PACKAGE_ID,
    operationName: OPERATION_NAME,
    operationKind: modules.envelope.JEDIT_RUNTIME_WORK_OPERATION_KIND_MUTATION,
    canonicalRequestBytes: SECOND_REQUEST,
  }, hash);

  assert.equal(first.submissionId, same.submissionId);
  assert.notEqual(first.submissionId, changed.submissionId);
  assert.equal(first.canonicalRequestBytesHex, '01020304');
  assert.equal(first.requestByteLength, FIRST_REQUEST.length);
  assert.equal(first.operationKind, modules.envelope.JEDIT_RUNTIME_WORK_OPERATION_KIND_MUTATION);
});

test('runtime work envelope port does not encode editor semantic fields', () => {
  const source = readFileSync(ENVELOPE_SOURCE_PATH, 'utf8');

  assert.doesNotMatch(source, /TextBufferOptic|rope|pane|cursor|textWindow|bufferKey|insertText|replaceRange/);
});

async function loadModules() {
  if (modulesPromise) {
    return modulesPromise;
  }

  modulesPromise = (async () => {
    const build = spawnSync('npm', ['run', '--silent', 'build'], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
    });

    assert.equal(build.status, 0, build.stderr || build.stdout);

    const [envelope, hash] = await Promise.all([
      import(pathToFileURL(ENVELOPE_MODULE_PATH).href),
      import(pathToFileURL(HASH_MODULE_PATH).href),
    ]);

    return {
      envelope,
      hash,
    };
  })();

  return modulesPromise;
}
