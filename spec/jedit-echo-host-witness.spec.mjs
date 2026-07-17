import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {
  EchoTextHostCheckpointReasons,
  EchoTextHostOperationNames,
} from '../dist/ports/echo-text-contract-host.js';

const SCRIPT_PATH = path.resolve('scripts/jedit-echo-host-witness.mjs');
const WITNESS_TIMEOUT_MS = 30_000;
const MINIMUM_CHECKPOINT_WORLDLINE_TICK = 3;

test('Echo host witness proves generated mutation, checkpoint, and bounded reading corridors', () => {
  const result = runWitness();

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const report = JSON.parse(result.stdout);
  assert.equal(report.ok, true);
  assert.equal(report.corridor, 'graphql-wesley-installed-contract');
  assert.equal(report.operation, 'replaceRangeAsTick');
  assert.equal(report.checkpointOperation, EchoTextHostOperationNames.DeclareCheckpoint);
  assert.equal(report.checkpointReason, EchoTextHostCheckpointReasons.ManualSave);
  assert.equal(report.text, 'Echo remembers');
  assert.notEqual(report.initialHeadId, report.headId);
  assert.equal(report.checkpointBasisHeadId, report.headId);
  assert.equal(report.checkpointHeadId, report.headId);
  assert.equal(report.checkpointRootNodeId, report.appliedRootNodeId);
  assert.equal(report.checkpointBasisByteLength, report.appliedByteLength);
  assert.equal(report.checkpointByteLength, report.appliedByteLength);
  assert.equal(report.checkpointLineCount, report.appliedLineCount);
  assert.equal(report.checkpointBufferVersion, report.appliedBufferVersion);
  assert.match(report.createReceiptId, /^[0-9a-f]+$/);
  assert.match(report.replaceReceiptId, /^[0-9a-f]+$/);
  assert.match(report.checkpointId, /^[0-9a-f]+$/);
  assert.match(report.checkpointReceiptId, /^[0-9a-f]+$/);
  assert.equal(typeof report.checkpointTickId, 'string');
  assert.ok(report.checkpointTickId.length > 0);
  assert.match(report.readingId, /^[0-9a-f]+$/);
  assert.match(report.commitHash, /^[0-9a-f]+$/);
  assert.ok(report.resolvedWorldlineTick >= MINIMUM_CHECKPOINT_WORLDLINE_TICK);
  assert.ok(report.supportCount > 0);
});

test('Echo host witness fails closed when the native host is unavailable', () => {
  const result = runWitness({
    JEDIT_ECHO_HOST_BIN: path.resolve('missing-jedit-echo-host'),
  });

  assert.notEqual(result.status, 0);
  const report = JSON.parse(result.stdout);
  assert.equal(report.ok, false);
  assert.equal(report.operation, 'native-echo-text-witness');
  assert.match(report.message, /Echo host/i);
});

test('the CI release gate delegates to the real Echo host witness', () => {
  const packageDocument = JSON.parse(readFileSync('package.json', 'utf8'));

  assert.equal(packageDocument.scripts['release-gate:jedit-echo'], 'npm run witness:echo');
});

function runWitness(environment = {}) {
  return spawnSync(process.execPath, [SCRIPT_PATH, '--json'], {
    cwd: process.cwd(),
    encoding: 'utf8',
    env: {
      ...process.env,
      ...environment,
    },
    timeout: WITNESS_TIMEOUT_MS,
  });
}
