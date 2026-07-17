import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import test from 'node:test';

const REPO_ROOT = process.cwd();
const GUIDE_PATH = path.join(REPO_ROOT, 'docs', 'echo-application-hosting-guide.md');

test('Echo application hosting guide states the real authority boundary', () => {
  const source = readFileSync(GUIDE_PATH, 'utf8');

  assert.match(source, /Echo owns admission, scheduling, ticks/);
  assert.match(source, /Edict owns the generated boundary/);
  assert.match(source, /intentionally broken rather than counterfeit/);
  assert.match(source, /typed obstructions/);
  assert.match(source, /Jim checkpoint declaration and an Echo causal anchor are separate facts/);
  assert.match(source, /every user-visible text transition and reading/);
  assert.doesNotMatch(source, /in-memory state port/);
  assert.doesNotMatch(source, /installed jedit contract transport/i);
});

test('Echo application hosting guide cutover guard command is executable', () => {
  const result = spawnSync(process.execPath, [
    'scripts/jedit-production-cutover-guard.mjs',
  ], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
});
