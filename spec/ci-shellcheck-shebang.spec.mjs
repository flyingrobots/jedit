import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { cleanGitEnv, git } from './git-fixture-helpers.mjs';

// scripts/ci/shellcheck.sh checks an extensionless tracked file when its
// shebang names bash or sh. shebang_interpreter classifies plain shebangs and
// reports env shebangs it does not parse (env options, quotes, escapes) so the
// driver refuses them instead of silently skipping a shell script.
const LIBRARY = path.join(process.cwd(), 'scripts', 'ci', 'lib', 'shebang.sh');
const NO_INTERPRETER = '<none>';
const UNPARSED = '<unparsed>';
const UNPARSED_STATUS = 2;

const CASES = Object.freeze([
  ['#!/bin/sh', 'sh'],
  ['#!/usr/bin/env bash', 'bash'],
  ['#! /bin/bash', 'bash'],
  ['#!/bin/bash -e', 'bash'],
  ['#!/usr/bin/env FOO=1 sh', 'sh'],
  ['#!/usr/bin/env python # sh', 'python'],
  ['#!/usr/bin/env node # sh', 'node'],
  ['#!/opt/bash-tools/python', 'python'],
  ['#!/bin/dash', 'dash'],
  ['#!/usr/bin/env', NO_INTERPRETER],
  ['echo no shebang', NO_INTERPRETER],
  ['#!/usr/bin/env -S bash -e', UNPARSED],
  ['#!/usr/bin/env -i bash', UNPARSED],
  ['#!/usr/bin/env -u FOO sh', UNPARSED],
  ['#!/usr/bin/env -S -iu FOO bash', UNPARSED],
  ['#!/usr/bin/env --split-string=-u"FOO BAR" bash', UNPARSED],
  ['#!/usr/bin/env -S bash\\_-e', UNPARSED],
  ['#!/usr/bin/env "bash"', UNPARSED],
  ['#!/usr/bin/env -S python3 -u', UNPARSED],
]);

function temporaryDirectory(t, prefix) {
  const directory = realpathSync(mkdtempSync(path.join(tmpdir(), prefix)));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  return directory;
}

function classify(directory, index, firstLine) {
  const file = path.join(directory, `case-${index}`);
  writeFileSync(file, `${firstLine}\necho body\n`);
  const result = spawnSync('bash', ['-c', 'source "$1" && shebang_interpreter "$2"', 'shebang', LIBRARY, file], {
    encoding: 'utf8',
  });
  if (result.status === UNPARSED_STATUS) return UNPARSED;
  return result.status === 0 ? result.stdout.trim() : NO_INTERPRETER;
}

test('shebang_interpreter classifies plain shebangs and reports env forms it does not parse', (t) => {
  const directory = temporaryDirectory(t, 'jedit-shebang-');

  CASES.forEach(([firstLine, expected], index) => {
    assert.equal(classify(directory, index, firstLine), expected, firstLine);
  });
});

test('the ShellCheck driver refuses a tracked file whose env shebang it cannot classify', (t) => {
  const repo = temporaryDirectory(t, 'jedit-shellcheck-driver-');
  mkdirSync(path.join(repo, 'scripts', 'ci'), { recursive: true });
  cpSync(path.join(process.cwd(), 'scripts', 'ci'), path.join(repo, 'scripts', 'ci'), { recursive: true });
  writeFileSync(path.join(repo, 'run'), '#!/usr/bin/env -S bash -e\necho hi\n', { mode: 0o755 });
  git(repo, 'init', '-q');
  git(repo, 'add', '-A');

  const result = spawnSync(path.join(repo, 'scripts', 'ci', 'shellcheck.sh'), [], {
    cwd: repo,
    encoding: 'utf8',
    env: cleanGitEnv(),
  });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /cannot tell whether run is a shell script/);
});

test('the ShellCheck driver never opens tracked Markdown files', (t) => {
  const repo = temporaryDirectory(t, 'jedit-shellcheck-markdown-');
  mkdirSync(path.join(repo, 'scripts', 'ci'), { recursive: true });
  cpSync(path.join(process.cwd(), 'scripts', 'ci'), path.join(repo, 'scripts', 'ci'), { recursive: true });
  writeFileSync(path.join(repo, 'run'), '#!/usr/bin/env -S bash -e\necho hi\n', { mode: 0o755 });
  writeFileSync(path.join(repo, 'notes.md'), '#!/usr/bin/env -S bash -e\n# Notes\n');
  git(repo, 'init', '-q');
  git(repo, 'add', '-A');

  const result = spawnSync(path.join(repo, 'scripts', 'ci', 'shellcheck.sh'), [], {
    cwd: repo,
    encoding: 'utf8',
    env: cleanGitEnv(),
  });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /cannot tell whether run is a shell script/);
  assert.doesNotMatch(result.stderr, /notes\.md/);
});
