import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';

const REPO_ROOT = process.cwd();
const SCENARIO_MODULE_PATH = path.join(REPO_ROOT, 'dist', 'app', 'jedit-recovery-gate-scenario.js');
const RECOVERY_MODULE_PATH = path.join(REPO_ROOT, 'dist', 'app', 'echo-recovery.js');
const TRIPWIRE_MODULE_PATH = path.join(REPO_ROOT, 'dist', 'app', 'jedit-local-fallback-tripwire.js');
const IDENTITY_MODULE_PATH = path.join(REPO_ROOT, 'dist', 'app', 'jedit-edit-submission-identity.js');
const HASH_MODULE_PATH = path.join(REPO_ROOT, 'dist', 'adapters', 'hash.js');

let modulesPromise;

test('jedit recovery gate scenario produces an Echo-sourced happy-path recovery report', async () => {
  const modules = await loadModules();
  const identity = editIdentity(modules, 'client-op:happy');
  const echoReport = appliedEchoReport(modules, identity);
  const recovery = modules.recovery.createFakeEchoRecoveryPort([echoReport]);
  const tripwire = modules.tripwire.createJeditLocalFallbackTripwire({
    mode: 'enforced',
  });

  const result = await modules.scenario.runJeditRecoveryGateScenario({
    recovery,
    identity,
    reading: readingRequest(),
    tripwire,
  });

  assert.equal(result.status, 'JEDIT_RECOVERY_GATE_SCENARIO_READY');
  assert.equal(result.report.recoveredEdit.status, 'edit_applied');
  assert.equal(result.report.echo.sourceOfTruth, 'echo');
  assert.equal(result.report.legacyFallbackStatus, 'not_detected');
  assert.equal(result.recoveredReading.status, 'JEDIT_RECOVERED_READING_AVAILABLE');
  assert.equal(result.recoveredReading.reading.readingId, 'reading:happy');
});

test('jedit recovery gate scenario blocks on unavailable Echo recovery evidence', async () => {
  const modules = await loadModules();
  const identity = editIdentity(modules, 'client-op:missing');
  const recovery = modules.recovery.createFakeEchoRecoveryPort([]);
  const tripwire = modules.tripwire.createJeditLocalFallbackTripwire({
    mode: 'enforced',
  });

  const result = await modules.scenario.runJeditRecoveryGateScenario({
    recovery,
    identity,
    reading: readingRequest(),
    tripwire,
  });

  assert.equal(result.status, 'JEDIT_RECOVERY_GATE_SCENARIO_BLOCKED');
  assert.equal(result.diagnostic.code, 'echo_recovery_fixture_not_found');
});

test('jedit recovery gate scenario blocks on recovery adapter exceptions', async () => {
  const modules = await loadModules();
  const identity = editIdentity(modules, 'client-op:throw');
  const recovery = {
    async readExternalAppRecoveryGate() {
      throw new Error('adapter exploded');
    },
  };
  const tripwire = modules.tripwire.createJeditLocalFallbackTripwire({
    mode: 'enforced',
  });

  const result = await modules.scenario.runJeditRecoveryGateScenario({
    recovery,
    identity,
    reading: readingRequest(),
    tripwire,
  });

  assert.equal(result.status, 'JEDIT_RECOVERY_GATE_SCENARIO_BLOCKED');
  assert.equal(result.diagnostic.code, 'jedit_recovery_adapter_exception');
  assert.match(result.diagnostic.message, /adapter exploded/u);
});

test('jedit recovery gate scenario refuses Echo source-of-truth after tripwire fallback', async () => {
  const modules = await loadModules();
  const identity = editIdentity(modules, 'client-op:fallback');
  const echoReport = appliedEchoReport(modules, identity);
  const recovery = modules.recovery.createFakeEchoRecoveryPort([echoReport]);
  const tripwire = modules.tripwire.createJeditLocalFallbackTripwire({
    mode: 'enforced',
  });
  tripwire.recordLocalFallbackAttempt({
    code: 'legacy_buffer_read',
    message: 'Recovery attempted a local fallback.',
  });

  const result = await modules.scenario.runJeditRecoveryGateScenario({
    recovery,
    identity,
    reading: readingRequest(),
    tripwire,
  });

  assert.equal(result.status, 'JEDIT_RECOVERY_GATE_SCENARIO_READY');
  assert.equal(result.report.echo.sourceOfTruth, 'local_fallback_detected');
});

function appliedEchoReport(modules, identity) {
  const report = modules.recovery.createEchoRecoveryGateFixture(
    identity.submissionId,
    identity.canonicalEnvelopeDigest,
  );
  report.submission.lifecycle.posture = 'decided';
  report.submission.decision.result = 'applied';
  report.submission.decision.ticketDigest = 'ticket:happy';
  report.submission.decision.receiptDigest = 'receipt:happy';
  report.causalChain.status = 'evaluated';
  report.causalChain.posture = 'complete';
  report.causalChain.evidenceHealth = 'complete';
  report.causalChain.ticketDigest = 'ticket:happy';
  report.causalChain.receiptDigest = 'receipt:happy';
  report.causalChain.basisDigest = 'basis:happy';
  report.causalChain.readingBasisDigest = 'basis:happy';
  report.causalChain.semanticCoordinateDigest = 'coordinate:happy';
  report.causalChain.readingId = 'reading:happy';
  report.causalChain.readingSource = 'retained';
  report.causalChain.readingAuthority = 'echo_committed_reading';
  return report;
}

function editIdentity(modules, clientOperationId) {
  return modules.identity.createJeditEditSubmissionIdentity({
    appInstanceId: 'jedit-app:test',
    sessionId: 'jedit-session:test',
    clientOperationId,
    contractPackageId: 'jedit.contract:text',
    contractOperationName: 'replaceRange',
    causalBasisDigest: 'basis:happy',
    canonicalEnvelopeDigest: 'envelope:happy',
  }, modules.hash.createHashPort());
}

function readingRequest() {
  return {
    basisDigest: 'basis:happy',
    readingBasisDigest: 'basis:happy',
    semanticCoordinateDigest: 'coordinate:happy',
    readingId: 'reading:happy',
  };
}

async function loadModules() {
  if (modulesPromise) {
    return modulesPromise;
  }

  modulesPromise = (async () => {
    const [scenario, recovery, tripwire, identity, hash] = await Promise.all([
      import(pathToFileURL(SCENARIO_MODULE_PATH).href),
      import(pathToFileURL(RECOVERY_MODULE_PATH).href),
      import(pathToFileURL(TRIPWIRE_MODULE_PATH).href),
      import(pathToFileURL(IDENTITY_MODULE_PATH).href),
      import(pathToFileURL(HASH_MODULE_PATH).href),
    ]);

    return {
      scenario,
      recovery,
      tripwire,
      identity,
      hash,
    };
  })();

  return modulesPromise;
}
