import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';

const REPO_ROOT = process.cwd();
const WITNESS_MODULE_PATH = path.join(REPO_ROOT, 'dist', 'app', 'jedit-restart-witness.js');
const OUTCOME_MODULE_PATH = path.join(REPO_ROOT, 'dist', 'app', 'jedit-intent-outcomes.js');
const LEDGER_MODULE_PATH = path.join(REPO_ROOT, 'dist', 'app', 'jedit-submission-ledger.js');
const HASH_MODULE_PATH = path.join(REPO_ROOT, 'dist', 'adapters', 'hash.js');
const OPERATION_NAME = 'replaceRangeAsTick';
const CANONICAL_BYTES_HEX = '7b7d';
const PACKAGE_ID = 'jedit.hot-text-runtime';
const RECEIPT_ID = 'receipt:restart';
const REJECT_REASON = 'conflict';

let modulesPromise;

test('restart witness reports accepted pending submissions as pending', async () => {
  const modules = await loadModules();
  const context = createRestartContext(modules);
  const pending = context.outcomes.acceptIntent(context.intent);
  const posture = modules.witness.recoverJeditSubmissionAfterRestart(context.ledger, context.intent, pending);

  assert.equal(posture.status, modules.witness.JEDIT_RESTART_WITNESS_PENDING);
});

test('restart witness reports decided submissions with receipt correlation', async () => {
  const modules = await loadModules();
  const context = createRestartContext(modules);
  const applied = context.outcomes.applyIntent(
    context.intent,
    modules.outcome.createJeditReceiptHandle(RECEIPT_ID),
  );
  const posture = modules.witness.recoverJeditSubmissionAfterRestart(context.ledger, context.intent, applied);

  assert.equal(posture.status, modules.witness.JEDIT_RESTART_WITNESS_DECIDED);
  assert.equal(posture.receipt.receiptId, RECEIPT_ID);
});

test('restart witness reports rejected submissions as rejected', async () => {
  const modules = await loadModules();
  const context = createRestartContext(modules);
  const rejected = context.outcomes.rejectIntent(context.intent, REJECT_REASON);
  const posture = modules.witness.recoverJeditSubmissionAfterRestart(context.ledger, context.intent, rejected);

  assert.equal(posture.status, modules.witness.JEDIT_RESTART_WITNESS_REJECTED);
  assert.equal(posture.reason, REJECT_REASON);
});

test('restart witness keeps unknown submissions typed', async () => {
  const modules = await loadModules();
  const ledger = modules.ledger.createInMemoryJeditSubmissionLedgerPort();
  const intent = modules.outcome.createJeditIntentHandle(OPERATION_NAME, 'jedit-submission:missing');
  const posture = modules.witness.recoverJeditSubmissionAfterRestart(
    ledger,
    intent,
    { status: modules.outcome.JEDIT_INTENT_OUTCOME_UNKNOWN, intent },
  );

  assert.equal(posture.status, modules.witness.JEDIT_RESTART_WITNESS_UNKNOWN);
});

test('restart witness blocks half accepted state', async () => {
  const modules = await loadModules();
  const ledger = modules.ledger.createInMemoryJeditSubmissionLedgerPort();
  const intent = modules.outcome.createJeditIntentHandle(OPERATION_NAME, 'jedit-submission:half');
  const applied = {
    status: modules.outcome.JEDIT_INTENT_OUTCOME_APPLIED,
    intent,
    receipt: modules.outcome.createJeditReceiptHandle(RECEIPT_ID),
  };
  const posture = modules.witness.recoverJeditSubmissionAfterRestart(ledger, intent, applied);

  assert.equal(posture.status, modules.witness.JEDIT_RESTART_WITNESS_HALF_ACCEPTED_BLOCKED);
});

function createRestartContext(modules) {
  const ledger = modules.ledger.createInMemoryJeditSubmissionLedgerPort();
  const outcomes = modules.outcome.createJeditIntentOutcomeLedger();
  const submissionId = modules.ledger.createJeditSubmissionId(CANONICAL_BYTES_HEX, modules.hash.createHashPort());
  const intent = modules.outcome.createJeditIntentHandle(OPERATION_NAME, submissionId);
  modules.ledger.recordAcceptedJeditSubmission(ledger, {
    submissionId,
    packageId: PACKAGE_ID,
    operationName: OPERATION_NAME,
    canonicalRequestBytesHex: CANONICAL_BYTES_HEX,
  });

  return {
    ledger,
    outcomes,
    intent,
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

    const [witness, outcome, ledger, hash] = await Promise.all([
      import(pathToFileURL(WITNESS_MODULE_PATH).href),
      import(pathToFileURL(OUTCOME_MODULE_PATH).href),
      import(pathToFileURL(LEDGER_MODULE_PATH).href),
      import(pathToFileURL(HASH_MODULE_PATH).href),
    ]);

    return {
      witness,
      outcome,
      ledger,
      hash,
    };
  })();

  return modulesPromise;
}
