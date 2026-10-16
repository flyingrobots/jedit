import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { REPO_ROOT } from './dist-helpers.mjs';
import { cleanGitEnv, git } from './git-fixture-helpers.mjs';

const HELPER = path.join(REPO_ROOT, 'scripts', 'hooks', 'lib', 'enter-repository.sh');

// A probe hook: enter the repository, then report what a git-aware tool
// sees from a subdirectory, the way the specs ask for REPO_ROOT. The helper
// path arrives as data in PROBE_HELPER, never as generated Bash syntax.
const PROBE_HOOK = `#!/usr/bin/env bash
set -euo pipefail
source "$PROBE_HELPER"
enter_repository
cd sub
git rev-parse --show-toplevel > "$PROBE_OUT"
`;

function makeRepository(t) {
  const root = realpathSync(mkdtempSync(path.join(tmpdir(), 'jedit-hooks-')));
  t.after(() => rmSync(root, { recursive: true, force: true }));
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
    env: cleanGitEnv({ PROBE_OUT: probeOut, PROBE_HELPER: HELPER }),
  });
  assert.equal(result.status, 0, result.stderr);
  return readFileSync(probeOut, 'utf8').trim();
}

test('a hook in a normal clone sees the clone root from a subdirectory', (t) => {
  const { repo } = makeRepository(t);
  assert.equal(commitAndProbe(repo, 'clone'), repo);
});

test('a hook in a linked worktree sees the worktree root from a subdirectory', (t) => {
  const { root, repo } = makeRepository(t);
  commitAndProbe(repo, 'seed');
  const worktree = path.join(root, 'linked');
  git(repo, 'worktree', 'add', '-q', worktree);
  assert.equal(commitAndProbe(worktree, 'linked'), worktree);
});

test('entering the repository succeeds with no git variables exported', (t) => {
  const { repo } = makeRepository(t);
  const script = 'set -euo pipefail; source "$PROBE_HELPER"; enter_repository; pwd';
  const result = spawnSync('bash', ['-c', script], {
    cwd: path.join(repo, 'sub'),
    encoding: 'utf8',
    env: cleanGitEnv({ PROBE_HELPER: HELPER }),
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), repo);
});
