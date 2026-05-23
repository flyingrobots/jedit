import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

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
  });

  assert.notEqual(result.status, 0);
  const summary = JSON.parse(result.stdout);
  assert.equal(summary.ok, false);
  assert.match(summary.message, /ECHO_WARP_WASM_DIR/);
});
