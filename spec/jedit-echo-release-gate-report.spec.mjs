import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import test from 'node:test';

const REPO_ROOT = process.cwd();
const RELEASE_GATE_PATH = path.join(REPO_ROOT, 'scripts', 'jedit-echo-release-gate.mjs');
const FULL_SNAPSHOT_AUTHORITY_ENV = 'JEDIT_ALLOW_FULL_SNAPSHOT_TEXT_AUTHORITY';

test('jedit Echo release gate emits happy, non-happy, replay, and authority evidence', () => {
  const result = spawnSync(process.execPath, [
    RELEASE_GATE_PATH,
    '--json-report',
  ], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    env: fullSnapshotAuthorityEnv(),
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const report = JSON.parse(result.stdout);

  assert.equal(report.ok, true);
  assert.equal(report.transport, 'installed-jedit-contract');
  assert.equal(report.install.packageId, 'jedit.hot-text-runtime');
  assert.equal('generatedPackages' in report.install, false);
  assert.equal(report.install.generatedPackageDescriptors.length, 2);
  assert.equal(report.authority.appFacingSessionPort, 'TextBufferSessionPort');
  assert.equal(report.authority.trustedLifecyclePort, 'TrustedEchoRuntimeLifecyclePort');
  assert.equal(report.authority.appCanTick, false);
  assert.equal(report.happyPath.outcome, 'APPLIED');
  assert.equal(report.happyPath.roundTrip.mutationPackageId, 'jedit.structural-history');
  assert.equal(report.happyPath.roundTrip.mutationOperationName, 'replaceTextRange');
  assert.equal(report.happyPath.roundTrip.queryPackageId, 'jedit.hot-text-runtime');
  assert.equal(report.happyPath.roundTrip.queryOperationName, 'textWindow');
  assert.equal(report.happyPath.receiptCorrelation, 'RECEIPT_CORRELATION_AVAILABLE');
  assert.equal(report.nonHappyPath.kind, 'UNSUPPORTED_MUTATION');
  assert.equal(report.nonHappyPath.outcome.status, 'OBSTRUCTED');
  assert.equal(report.nonHappyPath.hiddenRetry, false);
  assert.equal(report.replay.status, 'MATCH');
  assert.equal(report.replay.first.text, report.happyPath.roundTrip.text);
  assert.equal(report.replay.second.text, report.happyPath.roundTrip.text);
  assert.equal(report.releaseGate.hiddenRetry, false);
  assert.equal(report.releaseGate.appCanTick, false);
  assert.equal(report.releaseGate.retainedEvidenceRefCount, 4);
});

function fullSnapshotAuthorityEnv() {
  return {
    ...process.env,
    [FULL_SNAPSHOT_AUTHORITY_ENV]: '1',
  };
}
