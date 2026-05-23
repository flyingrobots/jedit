import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';

const REPO_ROOT = process.cwd();
const OUTCOME_MODULE_PATH = path.join(REPO_ROOT, 'dist', 'app', 'jedit-intent-outcomes.js');

let modulesPromise;

test('accepted intent remains pending until a receipt is correlated', async () => {
  const outcomes = await loadOutcomes();
  const ledger = outcomes.createJeditIntentOutcomeLedger();
  const intent = outcomes.createJeditIntentHandle('replaceRangeAsTick', 'submission-1');

  assert.deepEqual(ledger.acceptIntent(intent), {
    status: outcomes.JEDIT_INTENT_OUTCOME_ACCEPTED_PENDING,
    intent,
  });
  assert.deepEqual(ledger.observeIntent(intent), {
    status: outcomes.JEDIT_INTENT_OUTCOME_ACCEPTED_PENDING,
    intent,
  });
});

test('applied intent outcome exposes an app-safe receipt handle', async () => {
  const outcomes = await loadOutcomes();
  const ledger = outcomes.createJeditIntentOutcomeLedger();
  const intent = outcomes.createJeditIntentHandle('replaceRangeAsTick', 'submission-2');
  const receipt = outcomes.createJeditReceiptHandle('receipt-2');

  ledger.acceptIntent(intent);

  assert.deepEqual(ledger.applyIntent(intent, receipt), {
    status: outcomes.JEDIT_INTENT_OUTCOME_APPLIED,
    intent,
    receipt,
  });
  assert.deepEqual(ledger.observeIntent(intent), {
    status: outcomes.JEDIT_INTENT_OUTCOME_APPLIED,
    intent,
    receipt,
  });
});

test('rejection and obstruction are honest non-applied outcomes', async () => {
  const outcomes = await loadOutcomes();
  const ledger = outcomes.createJeditIntentOutcomeLedger();
  const rejected = outcomes.createJeditIntentHandle('replaceRangeAsTick', 'submission-3');
  const obstructed = outcomes.createJeditIntentHandle('missingOperation', 'submission-4');

  assert.equal(
    ledger.rejectIntent(rejected, 'FOOTPRINT_CONFLICT').status,
    outcomes.JEDIT_INTENT_OUTCOME_REJECTED,
  );
  assert.deepEqual(ledger.obstructIntent(obstructed, 'UNSUPPORTED_OPERATION'), {
    status: outcomes.JEDIT_INTENT_OUTCOME_OBSTRUCTED,
    intent: obstructed,
    obstructionCode: 'UNSUPPORTED_OPERATION',
  });
});

test('unknown intent handle stays explicit', async () => {
  const outcomes = await loadOutcomes();
  const ledger = outcomes.createJeditIntentOutcomeLedger();
  const intent = outcomes.createJeditIntentHandle('replaceRangeAsTick', 'submission-missing');

  assert.deepEqual(ledger.observeIntent(intent), {
    status: outcomes.JEDIT_INTENT_OUTCOME_UNKNOWN,
    intent,
  });
});

async function loadOutcomes() {
  if (modulesPromise) {
    return modulesPromise;
  }

  modulesPromise = (async () => {
    const build = spawnSync('npm', ['run', '--silent', 'build'], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
    });

    assert.equal(build.status, 0, build.stderr || build.stdout);
    return import(pathToFileURL(OUTCOME_MODULE_PATH).href);
  })();

  return modulesPromise;
}
