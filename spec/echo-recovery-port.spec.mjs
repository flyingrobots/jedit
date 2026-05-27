import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';

const REPO_ROOT = process.cwd();
const RECOVERY_MODULE_PATH = path.join(REPO_ROOT, 'dist', 'app', 'echo-recovery.js');

let modulesPromise;

test('fake Echo recovery port returns deterministic generic posture payload', async () => {
  const modules = await loadModules();
  const report = modules.recovery.createEchoRecoveryGateFixture(
    'submission:fixture',
    'envelope:fixture',
  );
  const port = modules.recovery.createFakeEchoRecoveryPort([report]);

  const result = await port.readExternalAppRecoveryGate({
    submissionId: 'submission:fixture',
    canonicalEnvelopeDigest: 'envelope:fixture',
  });

  assert.equal(result.status, 'ECHO_RECOVERY_PORT_AVAILABLE');
  assert.equal(result.report.submission.submission.submissionId, 'submission:fixture');
  assert.equal(result.report.submission.lifecycle.posture, 'not_found');
  assert.equal(result.report.causalChain.status, 'not_requested');
});

test('Echo recovery request validation names missing submission id', async () => {
  const modules = await loadModules();
  const result = modules.recovery.validateEchoRecoveryGateRequest({
    submissionId: '',
    canonicalEnvelopeDigest: 'envelope:fixture',
  });

  assert.equal(result.status, 'ECHO_RECOVERY_PORT_INVALID_REQUEST');
  assert.equal(result.diagnostic.field, 'submissionId');
});

test('Echo recovery request validation rejects whitespace-only envelope digests', async () => {
  const modules = await loadModules();
  const result = modules.recovery.validateEchoRecoveryGateRequest({
    submissionId: 'submission:fixture',
    canonicalEnvelopeDigest: '   ',
  });

  assert.equal(result.status, 'ECHO_RECOVERY_PORT_INVALID_REQUEST');
  assert.equal(result.diagnostic.field, 'canonicalEnvelopeDigest');
});

test('fake Echo recovery port reports unavailable for missing fixture', async () => {
  const modules = await loadModules();
  const port = modules.recovery.createFakeEchoRecoveryPort([]);

  const result = await port.readExternalAppRecoveryGate({
    submissionId: 'submission:missing',
    canonicalEnvelopeDigest: 'envelope:missing',
  });

  assert.equal(result.status, 'ECHO_RECOVERY_PORT_UNAVAILABLE');
  assert.equal(result.diagnostic.code, 'echo_recovery_fixture_not_found');
});

async function loadModules() {
  if (modulesPromise) {
    return modulesPromise;
  }

  modulesPromise = (async () => {
    const recovery = await import(pathToFileURL(RECOVERY_MODULE_PATH).href);

    return {
      recovery,
    };
  })();

  return modulesPromise;
}
