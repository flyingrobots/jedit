import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';

const REPO_ROOT = process.cwd();
const READING_MODULE_PATH = path.join(REPO_ROOT, 'dist', 'app', 'jedit-recovered-bounded-reading.js');
const RECOVERY_MODULE_PATH = path.join(REPO_ROOT, 'dist', 'app', 'echo-recovery.js');

let modulesPromise;

test('recovered bounded reading is not requested when Echo causal chain was not requested', async () => {
  const modules = await loadModules();
  const report = modules.recovery.createEchoRecoveryGateFixture(
    'submission:not-requested',
    'envelope:not-requested',
  );

  const result = modules.reading.readRecoveredBoundedReading(report);

  assert.equal(result.status, 'JEDIT_RECOVERED_READING_NOT_REQUESTED');
});

test('recovered bounded reading extracts Echo reading coordinates from evaluated causal chain', async () => {
  const modules = await loadModules();
  const report = withCausalChain('complete');

  const result = modules.reading.readRecoveredBoundedReading(report);

  assert.equal(result.status, 'JEDIT_RECOVERED_READING_AVAILABLE');
  assert.deepEqual(result.reading, {
    readingId: 'reading:1',
    basisDigest: 'basis:accepted',
    readingBasisDigest: 'basis:accepted',
    semanticCoordinateDigest: 'coordinate:text-window',
    readingSource: 'retained',
    readingAuthority: 'echo_committed_reading',
  });
});

test('recovered bounded reading fails closed for incomplete chain evidence', async () => {
  const modules = await loadModules();
  const report = withCausalChain('missing_retention');

  const result = modules.reading.readRecoveredBoundedReading(report);

  assert.equal(result.status, 'JEDIT_RECOVERED_READING_INCOMPLETE');
  assert.equal(result.reason, 'echo_causal_chain_evidence_incomplete');
});

test('recovered bounded reading fails closed when evaluated chain lacks a reading id', async () => {
  const modules = await loadModules();
  const report = withCausalChain('complete');
  report.causalChain.readingId = null;

  const result = modules.reading.readRecoveredBoundedReading(report);

  assert.equal(result.status, 'JEDIT_RECOVERED_READING_INCOMPLETE');
  assert.equal(result.reason, 'echo_causal_chain_missing_reading_fields');
});

function withCausalChain(evidenceHealth) {
  const report = cachedRecovery().createEchoRecoveryGateFixture(
    `submission:${evidenceHealth}`,
    `envelope:${evidenceHealth}`,
  );
  report.causalChain.status = 'evaluated';
  report.causalChain.posture = 'complete';
  report.causalChain.evidenceHealth = evidenceHealth;
  report.causalChain.ticketDigest = 'ticket:digest';
  report.causalChain.receiptDigest = 'receipt:digest';
  report.causalChain.basisDigest = 'basis:accepted';
  report.causalChain.readingBasisDigest = 'basis:accepted';
  report.causalChain.semanticCoordinateDigest = 'coordinate:text-window';
  report.causalChain.readingId = 'reading:1';
  report.causalChain.readingSource = 'retained';
  report.causalChain.readingAuthority = 'echo_committed_reading';
  return report;
}

let cachedRecoveryModule;

function cachedRecovery() {
  if (cachedRecoveryModule == null) {
    throw new TypeError('Recovery module was not loaded before fixture creation.');
  }
  return cachedRecoveryModule;
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

    const [reading, recovery] = await Promise.all([
      import(pathToFileURL(READING_MODULE_PATH).href),
      import(pathToFileURL(RECOVERY_MODULE_PATH).href),
    ]);
    cachedRecoveryModule = recovery;

    return {
      reading,
      recovery,
    };
  })();

  return modulesPromise;
}
