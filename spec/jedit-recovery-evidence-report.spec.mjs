import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';

const REPO_ROOT = process.cwd();
const REPORT_MODULE_PATH = path.join(REPO_ROOT, 'dist', 'app', 'jedit-recovery-evidence-report.js');
const POSTURE_MODULE_PATH = path.join(REPO_ROOT, 'dist', 'app', 'echo-recovery-posture.js');
const RECOVERY_MODULE_PATH = path.join(REPO_ROOT, 'dist', 'app', 'echo-recovery.js');
const IDENTITY_MODULE_PATH = path.join(REPO_ROOT, 'dist', 'app', 'jedit-edit-submission-identity.js');
const HASH_MODULE_PATH = path.join(REPO_ROOT, 'dist', 'adapters', 'hash.js');

let modulesPromise;

test('jedit recovery evidence report earns Echo source-of-truth from complete Echo evidence', async () => {
  const modules = await loadModules();
  const echoReport = modules.recovery.createEchoRecoveryGateFixture(
    'submission:report',
    'envelope:report',
  );
  const recoveredEdit = modules.posture.mapEchoRecoveryToRecoveredEditPosture(echoReport);
  const echo = modules.report.extractJeditEchoRecoveryEvidenceFields(
    echoReport,
    recoveredEdit,
    'not_detected',
  );

  const report = modules.report.createJeditRecoveryEvidenceReport({
    identity: editIdentity(modules),
    recoveredEdit,
    echo,
    legacyFallbackStatus: 'not_detected',
  });

  assert.equal(report.schemaVersion, 'jedit.echo_recovery_evidence_report.v1');
  assert.equal(report.producer, 'jedit');
  assert.equal(report.echo.sourceOfTruth, 'echo');
  assert.equal(report.echo.lifecyclePosture, 'not_found');
  assert.equal(report.echo.commitEvidenceCount, 0);
});

test('jedit recovery evidence report refuses Echo source-of-truth when fallback is detected', async () => {
  const modules = await loadModules();
  const echoReport = modules.recovery.createEchoRecoveryGateFixture(
    'submission:fallback',
    'envelope:fallback',
  );
  const recoveredEdit = modules.posture.mapEchoRecoveryToRecoveredEditPosture(echoReport);
  const echo = modules.report.extractJeditEchoRecoveryEvidenceFields(
    echoReport,
    recoveredEdit,
    'detected',
  );

  assert.equal(echo.sourceOfTruth, 'local_fallback_detected');
});

test('jedit recovery evidence report marks incomplete Echo evidence without overclaiming', async () => {
  const modules = await loadModules();
  const echoReport = modules.recovery.createEchoRecoveryGateFixture(
    'submission:incomplete',
    'envelope:incomplete',
  );
  echoReport.submission.evidenceHealth.status = 'missing_retention';
  const recoveredEdit = modules.posture.mapEchoRecoveryToRecoveredEditPosture(echoReport);
  const echo = modules.report.extractJeditEchoRecoveryEvidenceFields(
    echoReport,
    recoveredEdit,
    'not_detected',
  );

  assert.equal(echo.sourceOfTruth, 'incomplete');
  assert.equal(echo.evidenceHealth, 'missing_retention');
});

function editIdentity(modules) {
  return modules.identity.createJeditEditSubmissionIdentity({
    appInstanceId: 'jedit-app:test',
    sessionId: 'jedit-session:test',
    clientOperationId: 'client-op:report',
    contractPackageId: 'jedit.contract:text',
    contractOperationName: 'replaceRange',
    causalBasisDigest: 'basis:digest:test',
    canonicalEnvelopeDigest: 'envelope:report',
  }, modules.hash.createHashPort());
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

    const [report, posture, recovery, identity, hash] = await Promise.all([
      import(pathToFileURL(REPORT_MODULE_PATH).href),
      import(pathToFileURL(POSTURE_MODULE_PATH).href),
      import(pathToFileURL(RECOVERY_MODULE_PATH).href),
      import(pathToFileURL(IDENTITY_MODULE_PATH).href),
      import(pathToFileURL(HASH_MODULE_PATH).href),
    ]);

    return {
      report,
      posture,
      recovery,
      identity,
      hash,
    };
  })();

  return modulesPromise;
}
