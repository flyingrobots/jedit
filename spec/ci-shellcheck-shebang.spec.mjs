import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

// scripts/ci/shellcheck.sh checks an extensionless tracked file only when its
// shebang names bash or sh as the interpreter, looking through env and its
// options. shebang_interpreter decides that; these cases pin it.
const LIBRARY = path.join(process.cwd(), 'scripts', 'ci', 'lib', 'shebang.sh');
const NO_INTERPRETER = '';

const CASES = Object.freeze([
  ['#!/bin/sh', 'sh'],
  ['#!/usr/bin/env bash', 'bash'],
  ['#! /bin/bash', 'bash'],
  ['#!/usr/bin/env FOO=1 sh', 'sh'],
  ['#!/usr/bin/env -i bash', 'bash'],
  ['#!/usr/bin/env -- bash', 'bash'],
  ['#!/usr/bin/env -u FOO sh', 'sh'],
  ['#!/usr/bin/env -uFOO bash', 'bash'],
  ['#!/usr/bin/env --unset=FOO bash', 'bash'],
  ['#!/usr/bin/env -P /usr/local/bin bash', 'bash'],
  ['#!/usr/bin/env -S bash -e', 'bash'],
  ['#!/usr/bin/env -Sbash -e', 'bash'],
  ['#!/usr/bin/env -S -u FOO bash', 'bash'],
  ['#!/usr/bin/env -S -C /tmp bash', 'bash'],
  ['#!/usr/bin/env --split-string=bash', 'bash'],
  ['#!/usr/bin/env -S -u "FOO BAR" bash', 'bash'],
  ['#!/usr/bin/env -S "bash" -e', 'bash'],
  ["#!/usr/bin/env -S 'bash' -e", 'bash'],
  ['#!/usr/bin/env -S -- FOO=1 bash', 'bash'],
  ['#!/usr/bin/env - bash', 'bash'],
  ['#!/usr/bin/env -S FOO="a b" sh', 'sh'],
  ['#!/usr/bin/env python # sh', 'python'],
  ['#!/usr/bin/env node # sh', 'node'],
  ['#!/opt/bash-tools/python', 'python'],
  ['#!/usr/bin/env -S python3 -u', 'python3'],
  ['#!/bin/dash', 'dash'],
  ['#!/usr/bin/env', NO_INTERPRETER],
  ['echo no shebang', NO_INTERPRETER],
]);

function interpreterOf(directory, index, firstLine) {
  const file = path.join(directory, `case-${index}`);
  writeFileSync(file, `${firstLine}\necho body\n`);
  const result = spawnSync('bash', ['-c', 'source "$1" && shebang_interpreter "$2"', 'shebang', LIBRARY, file], {
    encoding: 'utf8',
  });
  return result.status === 0 ? result.stdout.trim() : NO_INTERPRETER;
}

test('shebang_interpreter names the interpreter a shebang runs, looking through env', (t) => {
  const directory = realpathSync(mkdtempSync(path.join(tmpdir(), 'jedit-shebang-')));
  t.after(() => rmSync(directory, { recursive: true, force: true }));

  CASES.forEach(([firstLine, expected], index) => {
    assert.equal(interpreterOf(directory, index, firstLine), expected, firstLine);
  });
});
