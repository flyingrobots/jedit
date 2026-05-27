import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';

const REPO_ROOT = process.cwd();
const RECOVERY_MODULE_PATH = path.join(REPO_ROOT, 'dist', 'app', 'jedit-restart-recovery.js');
const WITNESS_MODULE_PATH = path.join(REPO_ROOT, 'dist', 'app', 'jedit-restart-witness.js');
const OUTCOME_MODULE_PATH = path.join(REPO_ROOT, 'dist', 'app', 'jedit-intent-outcomes.js');
const LEDGER_MODULE_PATH = path.join(REPO_ROOT, 'dist', 'app', 'jedit-submission-ledger.js');
const HASH_MODULE_PATH = path.join(REPO_ROOT, 'dist', 'adapters', 'hash.js');
const OPERATION_NAME = 'replaceRangeAsTick';
const CANONICAL_BYTES_HEX = '7b7d';
const PACKAGE_ID = 'jedit.hot-text-runtime';
const RECEIPT_ID = 'receipt:restart-recovery';

let modulesPromise;

test('restart recovery adapter loads pending submission posture', async () => {
  const modules = await loadModules();
  const context = createRecoveryContext(modules);
  const recovery = modules.recovery.createJeditRestartRecoveryPort(context.ledger);
  const pending = context.outcomes.acceptIntent(context.intent);

  const posture = recovery.loadSubmissionPosture(context.intent, pending);

  assert.equal(posture.status, modules.witness.JEDIT_RESTART_WITNESS_PENDING);
});

test('restart recovery adapter loads decided submission posture', async () => {
  const modules = await loadModules();
  const context = createRecoveryContext(modules);
  const recovery = modules.recovery.createJeditRestartRecoveryPort(context.ledger);
  const applied = context.outcomes.applyIntent(
    context.intent,
    modules.outcome.createJeditReceiptHandle(RECEIPT_ID),
  );

  const posture = recovery.loadSubmissionPosture(context.intent, applied);

  assert.equal(posture.status, modules.witness.JEDIT_RESTART_WITNESS_DECIDED);
  assert.equal(posture.receipt.receiptId, RECEIPT_ID);
});

test('restart recovery adapter blocks half-accepted posture', async () => {
  const modules = await loadModules();
  const ledger = modules.ledger.createInMemoryJeditSubmissionLedgerPort();
  const intent = modules.outcome.createJeditIntentHandle(OPERATION_NAME, 'jedit-submission:half-recovery');
  const recovery = modules.recovery.createJeditRestartRecoveryPort(ledger);
  const applied = {
    status: modules.outcome.JEDIT_INTENT_OUTCOME_APPLIED,
    intent,
    receipt: modules.outcome.createJeditReceiptHandle(RECEIPT_ID),
  };

  const posture = recovery.loadSubmissionPosture(intent, applied);

  assert.equal(posture.status, modules.witness.JEDIT_RESTART_WITNESS_HALF_ACCEPTED_BLOCKED);
  assert.equal(posture.obstructionCode, modules.witness.JEDIT_RESTART_WITNESS_HALF_ACCEPTED_OBSTRUCTION_CODE);
});

function createRecoveryContext(modules) {
  const ledger = modules.ledger.createInMemoryJeditSubmissionLedgerPort();
  const outcomes = modules.outcome.createJeditIntentOutcomeLedger();
  const submissionId = modules.ledger.createJeditSubmissionId(
    CANONICAL_BYTES_HEX,
    modules.hash.createHashPort(),
  );
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
    const [recovery, witness, outcome, ledger, hash] = await Promise.all([
      import(pathToFileURL(RECOVERY_MODULE_PATH).href),
      import(pathToFileURL(WITNESS_MODULE_PATH).href),
      import(pathToFileURL(OUTCOME_MODULE_PATH).href),
      import(pathToFileURL(LEDGER_MODULE_PATH).href),
      import(pathToFileURL(HASH_MODULE_PATH).href),
    ]);

    return {
      recovery,
      witness,
      outcome,
      ledger,
      hash,
    };
  })();

  return modulesPromise;
}
