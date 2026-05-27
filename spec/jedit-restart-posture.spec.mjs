import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';

const REPO_ROOT = process.cwd();
const RESTART_MODULE_PATH = path.join(REPO_ROOT, 'dist', 'app', 'jedit-restart-posture.js');

let restartPromise;

test('restart posture reports process-local handler state without durable claims', async () => {
  const restart = await loadRestartPosture();
  const posture = restart.currentJeditRestartPosture();

  assert.equal(posture.status, 'PARTIAL');
  assert.equal(posture.stateOwner, 'PROCESS_LOCAL_HANDLER_STATE');
  assert.equal(posture.echoHostedStatePosture, 'ECHO_PACKAGE_AND_EVIDENCE_ONLY');
  assert.equal(posture.acceptedSubmissionRecovery, 'UNAVAILABLE');
  assert.equal(posture.halfAcceptedSubmissionClaimed, false);
});

test('missing durable accepted-submission recovery is a typed obstruction', async () => {
  const restart = await loadRestartPosture();
  const posture = restart.currentJeditRestartPosture();

  assert.deepEqual(posture.obstruction, {
    code: 'DURABLE_ACCEPTED_SUBMISSION_RECOVERY_UNAVAILABLE',
    reason: 'jedit contract handler state is process-local in this release-gate slice',
  });
});

async function loadRestartPosture() {
  if (restartPromise) {
    return restartPromise;
  }

  restartPromise = (async () => {    return import(pathToFileURL(RESTART_MODULE_PATH).href);
  })();

  return restartPromise;
}
