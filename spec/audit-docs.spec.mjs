import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const READY_AUDIT = 'docs/audits/ready-to-ship-assessment-2026-06-28.md';

function readRepoText(path) {
  return readFileSync(path, 'utf8');
}

test('ready-to-ship audit does not prescribe forbidden unknown annotations', () => {
  const audit = readRepoText(READY_AUDIT);

  assert.doesNotMatch(audit, /nodeErrorCode\(cause: unknown\)/);
  assert.doesNotMatch(audit, /loadErrorResult\(filePath: string, cause: unknown\)/);
  assert.match(audit, /nodeErrorCode\(cause: Error\): string \| undefined/);
});

test('ready-to-ship audit includes parent directory fsync in atomic save guidance', () => {
  const audit = readRepoText(READY_AUDIT);

  assert.match(audit, /fsync the parent directory after rename/);
});

test('ready-to-ship audit separates production export preflight from legacy save risk', () => {
  const audit = readRepoText(READY_AUDIT);

  assert.match(audit, /Ctrl-S and `:write`.*saveProductionText/s);
  assert.match(audit, /materializationPreflightIssue/);
  assert.match(audit, /legacy.*saveEditor/s);
  assert.doesNotMatch(audit, /Two Jim instances, or Jim plus any external tool, silently clobber each other/);
});
