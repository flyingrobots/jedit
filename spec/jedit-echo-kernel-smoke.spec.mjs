import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';

const SCRIPT_PATH = path.resolve('scripts/jedit-echo-kernel-smoke.mjs');

test('Echo kernel smoke initializes only the configured WASM boundary', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'jedit-echo-kernel-smoke-'));
  const modulePath = path.join(directory, 'test-only-echo-kernel.mjs');
  writeFileSync(modulePath, testKernelModule());

  try {
    const result = spawnSync(process.execPath, [
      SCRIPT_PATH,
      '--json',
      '--module',
      pathToFileURL(modulePath).href,
    ], {
      cwd: process.cwd(),
      encoding: 'utf8',
    });

    assert.equal(result.status, 0, result.stderr || result.stdout);
    const report = JSON.parse(result.stdout);
    assert.equal(report.ok, true);
    assert.equal(report.kernel.codecId, 'test-only-codec');
    assert.equal(report.schedulerStatusByteLength, 3);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('Echo kernel smoke fails closed when the configured module is absent', () => {
  const missing = pathToFileURL(path.resolve('missing-echo-kernel.mjs')).href;
  const result = spawnSync(process.execPath, [
    SCRIPT_PATH,
    '--json',
    '--module',
    missing,
  ], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });

  assert.notEqual(result.status, 0);
  const report = JSON.parse(result.stdout);
  assert.equal(report.ok, false);
  assert.equal(report.operation, 'module-load');
  assert.match(report.message, /could not be loaded/);
});

function testKernelModule() {
  return [
    'export default async function bootstrap() {}',
    'export function init() { return new Uint8Array(); }',
    'export function dispatch_intent() { return new Uint8Array(); }',
    'export function observe() { return new Uint8Array(); }',
    'export function scheduler_status() { return Uint8Array.from([1, 2, 3]); }',
    'export function dispatch_control_intent_trusted() { return new Uint8Array(); }',
    "export function get_codec_id() { return 'test-only-codec'; }",
    "export function get_registry_version() { return 'test-only-registry'; }",
    "export function get_schema_sha256_hex() { return 'test-only-schema'; }",
    '',
  ].join('\n');
}
