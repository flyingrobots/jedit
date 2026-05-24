import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import test from 'node:test';

const REPO_ROOT = process.cwd();
const CLI_PATH = path.join(REPO_ROOT, 'scripts', 'jedit-echo-powered-session.mjs');

test('Echo-powered session CLI reports app capability, lifecycle, and reading evidence', () => {
  const build = spawnSync(process.execPath, ['node_modules/typescript/bin/tsc', '-p', 'tsconfig.json'], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });
  assert.equal(build.status, 0, build.stderr || build.stdout);

  const result = spawnSync(process.execPath, [
    CLI_PATH,
    '--json',
    '--text',
    'hello',
    '--cycle-limit',
    '6',
  ], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });

  assert.equal(result.status, 0, result.stderr);
  const summary = JSON.parse(result.stdout);
  assert.equal(summary.ok, true);
  assert.equal(summary.transport, 'installed-jedit-contract');
  assert.equal(summary.dryRun, false);
  assert.equal(summary.install.packageId, 'jedit.hot-text-runtime');
  assert.equal(summary.authority.appFacingCapability, 'TextBufferOptic');
  assert.equal(summary.authority.appCanTick, false);
  assert.deepEqual(summary.lifecycleRequests, [
    { cycleLimit: 6 },
    { cycleLimit: 6 },
  ]);
  assert.deepEqual(summary.stopRequests, [
    { requested: true },
  ]);
  assert.deepEqual(summary.shutdown, {
    accepted: true,
    lastRunCompletion: 'stopped',
    appCanTick: false,
  });
  assert.equal(summary.report.text, 'hello');
  assert.equal(summary.report.outcome.status, 'APPLIED');
  assert.equal(summary.report.outcomeTrail[0].status, 'ACCEPTED_PENDING');
  assert.equal(summary.report.receiptCorrelation.status, 'RECEIPT_CORRELATION_AVAILABLE');
  assert.equal(summary.report.receiptCorrelation.receipt.receiptId, summary.report.receiptId);
  assert.equal(summary.report.ticketedRuntimeIngress.status, 'TICKETED_RUNTIME_INGRESS_MISSING');
  assert.notEqual(
    summary.report.ticketedRuntimeIngress.submissionId,
    summary.report.outcome.receipt.receiptId,
  );
  assert.equal(summary.report.retainedEvidence.refs.length, 4);
  assert.equal(summary.report.restartPosture.status, 'PARTIAL');
  assert.equal(summary.report.restartPosture.acceptedSubmissionRecovery, 'UNAVAILABLE');
  assert.equal(summary.reading.readingId, summary.report.readingId);
  assert.equal(summary.replay.status, 'UNAVAILABLE');
  assert.equal(typeof summary.report.receiptId, 'string');
  assert.equal(typeof summary.report.readingId, 'string');
  assert.equal(summary.report.truncated, false);
});

test('Echo-powered session CLI dry-run reports installed package witness plan', () => {
  const result = spawnSync(process.execPath, [
    CLI_PATH,
    '--json',
    '--dry-run',
    '--cycle-limit',
    '8',
  ], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });

  assert.equal(result.status, 0, result.stderr);
  const summary = JSON.parse(result.stdout);
  assert.equal(summary.ok, true);
  assert.equal(summary.dryRun, true);
  assert.equal(summary.transport, 'installed-jedit-contract');
  assert.equal(summary.install.packageId, 'jedit.hot-text-runtime');
  assert.equal(summary.plan.cycleLimit, 8);
  assert.equal(summary.plan.appCanTick, false);
  assert.equal(summary.replay.status, 'UNAVAILABLE');
});

test('Echo-powered session CLI reports unsupported mutation as final obstruction', () => {
  const result = spawnSync(process.execPath, [
    CLI_PATH,
    '--json',
    '--unsupported-mutation',
    'unsupportedMutation',
  ], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });

  assert.equal(result.status, 0, result.stderr);
  const summary = JSON.parse(result.stdout);
  assert.equal(summary.ok, true);
  assert.equal(summary.nonHappyPath.kind, 'UNSUPPORTED_MUTATION');
  assert.equal(summary.nonHappyPath.outcome.status, 'OBSTRUCTED');
  assert.equal(summary.nonHappyPath.hiddenRetry, false);
  assert.equal(summary.nonHappyPath.healthyLaterWorkCanProceed, true);
  assert.equal(summary.nonHappyPath.retryDoctrine, 'retry requires a new explicit causal input');
});

test('Echo-powered session CLI has a local replay compare path', () => {
  const result = spawnSync(process.execPath, [
    CLI_PATH,
    '--json',
    '--replay-local',
  ], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });

  assert.equal(result.status, 0, result.stderr);
  const summary = JSON.parse(result.stdout);
  assert.equal(summary.ok, true);
  assert.equal(summary.replayLocal.status, 'MATCH');
  assert.equal(summary.replayLocal.first.receiptId, summary.replayLocal.second.receiptId);
  assert.equal(summary.replayLocal.wallClockCadenceSemantic, false);
});

test('Echo-powered session CLI can run healthy work after unsupported mutation witness', () => {
  const result = spawnSync(process.execPath, [
    CLI_PATH,
    '--json',
    '--text',
    'still healthy',
  ], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });

  assert.equal(result.status, 0, result.stderr);
  const summary = JSON.parse(result.stdout);
  assert.equal(summary.ok, true);
  assert.equal(summary.report.text, 'still healthy');
  assert.equal(summary.report.outcome.status, 'APPLIED');
});

test('Echo-powered session CLI rejects invalid cycle limits as JSON failures', () => {
  const result = spawnSync(process.execPath, [
    CLI_PATH,
    '--json',
    '--cycle-limit',
    '0',
  ], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });

  assert.notEqual(result.status, 0);
  const summary = JSON.parse(result.stdout);
  assert.equal(summary.ok, false);
  assert.equal(summary.message, 'invalid cycle limit: 0');
});
