import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';

const REPO_ROOT = process.cwd();
const AMNESIA_MODULE_PATH = path.join(REPO_ROOT, 'dist', 'app', 'jedit-recovery-amnesia.js');
const SCENARIO_MODULE_PATH = path.join(REPO_ROOT, 'dist', 'app', 'jedit-recovery-gate-scenario.js');
const RECOVERY_MODULE_PATH = path.join(REPO_ROOT, 'dist', 'app', 'echo-recovery.js');
const TRIPWIRE_MODULE_PATH = path.join(REPO_ROOT, 'dist', 'app', 'jedit-local-fallback-tripwire.js');
const IDENTITY_MODULE_PATH = path.join(REPO_ROOT, 'dist', 'app', 'jedit-edit-submission-identity.js');
const HASH_MODULE_PATH = path.join(REPO_ROOT, 'dist', 'adapters', 'hash.js');

let modulesPromise;

test('recovery amnesia token carries retry identity without local text fields', async () => {
  const modules = await loadModules();
  const identity = editIdentity(modules);

  const token = modules.amnesia.createJeditRecoveryAmnesiaToken({ identity });

  assert.equal(token.schemaVersion, 'jedit.recovery_amnesia_token.v1');
  assert.equal(token.submissionId, identity.submissionId);
  assert.equal(token.canonicalEnvelopeDigest, identity.canonicalEnvelopeDigest);
  assert.equal('text' in token, false);
  assert.equal('buffer' in token, false);
  assert.equal('path' in token, false);
});

test('jedit recovers after local amnesia by using only the Echo recovery token', async () => {
  const modules = await loadModules();
  const identity = editIdentity(modules);
  const token = modules.amnesia.createJeditRecoveryAmnesiaToken({ identity });
  const rehydrated = modules.amnesia.rehydrateJeditIdentityFromAmnesiaToken(token);
  const echoReport = appliedEchoReport(modules, rehydrated);
  const recovery = modules.recovery.createFakeEchoRecoveryPort([echoReport]);
  const tripwire = modules.tripwire.createJeditLocalFallbackTripwire({
    mode: 'enforced',
  });

  const result = await modules.scenario.runJeditRecoveryGateScenario({
    recovery,
    identity: rehydrated,
    reading: readingRequest(),
    tripwire,
  });

  assert.equal(result.status, 'JEDIT_RECOVERY_GATE_SCENARIO_READY');
  assert.equal(result.report.recoveredEdit.status, 'edit_applied');
  assert.equal(result.report.echo.sourceOfTruth, 'echo');
  assert.equal(tripwire.snapshot().status, 'clear');
});

test('recovery amnesia rejects unsupported token schema versions', async () => {
  const modules = await loadModules();
  const token = modules.amnesia.createJeditRecoveryAmnesiaToken({
    identity: editIdentity(modules),
  });

  assert.throws(
    () => modules.amnesia.rehydrateJeditIdentityFromAmnesiaToken({
      ...token,
      schemaVersion: 'jedit.recovery_amnesia_token.v0',
    }),
    /Unsupported jedit recovery amnesia token schema version/u,
  );
});

function appliedEchoReport(modules, identity) {
  const report = modules.recovery.createEchoRecoveryGateFixture(
    identity.submissionId,
    identity.canonicalEnvelopeDigest,
  );
  report.submission.lifecycle.posture = 'decided';
  report.submission.decision.result = 'applied';
  report.causalChain.status = 'evaluated';
  report.causalChain.posture = 'complete';
  report.causalChain.evidenceHealth = 'complete';
  report.causalChain.basisDigest = 'basis:amnesia';
  report.causalChain.readingBasisDigest = 'basis:amnesia';
  report.causalChain.semanticCoordinateDigest = 'coordinate:amnesia';
  report.causalChain.readingId = 'reading:amnesia';
  report.causalChain.readingSource = 'retained';
  report.causalChain.readingAuthority = 'echo_committed_reading';
  return report;
}

function editIdentity(modules) {
  return modules.identity.createJeditEditSubmissionIdentity({
    appInstanceId: 'jedit-app:test',
    sessionId: 'jedit-session:test',
    clientOperationId: 'client-op:amnesia',
    contractPackageId: 'jedit.contract:text',
    contractOperationName: 'replaceRange',
    causalBasisDigest: 'basis:amnesia',
    canonicalEnvelopeDigest: 'envelope:amnesia',
  }, modules.hash.createHashPort());
}

function readingRequest() {
  return {
    basisDigest: 'basis:amnesia',
    readingBasisDigest: 'basis:amnesia',
    semanticCoordinateDigest: 'coordinate:amnesia',
    readingId: 'reading:amnesia',
  };
}

async function loadModules() {
  if (modulesPromise) {
    return modulesPromise;
  }

  modulesPromise = (async () => {
    const [amnesia, scenario, recovery, tripwire, identity, hash] = await Promise.all([
      import(pathToFileURL(AMNESIA_MODULE_PATH).href),
      import(pathToFileURL(SCENARIO_MODULE_PATH).href),
      import(pathToFileURL(RECOVERY_MODULE_PATH).href),
      import(pathToFileURL(TRIPWIRE_MODULE_PATH).href),
      import(pathToFileURL(IDENTITY_MODULE_PATH).href),
      import(pathToFileURL(HASH_MODULE_PATH).href),
    ]);

    return {
      amnesia,
      scenario,
      recovery,
      tripwire,
      identity,
      hash,
    };
  })();

  return modulesPromise;
}
