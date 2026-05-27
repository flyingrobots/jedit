import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';

const REPO_ROOT = process.cwd();
const ADAPTER_MODULE_PATH = path.join(REPO_ROOT, 'dist', 'adapters', 'echo-cli-recovery-adapter.js');
const COMMAND_MODULE_PATH = path.join(REPO_ROOT, 'dist', 'ports', 'echo-recovery-command.js');

let modulesPromise;

test('Echo CLI recovery adapter parses generic gate JSON behind the port', async () => {
  const modules = await loadModules();
  const calls = [];
  const adapter = modules.adapter.createEchoCliRecoveryAdapter({
    command: commandPort(calls, 0, JSON.stringify(gateJson())),
    executable: 'echo-cli',
    root: '.echo-wal',
  });

  const result = await adapter.readExternalAppRecoveryGate({
    submissionId: 'submission:applied',
    canonicalEnvelopeDigest: 'envelope:applied',
    reading: {
      basisDigest: 'basis:expected',
      readingBasisDigest: 'basis:expected',
      semanticCoordinateDigest: 'coordinate:reading',
      readingId: 'reading:applied',
    },
  });

  assert.equal(result.status, 'ECHO_RECOVERY_PORT_AVAILABLE');
  assert.equal(result.report.schemaVersion, 'echo.recovery.external_app_gate.v1');
  assert.equal(result.report.submission.lifecycle.posture, 'decided');
  assert.equal(result.report.submission.decision.result, 'applied');
  assert.equal(result.report.causalChain.status, 'evaluated');
  assert.equal(result.report.commitEvidence.evidence[0].source, 'echo_wal');
  assert.deepEqual(calls[0].args, [
    '--format',
    'json',
    'recovery',
    'gate',
    '.echo-wal',
    '--submission-id',
    'submission:applied',
    '--canonical-envelope-digest',
    'envelope:applied',
    '--basis-digest',
    'basis:expected',
    '--reading-basis-digest',
    'basis:expected',
    '--semantic-coordinate-digest',
    'coordinate:reading',
    '--reading-id',
    'reading:applied',
  ]);
});

test('Echo CLI recovery adapter reports command failure as unavailable', async () => {
  const modules = await loadModules();
  const adapter = modules.adapter.createEchoCliRecoveryAdapter({
    command: commandPort([], 2, '', 'boom'),
    executable: 'echo-cli',
    root: '.echo-wal',
  });

  const result = await adapter.readExternalAppRecoveryGate({
    submissionId: 'submission:failed',
    canonicalEnvelopeDigest: 'envelope:failed',
  });

  assert.equal(result.status, 'ECHO_RECOVERY_PORT_UNAVAILABLE');
  assert.equal(result.diagnostic.code, 'echo_recovery_command_failed');
});

test('Echo CLI recovery adapter reports malformed JSON as unavailable', async () => {
  const modules = await loadModules();
  const adapter = modules.adapter.createEchoCliRecoveryAdapter({
    command: commandPort([], 0, '{'),
    executable: 'echo-cli',
    root: '.echo-wal',
  });

  const result = await adapter.readExternalAppRecoveryGate({
    submissionId: 'submission:bad-json',
    canonicalEnvelopeDigest: 'envelope:bad-json',
  });

  assert.equal(result.status, 'ECHO_RECOVERY_PORT_UNAVAILABLE');
  assert.equal(result.diagnostic.code, 'echo_recovery_decode_failed');
});

function commandPort(calls, exitCode, stdout, stderr = '') {
  return {
    async run(request) {
      calls.push(request);
      return {
        status: 'ECHO_RECOVERY_COMMAND_EXITED',
        exitCode,
        stdout,
        stderr,
      };
    },
  };
}

function gateJson() {
  return {
    schema_version: 'echo.recovery.external_app_gate.v1',
    producer: 'echo-cli',
    producer_version: '0.1.1',
    compatibility: compatibility('echo.recovery.external_app_gate'),
    tail_posture: 'Clean',
    certificate: {
      committed_transactions_replayed: 2,
      obstruction_count: 0,
      submission_posture_counts: postureCounts(),
    },
    submission: submissionJson(),
    causal_chain: causalChainJson(),
    commit_evidence: {
      schema_version: 'echo.causal_commit_evidence.v1',
      producer: 'echo-cli',
      producer_version: '0.1.1',
      compatibility: compatibility('echo.causal_commit_evidence'),
      evidence: [commitEvidenceJson()],
    },
  };
}

function compatibility(contract) {
  return {
    contract,
    minimum_consumer_schema_version: `${contract}.v1`,
  };
}

function postureCounts() {
  return {
    total: 1,
    accepted_pending: 0,
    decided_applied: 1,
    decided_rejected: 0,
    obstructed: 0,
    recovery_faulted: 0,
  };
}

function submissionJson() {
  return {
    schema_version: 'echo.recovery.submission_posture.v1',
    producer: 'echo-cli',
    root: '.echo-wal',
    submission: {
      submission_id: 'submission:applied',
      canonical_envelope_digest: 'envelope:applied',
    },
    intake: {
      disposition: 'duplicate_same_submission',
      idempotency_law: 'idempotent_retry',
      accepted_evidence: 'present',
    },
    lifecycle: {
      posture: 'decided',
    },
    decision: {
      result: 'applied',
      receipt_digest: 'receipt:digest',
      ticket_digest: 'ticket:digest',
    },
    evidence_health: {
      status: 'complete',
    },
  };
}

function causalChainJson() {
  return {
    status: 'evaluated',
    posture: 'complete',
    evidence_health: 'complete',
    ticket_digest: 'ticket:digest',
    receipt_digest: 'receipt:digest',
    basis_digest: 'basis:expected',
    reading_basis_digest: 'basis:expected',
    semantic_coordinate_digest: 'coordinate:reading',
    reading_id: 'reading:applied',
    reading_source: 'retained',
    reading_authority: 'echo_committed_reading',
  };
}

function commitEvidenceJson() {
  return {
    evidence_id: 'evidence:id',
    posture: 'present',
    source: 'echo_wal',
    durability_mode: 'buffered',
    writer_epoch: 'epoch:id',
    lsn: 1,
    transaction_id: 'transaction:id',
    commit_digest: 'commit:digest',
    checkpoint_digest: null,
    recovery_certificate_digest: null,
    obstruction_digest: null,
    reason: null,
  };
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

    const [adapter, command] = await Promise.all([
      import(pathToFileURL(ADAPTER_MODULE_PATH).href),
      import(pathToFileURL(COMMAND_MODULE_PATH).href),
    ]);

    return {
      adapter,
      command,
    };
  })();

  return modulesPromise;
}
