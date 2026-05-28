import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';

const REPO_ROOT = process.cwd();
const LEDGER_MODULE_PATH = path.join(REPO_ROOT, 'dist', 'app', 'jedit-submission-ledger.js');
const HASH_MODULE_PATH = path.join(REPO_ROOT, 'dist', 'adapters', 'hash.js');
const PACKAGE_ID = 'jedit.hot-text-runtime';
const OPERATION_NAME = 'replaceRangeAsTick';
const CANONICAL_BYTES_HEX = '7b7d';

let modulesPromise;

test('accepted submissions are recorded before execution decisions', async () => {
  const modules = await loadModules();
  const hash = modules.hash.createHashPort();
  const ledger = modules.ledger.createInMemoryJeditSubmissionLedgerPort();
  const submissionId = modules.ledger.createJeditSubmissionId(CANONICAL_BYTES_HEX, hash);
  const accepted = modules.ledger.recordAcceptedJeditSubmission(ledger, {
    submissionId,
    packageId: PACKAGE_ID,
    operationName: OPERATION_NAME,
    canonicalRequestBytesHex: CANONICAL_BYTES_HEX,
  });
  const read = ledger.readSubmission(submissionId);

  assert.equal(accepted.status, modules.ledger.JEDIT_SUBMISSION_LEDGER_ACCEPTED);
  assert.equal(read.status, modules.ledger.JEDIT_SUBMISSION_LEDGER_READ_FOUND);
  assert.equal(read.record.canonicalRequestBytesHex, CANONICAL_BYTES_HEX);
});

test('duplicate canonical submissions return stable duplicate posture', async () => {
  const modules = await loadModules();
  const hash = modules.hash.createHashPort();
  const ledger = modules.ledger.createInMemoryJeditSubmissionLedgerPort();
  const record = {
    submissionId: modules.ledger.createJeditSubmissionId(CANONICAL_BYTES_HEX, hash),
    packageId: PACKAGE_ID,
    operationName: OPERATION_NAME,
    canonicalRequestBytesHex: CANONICAL_BYTES_HEX,
  };
  const first = modules.ledger.recordAcceptedJeditSubmission(ledger, record);
  const second = modules.ledger.recordAcceptedJeditSubmission(ledger, record);

  assert.equal(first.status, modules.ledger.JEDIT_SUBMISSION_LEDGER_ACCEPTED);
  assert.equal(second.status, modules.ledger.JEDIT_SUBMISSION_LEDGER_DUPLICATE);
  assert.deepEqual(second.record, first.record);
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

    const [ledger, hash] = await Promise.all([
      import(pathToFileURL(LEDGER_MODULE_PATH).href),
      import(pathToFileURL(HASH_MODULE_PATH).href),
    ]);

    return {
      ledger,
      hash,
    };
  })();

  return modulesPromise;
}
