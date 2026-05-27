import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';

const REPO_ROOT = process.cwd();
const POSTURE_MODULE_PATH = path.join(REPO_ROOT, 'dist', 'app', 'echo-recovery-posture.js');
const RECOVERY_MODULE_PATH = path.join(REPO_ROOT, 'dist', 'app', 'echo-recovery.js');

let modulesPromise;

test('Echo recovery posture maps not-found submissions to unknown editor status', async () => {
  const modules = await loadModules();
  const report = modules.recovery.createEchoRecoveryGateFixture(
    'submission:unknown',
    'envelope:unknown',
  );

  const posture = modules.posture.mapEchoRecoveryToRecoveredEditPosture(report);

  assert.equal(posture.status, 'edit_unknown');
  assert.equal(posture.reason, 'echo_submission_not_found');
  assert.equal(posture.echoLifecyclePosture, 'not_found');
});

test('Echo recovery posture maps accepted pending submissions to pending editor status', async () => {
  const modules = await loadModules();
  const report = fixtureWithSubmission({
    lifecycle: 'accepted_pending',
    decision: 'none',
    health: 'complete',
  });

  const posture = modules.posture.mapEchoRecoveryToRecoveredEditPosture(report);

  assert.equal(posture.status, 'edit_pending');
  assert.equal(posture.reason, 'echo_accepted_pending');
});

test('Echo recovery posture maps accepted deciding submissions to processing editor status', async () => {
  const modules = await loadModules();
  const report = fixtureWithSubmission({
    lifecycle: 'accepted_deciding',
    decision: 'none',
    health: 'complete',
  });

  const posture = modules.posture.mapEchoRecoveryToRecoveredEditPosture(report);

  assert.equal(posture.status, 'edit_processing');
  assert.equal(posture.reason, 'echo_accepted_deciding');
});

test('Echo recovery posture maps decided outcomes into editor-owned status labels', async () => {
  const modules = await loadModules();

  assert.equal(statusForDecision(modules, 'applied'), 'edit_applied');
  assert.equal(statusForDecision(modules, 'rejected'), 'edit_rejected');
  assert.equal(statusForDecision(modules, 'obstructed'), 'edit_blocked');
  assert.equal(statusForDecision(modules, 'none'), 'edit_recovery_incomplete');
});

test('Echo recovery posture maps unhealthy evidence before lifecycle interpretation', async () => {
  const modules = await loadModules();

  const incomplete = fixtureWithSubmission({
    lifecycle: 'decided',
    decision: 'applied',
    health: 'missing_retention',
  });
  const corrupt = fixtureWithSubmission({
    lifecycle: 'decided',
    decision: 'applied',
    health: 'corrupt_or_untrusted',
  });

  assert.equal(
    modules.posture.mapEchoRecoveryToRecoveredEditPosture(incomplete).status,
    'edit_recovery_incomplete',
  );
  assert.equal(
    modules.posture.mapEchoRecoveryToRecoveredEditPosture(corrupt).status,
    'echo_recovery_error',
  );
});

test('Echo recovery posture keeps unsupported Echo labels out of editor truth', async () => {
  const modules = await loadModules();
  const report = fixtureWithSubmission({
    lifecycle: 'unexpected_lifecycle',
    decision: 'none',
    health: 'complete',
  });

  const posture = modules.posture.mapEchoRecoveryToRecoveredEditPosture(report);

  assert.equal(posture.status, 'unsupported_echo_posture');
  assert.equal(posture.reason, 'unsupported_echo_posture');
});

function statusForDecision(modules, decision) {
  const report = fixtureWithSubmission({
    lifecycle: 'decided',
    decision,
    health: 'complete',
  });
  return modules.posture.mapEchoRecoveryToRecoveredEditPosture(report).status;
}

function fixtureWithSubmission({ lifecycle, decision, health }) {
  const report = cachedRecovery().createEchoRecoveryGateFixture(
    `submission:${lifecycle}:${decision}:${health}`,
    `envelope:${lifecycle}:${decision}:${health}`,
  );
  report.submission.lifecycle.posture = lifecycle;
  report.submission.decision.result = decision;
  report.submission.evidenceHealth.status = health;
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
    const [posture, recovery] = await Promise.all([
      import(pathToFileURL(POSTURE_MODULE_PATH).href),
      import(pathToFileURL(RECOVERY_MODULE_PATH).href),
    ]);

    cachedRecoveryModule = recovery;

    return {
      posture,
      recovery,
    };
  })();

  return modulesPromise;
}
