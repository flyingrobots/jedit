import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';

const REPO_ROOT = process.cwd();
const REPLAY_MODULE_PATH = path.join(REPO_ROOT, 'dist', 'app', 'jedit-local-replay-proof.js');

let replayPromise;

test('local replay proof matches stable evidence identity', async () => {
  const replay = await loadReplay();
  const proof = await replay.proveLocalJeditReplay({
    witness: stableWitness(),
  }, witnessRequest());

  assert.equal(proof.status, replay.JEDIT_LOCAL_REPLAY_MATCH);
  assert.equal(proof.first.receiptId, 'receipt-1');
  assert.equal(proof.second.readingId, 'reading-1');
  assert.equal(proof.wallClockCadenceSemantic, false);
});

test('local replay proof reports typed mismatch without using wall-clock cadence', async () => {
  const replay = await loadReplay();
  const proof = await replay.proveLocalJeditReplay({
    witness: mismatchingWitness(),
  }, witnessRequest());

  assert.equal(proof.status, replay.JEDIT_LOCAL_REPLAY_MISMATCH);
  assert.equal(proof.mismatchField, 'readingId');
  assert.equal(proof.wallClockCadenceSemantic, false);
});

function witnessRequest() {
  return {
    bufferKey: 'replay.md',
    insertText: 'hello',
    cycleLimit: 5,
  };
}

function stableWitness() {
  return {
    async dryRun() {
      return dryRunSummary();
    },
    async run() {
      return runSummary('reading-1');
    },
  };
}

function mismatchingWitness() {
  let callCount = 0;
  return {
    async dryRun() {
      return dryRunSummary();
    },
    async run() {
      callCount += 1;
      return runSummary(callCount === 1 ? 'reading-1' : 'reading-2');
    },
  };
}

function dryRunSummary() {
  return {
    ok: true,
    schemaVersion: 1,
    transport: 'installed-jedit-contract',
    dryRun: true,
    install: installSummary(),
    plan: {
      bufferKey: 'replay.md',
      cycleLimit: 5,
      submitIntent: true,
      trustedHostDrainsRuntime: true,
      appCanTick: false,
    },
    replay: replayPosture(),
  };
}

function runSummary(readingId) {
  return {
    ok: true,
    schemaVersion: 1,
    transport: 'installed-jedit-contract',
    dryRun: false,
    install: installSummary(),
    report: {
      bufferId: 'buffer-1',
      bufferKey: 'replay.md',
      outcome: {
        status: 'APPLIED',
        intent: {
          kind: 'jedit-intent-handle',
          operationName: 'replaceRangeAsTick',
          submissionId: 'submission-1',
        },
        receipt: {
          kind: 'jedit-receipt-handle',
          receiptId: 'receipt-1',
        },
      },
      outcomeTrail: [],
      retainedEvidence: {
        refs: [],
      },
      restartPosture: {
        status: 'PARTIAL',
        stateOwner: 'PROCESS_LOCAL_HANDLER_STATE',
        echoHostedStatePosture: 'ECHO_PACKAGE_AND_EVIDENCE_ONLY',
        acceptedSubmissionRecovery: 'UNAVAILABLE',
        halfAcceptedSubmissionClaimed: false,
        obstruction: {
          code: 'DURABLE_ACCEPTED_SUBMISSION_RECOVERY_UNAVAILABLE',
          reason: 'test',
        },
      },
      receiptId: 'receipt-1',
      readingId,
      text: 'hello',
      lines: [],
      truncated: false,
    },
    reading: {
      readingId,
      lineCount: 1,
      truncated: false,
    },
    replay: replayPosture(),
  };
}

function installSummary() {
  return {
    packageId: 'jedit.hot-text-runtime',
    version: '0.1.0-release-gate',
    schemaId: 'contracts/jedit/hot-text-runtime.graphql',
    artifactId: 'src/generated/jedit/hot-text-runtime.wesley.generated.ts',
    codecId: 'jedit-hot-text-runtime-json-v1',
  };
}

function replayPosture() {
  return {
    status: 'UNAVAILABLE',
    reason: 'not part of this test',
  };
}

async function loadReplay() {
  if (replayPromise) {
    return replayPromise;
  }

  replayPromise = (async () => {
    const build = spawnSync('npm', ['run', '--silent', 'build'], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
    });

    assert.equal(build.status, 0, build.stderr || build.stdout);
    return import(pathToFileURL(REPLAY_MODULE_PATH).href);
  })();

  return replayPromise;
}
