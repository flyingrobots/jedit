import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { REPO_ROOT } from './dist-helpers.mjs';
import { cleanGitEnv, git } from './git-fixture-helpers.mjs';

// scripts/install-hooks.sh installs launchers in the shared git directory,
// so every worktree reaches its own tracked hooks, and a worktree whose
// sparse checkout omits them refuses rather than silently skipping them.
const STUB = `#!/usr/bin/env bash
printf 'run %s' "$(basename "$0")" >> "$HOOK_LOG"
printf ' %s' "$@" >> "$HOOK_LOG"
printf '\\n' >> "$HOOK_LOG"
`;

function makeRepository(t) {
  const root = realpathSync(mkdtempSync(path.join(tmpdir(), 'jedit-install-hooks-')));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const repo = path.join(root, 'repo');
  const bin = path.join(root, 'bin');
  mkdirSync(path.join(repo, 'node_modules'), { recursive: true });
  mkdirSync(bin);
  writeFileSync(path.join(bin, 'npm'), STUB, { mode: 0o755 });
  writeFileSync(path.join(bin, 'npx'), STUB, { mode: 0o755 });
  writeFileSync(path.join(repo, '.gitignore'), 'node_modules/\n');
  writeFileSync(path.join(repo, 'package.json'), '{}\n');
  writeFileSync(path.join(repo, 'package-lock.json'), '{}\n');
  writeFileSync(path.join(repo, 'a.txt'), 'a\n');
  git(repo, 'init', '-q', '-b', 'main');
  git(repo, 'config', 'user.email', 'hooks@test.invalid');
  git(repo, 'config', 'user.name', 'hooks test');
  git(repo, 'add', '-A');
  git(repo, 'commit', '-q', '-m', 'before hooks');
  const beforeHooks = git(repo, 'rev-parse', 'HEAD');
  cpSync(path.join(REPO_ROOT, 'scripts', 'hooks'), path.join(repo, 'scripts', 'hooks'), { recursive: true });
  cpSync(path.join(REPO_ROOT, 'scripts', 'install-hooks.sh'), path.join(repo, 'scripts', 'install-hooks.sh'));
  git(repo, 'add', '-A');
  git(repo, 'commit', '-q', '-m', 'add hooks');
  const install = spawnSync('scripts/install-hooks.sh', { cwd: repo, encoding: 'utf8', env: cleanGitEnv() });
  assert.equal(install.status, 0, install.stderr);
  return { root, repo, bin, beforeHooks, log: path.join(root, 'hook.log') };
}

function commitIn(fixture, cwd) {
  writeFileSync(path.join(cwd, 'a.txt'), `${cwd}\n`);
  git(cwd, 'add', 'a.txt');
  const result = spawnSync('git', ['commit', '-q', '-m', 'change'], {
    cwd,
    encoding: 'utf8',
    env: cleanGitEnv({ PATH: `${fixture.bin}${path.delimiter}${process.env.PATH}`, HOOK_LOG: fixture.log }),
  });
  const log = existsSync(fixture.log) ? readFileSync(fixture.log, 'utf8') : '';
  writeFileSync(fixture.log, '');
  return { ...result, runs: log.split('\n').filter(Boolean) };
}

test('the installer points every worktree at launchers in the shared git directory', (t) => {
  const fixture = makeRepository(t);
  const hooksPath = git(fixture.repo, 'config', '--get', 'core.hooksPath');
  const common = realpathSync(git(fixture.repo, 'rev-parse', '--path-format=absolute', '--git-common-dir'));
  assert.equal(path.isAbsolute(hooksPath), true);
  assert.equal(realpathSync(path.dirname(hooksPath)), common);
  const result = commitIn(fixture, fixture.repo);
  assert.equal(result.status, 0, result.stderr);
  assert.ok(result.runs.includes('run npm run --silent quality'), 'the tracked pre-commit ran');
});

test('a sparse worktree that omits its tracked hooks refuses to commit', (t) => {
  const fixture = makeRepository(t);
  const worktree = path.join(fixture.root, 'sparse');
  git(fixture.repo, 'worktree', 'add', '-q', worktree);
  git(worktree, 'sparse-checkout', 'set', '--no-cone', '/a.txt', '/package*.json', '/.gitignore');
  assert.equal(existsSync(path.join(worktree, 'scripts', 'hooks', 'pre-commit')), false);
  const before = git(worktree, 'rev-parse', 'HEAD');
  const result = commitIn(fixture, worktree);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /scripts\/hooks\/pre-commit/);
  assert.equal(git(worktree, 'rev-parse', 'HEAD'), before);
});

test('a branch from before the hooks existed commits without them', (t) => {
  const fixture = makeRepository(t);
  const worktree = path.join(fixture.root, 'old');
  git(fixture.repo, 'worktree', 'add', '-q', '--detach', worktree, fixture.beforeHooks);
  const result = commitIn(fixture, worktree);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(result.runs, []);
  assert.match(result.stderr, /not part of this branch/);
});
