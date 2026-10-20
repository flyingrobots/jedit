import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  chmodSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readlinkSync,
  realpathSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { REPO_ROOT } from './dist-helpers.mjs';
import { cleanGitEnv, git } from './git-fixture-helpers.mjs';

// scripts/install-hooks.sh installs launchers in the repository's own hooks
// directory, shared by every worktree and moved with the clone. Each runs
// the worktree's tracked hook and refuses when a hook this history tracks is
// missing; only history that never had the hook skips it.
const STUB = `#!/usr/bin/env bash
printf 'run %s' "$(basename "$0")" >> "$HOOK_LOG"
printf ' %s' "$@" >> "$HOOK_LOG"
printf '\\n' >> "$HOOK_LOG"
`;

function install(cwd, env = {}) {
  return spawnSync('scripts/install-hooks.sh', { cwd, encoding: 'utf8', env: cleanGitEnv(env) });
}

function addRemote(fixture) {
  const remote = path.join(fixture.root, 'remote.git');
  git(fixture.root, 'init', '-q', '--bare', remote);
  git(fixture.repo, 'remote', 'add', 'origin', remote);
  return remote;
}

function remoteRefs(remote) {
  return spawnSync('git', ['--git-dir', remote, 'show-ref'], { encoding: 'utf8', env: cleanGitEnv() }).stdout.trim();
}

function makeRepository(t) {
  const root = realpathSync(mkdtempSync(path.join(tmpdir(), 'jedit-install-hooks-')));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const repo = path.join(root, 'repo');
  const bin = path.join(root, 'bin');
  mkdirSync(repo);
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
  const result = install(repo);
  assert.equal(result.status, 0, result.stderr);
  return { root, repo, bin, beforeHooks, log: path.join(root, 'hook.log') };
}

function hookEnv(fixture) {
  return cleanGitEnv({ PATH: `${fixture.bin}${path.delimiter}${process.env.PATH}`, HOOK_LOG: fixture.log });
}

function runs(fixture) {
  const log = existsSync(fixture.log) ? readFileSync(fixture.log, 'utf8') : '';
  writeFileSync(fixture.log, '');
  return log.split('\n').filter(Boolean);
}

function commitIn(fixture, cwd) {
  writeFileSync(path.join(cwd, 'a.txt'), `${cwd}\n`);
  git(cwd, 'add', 'a.txt');
  const result = spawnSync('git', ['commit', '-q', '-m', 'change'], { cwd, encoding: 'utf8', env: hookEnv(fixture) });
  return { ...result, runs: runs(fixture) };
}

test('the installer uses the repository hooks directory and leaves core.hooksPath unset', (t) => {
  const fixture = makeRepository(t);
  const configured = spawnSync('git', ['config', '--get', 'core.hooksPath'], { cwd: fixture.repo, env: cleanGitEnv() });
  assert.notEqual(configured.status, 0, 'core.hooksPath is not set');
  assert.equal(existsSync(path.join(fixture.repo, '.git', 'hooks', 'pre-commit')), true);
  const result = commitIn(fixture, fixture.repo);
  assert.equal(result.status, 0, result.stderr);
  assert.ok(result.runs.includes('run npm run --silent quality'), 'the tracked pre-commit ran');
});

test('the hooks still run after the clone is moved', (t) => {
  const fixture = makeRepository(t);
  const moved = path.join(fixture.root, 'moved');
  renameSync(fixture.repo, moved);
  const result = commitIn(fixture, moved);
  assert.equal(result.status, 0, result.stderr);
  assert.ok(result.runs.includes('run npm run --silent quality'));
});

test('the installer refuses when a worktree setting would override the hooks directory', (t) => {
  const fixture = makeRepository(t);
  git(fixture.repo, 'config', 'extensions.worktreeConfig', 'true');
  git(fixture.repo, 'config', '--worktree', 'core.hooksPath', path.join(fixture.root, 'elsewhere'));
  const result = install(fixture.repo);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /core\.hooksPath/);
});

test('the installer does not overwrite a hook it did not install', (t) => {
  const fixture = makeRepository(t);
  const foreign = path.join(fixture.repo, '.git', 'hooks', 'pre-push');
  writeFileSync(foreign, '#!/bin/sh\necho mine\n', { mode: 0o755 });
  const result = install(fixture.repo);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /pre-push/);
  assert.equal(readFileSync(foreign, 'utf8'), '#!/bin/sh\necho mine\n');
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

test('a branch cannot bypass its hooks by deleting them', (t) => {
  const fixture = makeRepository(t);
  git(fixture.repo, 'rm', '-q', '-r', 'scripts/hooks');
  git(fixture.repo, 'commit', '-q', '--no-verify', '-m', 'delete hooks');
  const result = commitIn(fixture, fixture.repo);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /scripts\/hooks\/pre-commit/);
});

test('a branch from before the hooks existed commits without them', (t) => {
  const fixture = makeRepository(t);
  const worktree = path.join(fixture.root, 'old');
  git(fixture.repo, 'worktree', 'add', '-q', '--detach', worktree, fixture.beforeHooks);
  const result = commitIn(fixture, worktree);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(result.runs, []);
  assert.match(result.stderr, /never had/);
});

test('pushing a branch that has hooks from a worktree that predates them is refused', (t) => {
  const fixture = makeRepository(t);
  const remote = addRemote(fixture);
  const worktree = path.join(fixture.root, 'old');
  git(fixture.repo, 'worktree', 'add', '-q', '--detach', worktree, fixture.beforeHooks);
  const result = spawnSync('git', ['push', '-q', 'origin', 'main'], { cwd: worktree, encoding: 'utf8', env: hookEnv(fixture) });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /scripts\/hooks\/pre-push/);
  assert.equal(remoteRefs(remote), '');
});

test('unstaging a hook while its file stays in the worktree cannot commit the deletion', (t) => {
  const fixture = makeRepository(t);
  git(fixture.repo, 'rm', '-q', '--cached', 'scripts/hooks/pre-commit');
  const result = spawnSync('git', ['commit', '-q', '-m', 'drop hook'], { cwd: fixture.repo, encoding: 'utf8', env: hookEnv(fixture) });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /scripts\/hooks\/pre-commit/);
  assert.equal(git(fixture.repo, 'ls-tree', '--name-only', 'HEAD', 'scripts/hooks/pre-commit'), 'scripts/hooks/pre-commit');
});

test('pushing a branch whose tip deleted its pre-push hook is refused', (t) => {
  const fixture = makeRepository(t);
  const remote = addRemote(fixture);
  git(fixture.repo, 'switch', '-q', '-c', 'drop');
  git(fixture.repo, 'rm', '-q', 'scripts/hooks/pre-push');
  git(fixture.repo, 'commit', '-q', '--no-verify', '-m', 'drop pre-push');
  git(fixture.repo, 'switch', '-q', 'main');
  const result = spawnSync('git', ['push', '-q', 'origin', 'drop'], { cwd: fixture.repo, encoding: 'utf8', env: hookEnv(fixture) });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /scripts\/hooks\/pre-push/);
  assert.equal(remoteRefs(remote), '');
});

test('a merge that dropped the hooks does not hide history that had them', (t) => {
  const fixture = makeRepository(t);
  const worktree = path.join(fixture.root, 'old');
  git(fixture.repo, 'worktree', 'add', '-q', '-b', 'old', worktree, fixture.beforeHooks);
  git(worktree, 'merge', '-q', '--no-verify', '-s', 'ours', '-m', 'merge main, keep old tree', 'main');
  assert.equal(existsSync(path.join(worktree, 'scripts', 'hooks', 'pre-commit')), false);
  const result = commitIn(fixture, worktree);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /scripts\/hooks\/pre-commit/);
});

test('a failed installation keeps the legacy hook path it found', (t) => {
  const fixture = makeRepository(t);
  git(fixture.repo, 'config', 'core.hooksPath', 'scripts/hooks');
  const global = path.join(fixture.root, 'global.gitconfig');
  writeFileSync(global, `[core]\n\thooksPath = ${path.join(fixture.root, 'global-hooks')}\n`);
  const result = install(fixture.repo, { GIT_CONFIG_GLOBAL: global });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /core\.hooksPath/);
  assert.equal(git(fixture.repo, 'config', '--local', '--get', 'core.hooksPath'), 'scripts/hooks');
});

test('the installer refuses when another linked worktree overrides the hooks directory', (t) => {
  const fixture = makeRepository(t);
  const worktree = path.join(fixture.root, 'other');
  git(fixture.repo, 'worktree', 'add', '-q', worktree);
  git(fixture.repo, 'config', 'extensions.worktreeConfig', 'true');
  git(worktree, 'config', '--worktree', 'core.hooksPath', path.join(fixture.root, 'elsewhere'));
  const result = install(fixture.repo);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, new RegExp(worktree.replaceAll('/', '\\/')));
});

test('the installer treats a dangling hook symlink as a hook it did not install', (t) => {
  const fixture = makeRepository(t);
  const slot = path.join(fixture.repo, '.git', 'hooks', 'pre-push');
  const target = path.join(fixture.root, 'dotfiles', 'pre-push');
  mkdirSync(path.dirname(target));
  rmSync(slot);
  symlinkSync(target, slot);
  const result = install(fixture.repo);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /pre-push/);
  assert.equal(existsSync(target), false, 'the symlink target was not created');
  assert.equal(readlinkSync(slot), target, 'the symlink was left alone');
});

test('a launcher that cannot be written keeps the legacy hook path it found', (t) => {
  const fixture = makeRepository(t);
  const hooks = path.join(fixture.repo, '.git', 'hooks');
  git(fixture.repo, 'config', 'core.hooksPath', 'scripts/hooks');
  rmSync(path.join(hooks, 'pre-push'));
  chmodSync(hooks, 0o555);
  let result;
  try {
    result = install(fixture.repo);
  } finally {
    chmodSync(hooks, 0o755);
  }
  assert.notEqual(result.status, 0);
  assert.equal(git(fixture.repo, 'config', '--local', '--get', 'core.hooksPath'), 'scripts/hooks');
});

test('the installer refuses when a registered worktree is unavailable', (t) => {
  const fixture = makeRepository(t);
  const worktree = path.join(fixture.root, 'removable');
  git(fixture.repo, 'worktree', 'add', '-q', worktree);
  git(fixture.repo, 'worktree', 'lock', worktree);
  renameSync(worktree, path.join(fixture.root, 'unplugged'));
  const result = install(fixture.repo);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, new RegExp(worktree.replaceAll('/', '\\/')));
});

test('pushing a branch whose pre-push hook is not executable is refused', (t) => {
  const fixture = makeRepository(t);
  const remote = addRemote(fixture);
  git(fixture.repo, 'switch', '-q', '-c', 'plain');
  chmodSync(path.join(fixture.repo, 'scripts', 'hooks', 'pre-push'), 0o644);
  git(fixture.repo, 'add', 'scripts/hooks/pre-push');
  git(fixture.repo, 'commit', '-q', '--no-verify', '-m', 'pre-push loses its mode');
  git(fixture.repo, 'switch', '-q', 'main');
  const result = spawnSync('git', ['push', '-q', 'origin', 'plain'], { cwd: fixture.repo, encoding: 'utf8', env: hookEnv(fixture) });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /scripts\/hooks\/pre-push/);
  assert.equal(remoteRefs(remote), '');
});

test('a commit that records its pre-commit hook as not executable is refused', (t) => {
  const fixture = makeRepository(t);
  git(fixture.repo, 'update-index', '--chmod=-x', 'scripts/hooks/pre-commit');
  const result = spawnSync('git', ['commit', '-q', '-m', 'pre-commit loses its mode'], { cwd: fixture.repo, encoding: 'utf8', env: hookEnv(fixture) });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /scripts\/hooks\/pre-commit/);
  assert.equal(git(fixture.repo, 'ls-tree', 'HEAD', 'scripts/hooks/pre-commit').split(' ')[0], '100755');
});

function shallowCloneAfterDeletion(fixture) {
  git(fixture.repo, 'rm', '-q', '-r', 'scripts/hooks');
  git(fixture.repo, 'commit', '-q', '--no-verify', '-m', 'delete hooks');
  const shallow = path.join(fixture.root, 'shallow');
  git(fixture.root, 'clone', '-q', '--depth', '1', `file://${fixture.repo}`, shallow);
  git(shallow, 'config', 'user.email', 'hooks@test.invalid');
  git(shallow, 'config', 'user.name', 'hooks test');
  const result = install(shallow);
  assert.equal(result.status, 0, result.stderr);
  return shallow;
}

test('a shallow clone cannot conclude its history never had the hooks when committing', (t) => {
  const fixture = makeRepository(t);
  const shallow = shallowCloneAfterDeletion(fixture);
  const before = git(shallow, 'rev-parse', 'HEAD');
  const result = commitIn(fixture, shallow);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /shallow/);
  assert.equal(git(shallow, 'rev-parse', 'HEAD'), before);
});

test('a shallow clone cannot conclude its history never had the hooks when pushing', (t) => {
  const fixture = makeRepository(t);
  const shallow = shallowCloneAfterDeletion(fixture);
  // The remote already has the full history, so git itself accepts a push
  // from the shallow clone; only the launcher can refuse it.
  const remote = path.join(fixture.root, 'full.git');
  git(fixture.root, 'clone', '-q', '--bare', fixture.repo, remote);
  writeFileSync(path.join(shallow, 'a.txt'), 'hookless\n');
  git(shallow, 'commit', '-q', '--no-verify', '-am', 'hookless change');
  const result = spawnSync('git', ['push', '-q', remote, 'HEAD:refs/heads/hookless'], { cwd: shallow, encoding: 'utf8', env: hookEnv(fixture) });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /shallow/);
  assert.doesNotMatch(remoteRefs(remote), /refs\/heads\/hookless/);
});
