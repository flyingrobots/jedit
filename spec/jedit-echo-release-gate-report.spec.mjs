import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import test from 'node:test';

const REPO_ROOT = process.cwd();
const RELEASE_GATE_PATH = path.join(REPO_ROOT, 'scripts', 'jedit-echo-release-gate.mjs');

test('jedit Echo release gate emits plan and non-happy evidence without fixture bypass', () => {
  const result = spawnSync(process.execPath, [
    RELEASE_GATE_PATH,
    '--json-report',
  ], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const report = JSON.parse(result.stdout);

  assert.equal(report.ok, true);
  assert.equal(report.transport, 'installed-jedit-contract');
  assert.equal(report.install.packageId, 'jedit.hot-text-runtime');
  assert.equal('generatedPackages' in report.install, false);
  assert.equal(report.install.generatedPackageDescriptors.length, 2);
  assert.equal(report.plan.submitIntent, true);
  assert.equal(report.plan.appCanTick, false);
  assert.equal(report.nonHappyPath.kind, 'UNSUPPORTED_MUTATION');
  assert.equal(report.nonHappyPath.outcome.status, 'OBSTRUCTED');
  assert.equal(report.nonHappyPath.hiddenRetry, false);
  assert.equal(report.releaseGate.hiddenRetry, false);
  assert.equal(report.releaseGate.appCanTick, false);
  assert.equal(report.releaseGate.fullSnapshotFixtureBypass, false);
});
