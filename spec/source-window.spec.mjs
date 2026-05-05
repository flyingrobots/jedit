import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';

const REPO_ROOT = process.cwd();
const MODULE_PATH = path.join(REPO_ROOT, 'dist', 'ui', 'source-window.js');
const LEGACY_EAGER_LOAD_CAP_BYTES = 24 * 1024;
const UTF8_ENCODER = new TextEncoder();

async function loadSourceWindowModule() {
  const build = spawnSync(process.execPath, ['node_modules/typescript/bin/tsc', '-p', 'tsconfig.json'], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });

  assert.equal(build.status, 0, build.stderr || build.stdout);

  return import(pathToFileURL(MODULE_PATH).href);
}

test('source window reading adapts local editor lines into a bounded render input', async () => {
  const sourceWindow = await loadSourceWindowModule();
  const lines = Array.from(
    { length: 1200 },
    (_, index) => `line-${String(index).padStart(4, '0')} ${'x'.repeat(40)}`,
  );

  assert.ok(byteLength(lines.join('\n')) > LEGACY_EAGER_LOAD_CAP_BYTES);

  const reading = sourceWindow.createSourceWindowReadingFromLines({
    lines,
    startLine: 500,
    lineCount: 6,
  });

  assert.equal(reading.text, undefined);
  assert.equal(reading.startLine, 500);
  assert.equal(reading.lineCount, 6);
  assert.equal(reading.totalLineCount, lines.length);
  assert.equal(reading.hasMoreBefore, true);
  assert.equal(reading.hasMoreAfter, true);
  assert.deepEqual(
    reading.lines.map((line) => line.lineNumber),
    [500, 501, 502, 503, 504, 505],
  );
  assert.deepEqual(
    reading.lines.map((line) => line.text),
    lines.slice(500, 506),
  );
});

test('source window rows render from the bounded reading only', async () => {
  const sourceWindow = await loadSourceWindowModule();
  const reading = {
    startLine: 10,
    lineCount: 3,
    totalLineCount: 99,
    hasMoreBefore: true,
    hasMoreAfter: true,
    lines: [
      { lineNumber: 10, text: '0123456789abcdef' },
      { lineNumber: 11, text: 'hello world' },
      { lineNumber: 12, text: 'short' },
    ],
  };

  assert.deepEqual(
    sourceWindow.sourceWindowRows(reading, 2, 8, 4),
    [
      '23456789',
      'llo worl',
      'ort     ',
      '        ',
    ],
  );
});

function byteLength(text) {
  return UTF8_ENCODER.encode(text).length;
}
