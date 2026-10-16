import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { REPO_ROOT } from './dist-helpers.mjs';

const HELPER = path.join(REPO_ROOT, 'scripts', 'hooks', 'lib', 'enter-repository.sh');

// A probe hook: enter the repository, then report what a git-aware tool
// sees from a subdirectory, the way the specs ask for REPO_ROOT.
const PROBE_HOOK = `#!/usr/bin/env bash
set -euo pipefail
source "${HELPER}"
enter_repository
cd sub
git rev-parse --show-toplevel > "$PROBE_OUT"
`;

function git(cwd, ...args) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}

function makeRepository() {
  const root = realpathSync(mkdtempSync(path.join(tmpdir(), 'jedit-hooks-')));
  const repo = path.join(root, 'repo');
  mkdirSync(path.join(repo, 'sub'), { recursive: true });
  mkdirSync(path.join(repo, 'hooks'));
  writeFileSync(path.join(repo, 'hooks', 'pre-commit'), PROBE_HOOK, { mode: 0o755 });
  writeFileSync(path.join(repo, 'sub', 'file.txt'), 'x\n');
  git(repo, 'init', '-q');
  git(repo, 'config', 'user.email', 'hooks@test.invalid');
  git(repo, 'config', 'user.name', 'hooks test');
  git(repo, 'config', 'core.hooksPath', path.join(repo, 'hooks'));
  return { root, repo };
}

function commitAndProbe(checkout, label) {
  const probeOut = path.join(path.dirname(checkout), `${label}.out`);
  writeFileSync(path.join(checkout, 'sub', `${label}.txt`), `${label}\n`);
  git(checkout, 'add', '-A');
  const result = spawnSync('git', ['commit', '-q', '-m', label], {
    cwd: checkout,
    encoding: 'utf8',
    env: { ...process.env, PROBE_OUT: probeOut },
  });
  assert.equal(result.status, 0, result.stderr);
  return readFileSync(probeOut, 'utf8').trim();
}

test('a hook in a normal clone sees the clone root from a subdirectory', () => {
  const { repo } = makeRepository();
  assert.equal(commitAndProbe(repo, 'clone'), repo);
});

test('a hook in a linked worktree sees the worktree root from a subdirectory', () => {
  const { root, repo } = makeRepository();
  commitAndProbe(repo, 'seed');
  const worktree = path.join(root, 'linked');
  git(repo, 'worktree', 'add', '-q', worktree);
  assert.equal(commitAndProbe(worktree, 'linked'), worktree);
});

test('entering the repository succeeds with no git variables exported', () => {
  const { repo } = makeRepository();
  const script = `set -euo pipefail; source "${HELPER}"; enter_repository; pwd`;
  const result = spawnSync('bash', ['-c', script], { cwd: path.join(repo, 'sub'), encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), repo);
});
