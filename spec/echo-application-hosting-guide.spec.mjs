import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import test from 'node:test';

const REPO_ROOT = process.cwd();
const GUIDE_PATH = path.join(REPO_ROOT, 'docs', 'echo-application-hosting-guide.md');

function sectionBetween(documentText, startHeading, endHeading) {
  const start = documentText.indexOf(startHeading);
  const end = documentText.indexOf(endHeading, start + startHeading.length);

  assert.notEqual(start, -1, `${startHeading} missing`);
  assert.notEqual(end, -1, `${endHeading} missing`);

  return documentText.slice(start, end);
}

test('Echo application hosting guide states the real authority boundary', () => {
  const source = readFileSync(GUIDE_PATH, 'utf8');
  const targetBoundary = sectionBetween(
    source,
    '## Target Active-Observer Boundary',
    '## Current Intent Lifecycle',
  );

  assert.match(source, /`Jim\.edict` is the application/);
  assert.match(source, /Echo owns generic admission,\s+scheduling, ticks/);
  assert.match(source, /Wesley compatibility package currently supplies/);
  assert.match(source, /Edict owns the generated semantic boundary/);
  assert.match(targetBoundary, /canonical event envelope with stable\s+event, source, ordering, normalized-input, and admission coordinates/);
  assert.match(targetBoundary, /Echo authority realm/);
  assert.match(targetBoundary, /deliver opaquely under exact JimRelease/);
  assert.match(targetBoundary, /jim\.core/);
  assert.match(targetBoundary, /basis-bound Reading/);
  assert.match(targetBoundary, /combined Jim-and-Buffer candidate/);
  assert.match(targetBoundary, /atomically settle candidate or retain conflict outcome/);
  assert.match(targetBoundary, /projection for one declared causal view basis/);
  assert.match(targetBoundary, /generated client in this boundary is a codec and transport stub/);
  assert.match(targetBoundary, /It may not\s+decide what a key means, derive a `ReplaceRange`, calculate a rope patch, or\s+advance cursor, mode, register, or operator state/);
  assert.match(
    source,
    /Echo production code must not implement or branch on `ReplaceRange`/,
  );
  assert.match(source, /Launch `native\/jedit-echo-host`/);
  assert.match(source, /Recover the graph and continue editing/);
  assert.match(source, /typed obstructions/);
  assert.match(source, /Jim checkpoint declaration and an Echo causal anchor are separate facts/);
  assert.match(source, /every user-visible text\s+transition and authoritative reading/i);
  assert.doesNotMatch(source, /in-memory state port/);
  assert.doesNotMatch(source, /installed jedit contract transport/i);
  assert.doesNotMatch(source, /JEDIT_ECHO_WASM_MODULE/);
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
