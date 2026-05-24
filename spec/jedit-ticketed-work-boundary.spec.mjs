import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';

const REPO_ROOT = process.cwd();
const TICKETED_WORK_MODULE_PATH = path.join(REPO_ROOT, 'dist', 'app', 'jedit-ticketed-work-boundary.js');
const HASH_MODULE_PATH = path.join(REPO_ROOT, 'dist', 'adapters', 'hash.js');
const SUBMISSION_ID = 'jedit-submission:abc';
const PACKAGE_ID = 'jedit.hot-text-runtime';
const OPERATION_NAME = 'replaceRangeAsTick';
const CANONICAL_REQUEST_BYTES_HEX = '7b7d';

let modulesPromise;

test('ticketed work preserves submission package and operation identity', async () => {
  const modules = await loadModules();
  const ticketedWork = modules.ticketedWork.createJeditTicketedWork(ticketedWorkRequest(), modules.hash.createHashPort());

  assert.equal(ticketedWork.status, modules.ticketedWork.JEDIT_TICKETED_WORK_AVAILABLE);
  assert.equal(ticketedWork.submissionId, SUBMISSION_ID);
  assert.equal(ticketedWork.packageId, PACKAGE_ID);
  assert.equal(ticketedWork.operationName, OPERATION_NAME);
  assert.notEqual(ticketedWork.ticketId, SUBMISSION_ID);
});

test('missing ticketed work remains typed', async () => {
  const modules = await loadModules();
  const ticketedWork = modules.ticketedWork.missingJeditTicketedWork(SUBMISSION_ID);

  assert.equal(ticketedWork.status, modules.ticketedWork.JEDIT_TICKETED_WORK_MISSING);
  assert.equal(ticketedWork.obstruction.code, modules.ticketedWork.JEDIT_TICKETED_WORK_MISSING_CODE);
});

function ticketedWorkRequest() {
  return {
    submissionId: SUBMISSION_ID,
    packageId: PACKAGE_ID,
    operationName: OPERATION_NAME,
    canonicalRequestBytesHex: CANONICAL_REQUEST_BYTES_HEX,
  };
}

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

    const [ticketedWork, hash] = await Promise.all([
      import(pathToFileURL(TICKETED_WORK_MODULE_PATH).href),
      import(pathToFileURL(HASH_MODULE_PATH).href),
    ]);

    return {
      ticketedWork,
      hash,
    };
  })();

  return modulesPromise;
}
