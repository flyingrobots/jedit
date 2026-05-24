import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';

const REPO_ROOT = process.cwd();
const CORRELATION_MODULE_PATH = path.join(REPO_ROOT, 'dist', 'app', 'jedit-receipt-correlation.js');
const SUBMISSION_ID = 'jedit-submission:abc';
const RECEIPT_ID = 'echo-receipt:def';
const UNSUPPORTED_REASON = 'unsupported operation did not produce a receipt';

let correlationModulePromise;

test('real Echo receipt evidence maps to an app-safe receipt correlation', async () => {
  const correlation = await loadCorrelationModule();
  const outcome = correlation.correlateJeditEchoReceipt({
    submissionId: SUBMISSION_ID,
    receiptId: RECEIPT_ID,
  });

  assert.equal(outcome.status, correlation.JEDIT_RECEIPT_CORRELATION_AVAILABLE);
  assert.equal(outcome.submissionId, SUBMISSION_ID);
  assert.equal(outcome.receipt.receiptId, RECEIPT_ID);
});

test('missing Echo receipt evidence remains typed and non-successful', async () => {
  const correlation = await loadCorrelationModule();
  const outcome = correlation.missingJeditReceiptCorrelation(SUBMISSION_ID);

  assert.equal(outcome.status, correlation.JEDIT_RECEIPT_CORRELATION_MISSING);
  assert.equal(outcome.obstruction.code, correlation.JEDIT_RECEIPT_CORRELATION_MISSING_CODE);
  assert.equal('receipt' in outcome, false);
});

test('unsupported operation correlation does not fabricate receipts', async () => {
  const correlation = await loadCorrelationModule();
  const outcome = correlation.unsupportedJeditReceiptCorrelation(SUBMISSION_ID, UNSUPPORTED_REASON);

  assert.equal(outcome.status, correlation.JEDIT_RECEIPT_CORRELATION_UNSUPPORTED);
  assert.equal(outcome.obstruction.code, correlation.JEDIT_RECEIPT_CORRELATION_UNSUPPORTED_CODE);
  assert.equal(outcome.obstruction.reason, UNSUPPORTED_REASON);
  assert.equal('receipt' in outcome, false);
});

async function loadCorrelationModule() {
  if (correlationModulePromise) {
    return correlationModulePromise;
  }

  correlationModulePromise = (async () => {
    const build = spawnSync('npm', ['run', '--silent', 'build'], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
    });

    assert.equal(build.status, 0, build.stderr || build.stdout);

    return import(pathToFileURL(CORRELATION_MODULE_PATH).href);
  })();

  return correlationModulePromise;
}
