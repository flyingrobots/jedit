import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { runEchoWitness } from '../scripts/ports/echo-witness-runner.mjs';

const REPO_ROOT = process.cwd();
const CLI_PATH = path.join(REPO_ROOT, 'scripts', 'jedit-echo-witness.mjs');

test('jedit Echo witness CLI emits a dry-run JSON plan for agents', async () => {
  const tempDir = await mkdtemp(path.join(tmpdir(), 'jedit-echo-witness-'));
  try {
    const echoDir = path.join(tempDir, 'echo', 'crates', 'warp-wasm');
    mkdirSync(echoDir, { recursive: true });
    mkdirSync(path.join(tempDir, 'echo', 'scripts'), { recursive: true });
    writeFileSync(path.join(tempDir, 'echo', 'scripts', 'build-warp-wasm-package.sh'), '', {
      mode: 0o755,
    });

    const result = spawnSync(process.execPath, [
      CLI_PATH,
      '--dry-run',
      '--json',
      '--echo-warp-wasm-dir',
      echoDir,
    ], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
    });

    assert.equal(result.status, 0, result.stderr);
    const summary = JSON.parse(result.stdout);
    assert.equal(summary.ok, true);
    assert.equal(summary.dryRun, true);
    assert.equal(summary.echoWarpWasmDir, echoDir);
    assert.match(summary.witnessReportPath, /\.jedit-cache\/echo-witness\/stack-witness-report\.json$/);
    assert.equal(summary.steps.length, 3);
    assert.deepEqual(summary.steps.map((step) => step.name), [
      'build-echo-wasm',
      'build-jedit',
      'run-real-echo-witness',
    ]);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test('jedit Echo witness CLI reports missing Echo path as JSON failure', () => {
  const result = spawnSync(process.execPath, [
    CLI_PATH,
    '--dry-run',
    '--json',
  ], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    env: {
      ...process.env,
      ECHO_WARP_WASM_DIR: '',
    },
  });

  assert.notEqual(result.status, 0);
  const summary = JSON.parse(result.stdout);
  assert.equal(summary.ok, false);
  assert.match(summary.message, /ECHO_WARP_WASM_DIR/);
});

test('jedit Echo witness CLI rejects valued flags without sentinel paths', () => {
  const result = spawnSync(process.execPath, [
    CLI_PATH,
    '--dry-run',
    '--json',
    '--echo-warp-wasm-dir',
  ], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });

  assert.notEqual(result.status, 0);
  const summary = JSON.parse(result.stdout);
  assert.equal(summary.ok, false);
  assert.equal(summary.message, 'missing value for --echo-warp-wasm-dir');
});

test('jedit Echo witness runner reports witness report read failures', () => {
  const result = runEchoWitness({
    dryRun: false,
    json: true,
  }, createWitnessReportFailureAdapter());

  assert.equal(result.status, 1);
  assert.equal(result.summary.ok, false);
  assert.equal(result.summary.message, 'failed to read witness report');
  assert.equal(result.summary.witnessReport, null);
  assert.match(result.summary.witnessReportError, /invalid report JSON/);
});

function createWitnessReportFailureAdapter() {
  return {
    createPlan() {
      return {
        echoWarpWasmDir: '/tmp/echo/crates/warp-wasm',
        echoWasmModule: '/tmp/echo/crates/warp-wasm/pkg/rmg_wasm.js',
        witnessReportPath: '/tmp/jedit-witness.json',
        steps: [],
      };
    },
    nowMs() {
      return 0;
    },
    readWitnessReport() {
      throw new Error('invalid report JSON');
    },
    runStep() {
      return {
        name: 'unused',
        command: 'unused',
        status: 0,
        durationMs: 0,
      };
    },
  };
}
