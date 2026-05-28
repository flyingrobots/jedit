import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';

const REPO_ROOT = process.cwd();
const INGRESS_MODULE_PATH = path.join(REPO_ROOT, 'dist', 'app', 'jedit-ticketed-runtime-ingress.js');
const SUBMISSION_ID = 'jedit-submission:abc';
const TICKET_ID = 'jedit-admission-ticket:def';

let ingressModulePromise;

test('ticketed runtime ingress keeps submission and ticket identity distinct', async () => {
  const ingress = await loadIngressModule();
  const posture = ingress.createJeditTicketedRuntimeIngress({
    submissionId: SUBMISSION_ID,
    admissionTicketId: TICKET_ID,
  });

  assert.equal(posture.status, ingress.JEDIT_TICKETED_RUNTIME_INGRESS_AVAILABLE);
  assert.equal(posture.submissionId, SUBMISSION_ID);
  assert.equal(posture.ticket.ticketId, TICKET_ID);
  assert.notEqual(posture.submissionId, posture.ticket.ticketId);
});

test('missing ticketed runtime ingress remains a typed posture', async () => {
  const ingress = await loadIngressModule();
  const posture = ingress.missingJeditTicketedRuntimeIngress(SUBMISSION_ID);

  assert.equal(posture.status, ingress.JEDIT_TICKETED_RUNTIME_INGRESS_MISSING);
  assert.equal(posture.submissionId, SUBMISSION_ID);
  assert.equal(posture.obstruction.code, ingress.JEDIT_TICKETED_RUNTIME_INGRESS_MISSING_CODE);
});

async function loadIngressModule() {
  if (ingressModulePromise) {
    return ingressModulePromise;
  }

  ingressModulePromise = (async () => {
    const build = spawnSync('npm', ['run', '--silent', 'build'], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
    });

    assert.equal(build.status, 0, build.stderr || build.stdout);

    return import(pathToFileURL(INGRESS_MODULE_PATH).href);
  })();

  return ingressModulePromise;
}
