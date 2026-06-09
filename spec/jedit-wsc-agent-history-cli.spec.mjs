import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { ensureDistBuiltSync, REPO_ROOT } from './dist-helpers.mjs';

const SCRIPT_PATH = path.join(REPO_ROOT, 'scripts', 'jedit-wsc-history.mjs');
const UTF8_ENCODING = 'utf8';

test('WSC agent history CLI lists evidence and exports a historical basis as JSON', (t) => {
  ensureDistBuiltSync();
  const workspace = mkdtempSync(path.join(os.tmpdir(), 'jedit-wsc-history-'));
  t.after(() => rmSync(workspace, { recursive: true, force: true }));
  const basisId = writeEnvelope(workspace, settlementPayload());
  const list = runCli(['list', '--json', '--workspace', workspace]);

  assert.equal(list.status, 0, list.stderr);
  const listed = JSON.parse(list.stdout);
  assert.equal(listed.status, 'JEDIT_WSC_HISTORY_LISTED');
  assert.equal(listed.records[0].basisId, basisId);
  assert.equal(listed.records[0].readingId, 'reading:cli');

  const outputPath = path.join(workspace, 'exported.txt');
  const exported = runCli([
    'export',
    '--json',
    '--workspace',
    workspace,
    '--basis',
    basisId,
    '--output',
    outputPath,
  ]);

  assert.equal(exported.status, 0, exported.stderr);
  const body = JSON.parse(exported.stdout);
  assert.equal(body.status, 'JEDIT_WSC_CURRENT_HISTORY_EXPORTED');
  assert.equal(body.basisId, basisId);
  assert.equal(body.artifact.path, outputPath);
  assert.deepEqual(body.artifact.lines, ['cli history']);
  assert.equal(readFileSync(outputPath, UTF8_ENCODING), 'cli history');
});

test('WSC agent history CLI reports typed obstruction for non-applied export basis', (t) => {
  ensureDistBuiltSync();
  const workspace = mkdtempSync(path.join(os.tmpdir(), 'jedit-wsc-rejected-'));
  t.after(() => rmSync(workspace, { recursive: true, force: true }));
  const basisId = writeEnvelope(workspace, rejectionPayload());
  const result = runCli([
    'export',
    '--json',
    '--workspace',
    workspace,
    '--basis',
    basisId,
    '--output',
    path.join(workspace, 'rejected.txt'),
  ]);

  assert.notEqual(result.status, 0);
  const body = JSON.parse(result.stdout);
  assert.equal(body.status, 'JEDIT_WSC_CURRENT_HISTORY_EXPORT_OBSTRUCTED');
  assert.equal(body.obstruction.code, 'materialization_failed');
});

test('WSC agent history CLI reports typed obstruction for malformed export basis', (t) => {
  ensureDistBuiltSync();
  const workspace = mkdtempSync(path.join(os.tmpdir(), 'jedit-wsc-malformed-'));
  t.after(() => rmSync(workspace, { recursive: true, force: true }));
  const basisId = writeMalformedEnvelope(workspace);
  const result = runCli([
    'export',
    '--json',
    '--workspace',
    workspace,
    '--basis',
    basisId,
    '--output',
    path.join(workspace, 'malformed.txt'),
  ]);

  assert.notEqual(result.status, 0);
  const body = JSON.parse(result.stdout);
  assert.equal(body.status, 'JEDIT_WSC_CURRENT_HISTORY_EXPORT_OBSTRUCTED');
  assert.equal(body.obstruction.code, 'materialization_failed');
});

test('WSC agent history CLI does not expose trusted runtime controls', () => {
  const source = readFileSync(SCRIPT_PATH, UTF8_ENCODING);

  assert.doesNotMatch(source, /TrustedEchoRuntimeLifecyclePort/);
  assert.doesNotMatch(source, /runSchedulerOwnedTicks/);
  assert.doesNotMatch(source, /lifecycle control/i);
});

function runCli(args) {
  return spawnSync(process.execPath, [SCRIPT_PATH, ...args], {
    cwd: REPO_ROOT,
    encoding: UTF8_ENCODING,
  });
}

function writeEnvelope(workspace, payload) {
  const directory = path.join(workspace, '.jedit', 'echo-wsc', 'envelopes');
  const bytes = Buffer.from(JSON.stringify(payload), UTF8_ENCODING);
  const envelopeId = createHash('sha256').update(bytes).digest('hex');
  mkdirSync(directory, { recursive: true });
  writeFileSync(path.join(directory, `${envelopeId}.wsc-envelope`), bytes);
  return envelopeId;
}

function writeMalformedEnvelope(workspace) {
  const directory = path.join(workspace, '.jedit', 'echo-wsc', 'envelopes');
  const bytes = Buffer.from('not json', UTF8_ENCODING);
  const envelopeId = createHash('sha256').update(bytes).digest('hex');
  mkdirSync(directory, { recursive: true });
  writeFileSync(path.join(directory, `${envelopeId}.wsc-envelope`), bytes);
  return envelopeId;
}

function settlementPayload() {
  return {
    schemaVersion: 'jedit.workspace_text_edit_settlement.v1',
    filePath: '/repo/cli.txt',
    bufferId: 'buffer:cli',
    commandKind: 'replaceTextRange',
    submittedAtMs: 10,
    receiptId: 'receipt:cli',
    reading: {
      readingId: 'reading:cli',
      lines: ['cli history'],
      lineCount: 1,
      cursorLine: 0,
      viewportLineCount: 1,
      truncated: false,
    },
  };
}

function rejectionPayload() {
  return {
    schemaVersion: 'jedit.workspace_text_edit_rejection.v1',
    filePath: '/repo/cli.txt',
    bufferId: 'buffer:cli',
    commandKind: 'replaceTextRange',
    submittedAtMs: 11,
    receiptId: 'receipt:rejected',
    rejectionReason: 'stale causal basis',
  };
}
