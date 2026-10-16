import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { REPO_ROOT } from './dist-helpers.mjs';
import { cleanGitEnv, git } from './git-fixture-helpers.mjs';

// These specs run the real hook entrypoints in scripts/hooks/ against a
// scratch repository. Only the expensive tools are stubbed: `npm` and `npx`
// on PATH record how they were invoked, from which directory, which file
// contents they could see, where dependencies resolve, and which of git's
// repository variables were still set.
const HOOKS = path.join(REPO_ROOT, 'scripts', 'hooks');

const STUB = `#!/usr/bin/env bash
{
  printf 'run %s' "$(basename "$0")"
  printf ' %s' "$@"
  printf '\\n'
  printf 'cwd %s\\n' "$PWD"
  printf 'deps %s\\n' "$(readlink node_modules || echo none)"
  for file in a.txt b.txt untracked.txt; do
    if [[ -e "$file" ]]; then
      printf 'saw %s %s\\n' "$file" "$(cat "$file")"
    else
      printf 'saw %s absent\\n' "$file"
    fi
  done
  while IFS= read -r var; do
    if [[ -n "$var" && -n "\${!var+set}" ]]; then
      printf 'leak %s\\n' "$var"
    fi
  done < <(git rev-parse --local-env-vars)
} >> "$HOOK_LOG"
if [[ "$(basename "$0") $1" == "$STUB_FAIL" ]]; then
  exit 1
fi
`;

function makeRepository() {
  const root = realpathSync(mkdtempSync(path.join(tmpdir(), 'jedit-hook-entrypoints-')));
  const repo = path.join(root, 'repo');
  const bin = path.join(root, 'bin');
  mkdirSync(path.join(repo, 'sub'), { recursive: true });
  mkdirSync(path.join(repo, 'node_modules'));
  mkdirSync(bin);
  writeFileSync(path.join(bin, 'npm'), STUB, { mode: 0o755 });
  writeFileSync(path.join(bin, 'npx'), STUB, { mode: 0o755 });
  writeFileSync(path.join(repo, '.gitignore'), 'node_modules/\n');
  writeFileSync(path.join(repo, 'a.txt'), 'a\n');
  writeFileSync(path.join(repo, 'b.txt'), 'b\n');
  git(repo, 'init', '-q', '-b', 'main');
  git(repo, 'config', 'user.email', 'hooks@test.invalid');
  git(repo, 'config', 'user.name', 'hooks test');
  git(repo, 'add', '-A');
  git(repo, 'commit', '-q', '-m', 'seed');
  git(repo, 'config', 'core.hooksPath', HOOKS);
  return { root, repo, bin, log: path.join(root, 'hook.log') };
}

function run(fixture, cwd, args, stubFail = '') {
  const result = spawnSync('git', args, {
    cwd,
    encoding: 'utf8',
    env: cleanGitEnv({
      PATH: `${fixture.bin}${path.delimiter}${process.env.PATH}`,
      HOOK_LOG: fixture.log,
      STUB_FAIL: stubFail,
    }),
  });
  const log = existsSync(fixture.log) ? readFileSync(fixture.log, 'utf8') : '';
  writeFileSync(fixture.log, '');
  return { ...result, log: log.split('\n').filter(Boolean) };
}

function commit(fixture, cwd, ...extra) {
  return run(fixture, cwd, ['commit', '-q', '-m', 'change', ...extra]);
}

function lines(result, prefix) {
  return result.log.filter((line) => line.startsWith(prefix));
}

function seen(result) {
  return [...new Set(lines(result, 'saw '))];
}

function edit(fixture, file, content) {
  writeFileSync(path.join(fixture.repo, file), `${content}\n`);
}

function commitCount(fixture) {
  return git(fixture.repo, 'rev-list', '--count', 'HEAD');
}

function addRemote(fixture) {
  const remote = path.join(fixture.root, 'remote.git');
  git(fixture.root, 'init', '-q', '--bare', remote);
  git(fixture.repo, 'remote', 'add', 'origin', remote);
  return remote;
}

function remoteRefs(remote) {
  return spawnSync('git', ['--git-dir', remote, 'show-ref'], { encoding: 'utf8', env: cleanGitEnv() })
    .stdout.trim();
}

test('pre-commit runs the quality gate then the typecheck in a removed staged snapshot', () => {
  const fixture = makeRepository();
  edit(fixture, 'a.txt', 'a2');
  git(fixture.repo, 'add', 'a.txt');
  const result = commit(fixture, path.join(fixture.repo, 'sub'));
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(lines(result, 'run '), [
    'run npm run --silent quality',
    'run npx --no-install tsc -p tsconfig.json --noEmit',
  ]);
  const [snapshot, ...rest] = new Set(lines(result, 'cwd '));
  assert.deepEqual(rest, []);
  assert.notEqual(snapshot, `cwd ${fixture.repo}`);
  assert.equal(existsSync(snapshot.slice('cwd '.length)), false, 'the snapshot is removed');
  assert.deepEqual([...new Set(lines(result, 'deps '))], [`deps ${path.join(fixture.repo, 'node_modules')}`]);
  assert.deepEqual(lines(result, 'leak '), []);
});

test('pre-commit clears git repository variables in a linked worktree', () => {
  const fixture = makeRepository();
  const worktree = path.join(fixture.root, 'linked');
  git(fixture.repo, 'worktree', 'add', '-q', worktree);
  mkdirSync(path.join(worktree, 'node_modules'));
  writeFileSync(path.join(worktree, 'a.txt'), 'linked\n');
  git(worktree, 'add', 'a.txt');
  const result = commit(fixture, worktree);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(lines(result, 'leak '), []);
  assert.deepEqual([...new Set(lines(result, 'deps '))], [`deps ${path.join(worktree, 'node_modules')}`]);
  assert.ok(seen(result).includes('saw a.txt linked'));
});

test('pre-commit stops at a failing quality gate without running the typecheck', () => {
  const fixture = makeRepository();
  edit(fixture, 'a.txt', 'a2');
  git(fixture.repo, 'add', 'a.txt');
  const result = run(fixture, fixture.repo, ['commit', '-q', '-m', 'change'], 'npm run');
  assert.notEqual(result.status, 0);
  assert.deepEqual(lines(result, 'run '), ['run npm run --silent quality']);
  assert.equal(existsSync(lines(result, 'cwd ')[0].slice('cwd '.length)), false);
  assert.equal(commitCount(fixture), '1');
});

test('pre-commit checks the staged copy of a partially staged file', () => {
  const fixture = makeRepository();
  edit(fixture, 'a.txt', 'staged');
  git(fixture.repo, 'add', 'a.txt');
  edit(fixture, 'a.txt', 'staged then edited');
  const result = commit(fixture, fixture.repo);
  assert.equal(result.status, 0, result.stderr);
  assert.ok(seen(result).includes('saw a.txt staged'));
  assert.equal(git(fixture.repo, 'show', 'HEAD:a.txt'), 'staged');
});

test('pre-commit does not see a file staged for deletion and then recreated', () => {
  const fixture = makeRepository();
  git(fixture.repo, 'rm', '-q', 'a.txt');
  edit(fixture, 'a.txt', 'recreated');
  const result = commit(fixture, fixture.repo);
  assert.equal(result.status, 0, result.stderr);
  assert.ok(seen(result).includes('saw a.txt absent'));
  assert.equal(git(fixture.repo, 'ls-tree', '--name-only', 'HEAD', 'a.txt'), '');
});

test('pre-commit sees neither unstaged work in other files nor untracked files', () => {
  const fixture = makeRepository();
  edit(fixture, 'a.txt', 'staged');
  git(fixture.repo, 'add', 'a.txt');
  edit(fixture, 'b.txt', 'unstaged elsewhere');
  edit(fixture, 'untracked.txt', 'untracked');
  const result = commit(fixture, fixture.repo);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(seen(result), ['saw a.txt staged', 'saw b.txt b', 'saw untracked.txt absent']);
  assert.equal(commitCount(fixture), '2');
});

test('pre-commit checks every tracked change under commit -a', () => {
  const fixture = makeRepository();
  edit(fixture, 'a.txt', 'staged');
  git(fixture.repo, 'add', 'a.txt');
  edit(fixture, 'a.txt', 'staged then edited');
  const result = commit(fixture, fixture.repo, '-a');
  assert.equal(result.status, 0, result.stderr);
  assert.ok(seen(result).includes('saw a.txt staged then edited'));
  assert.equal(git(fixture.repo, 'show', 'HEAD:a.txt'), 'staged then edited');
});

test('pre-commit checks only the selected path of a path-limited commit', () => {
  const fixture = makeRepository();
  edit(fixture, 'a.txt', 'staged');
  git(fixture.repo, 'add', 'a.txt');
  edit(fixture, 'a.txt', 'staged then edited');
  edit(fixture, 'b.txt', 'selected');
  const result = commit(fixture, fixture.repo, '--', 'b.txt');
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(seen(result), ['saw a.txt a', 'saw b.txt selected', 'saw untracked.txt absent']);
  assert.equal(git(fixture.repo, 'show', 'HEAD:a.txt'), 'a');
  assert.equal(git(fixture.repo, 'show', 'HEAD:b.txt'), 'selected');
  assert.equal(git(fixture.repo, 'show', ':a.txt'), 'staged', 'the other staged change stays staged');
});

test('pre-commit checks the working copy of a selected partially staged path', () => {
  const fixture = makeRepository();
  edit(fixture, 'a.txt', 'staged');
  git(fixture.repo, 'add', 'a.txt');
  edit(fixture, 'a.txt', 'staged then edited');
  const result = commit(fixture, fixture.repo, '--', 'a.txt');
  assert.equal(result.status, 0, result.stderr);
  assert.ok(seen(result).includes('saw a.txt staged then edited'));
  assert.equal(git(fixture.repo, 'show', 'HEAD:a.txt'), 'staged then edited');
});

test('pre-push runs the full suite from the repository root', () => {
  const fixture = makeRepository();
  const remote = addRemote(fixture);
  const result = run(fixture, path.join(fixture.repo, 'sub'), ['push', '-q', 'origin', 'main']);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(lines(result, 'run '), ['run npm run --silent test:all']);
  assert.deepEqual(lines(result, 'cwd '), [`cwd ${fixture.repo}`]);
  assert.deepEqual(lines(result, 'leak '), []);
  assert.notEqual(remoteRefs(remote), '');
});

test('pre-push blocks the push when the suite fails', () => {
  const fixture = makeRepository();
  const remote = addRemote(fixture);
  const result = run(fixture, fixture.repo, ['push', '-q', 'origin', 'main'], 'npm run');
  assert.notEqual(result.status, 0);
  assert.equal(remoteRefs(remote), '');
});

test('pre-push refuses a checkout whose tracked files differ from the pushed commit', () => {
  for (const change of ['unstaged', 'staged']) {
    const fixture = makeRepository();
    const remote = addRemote(fixture);
    edit(fixture, 'a.txt', change);
    if (change === 'staged') {
      git(fixture.repo, 'add', 'a.txt');
    }
    const result = run(fixture, fixture.repo, ['push', '-q', 'origin', 'main']);
    assert.notEqual(result.status, 0, change);
    assert.match(result.stderr, /a\.txt/);
    assert.deepEqual(result.log, [], 'no suite runs against content the push does not contain');
    assert.equal(remoteRefs(remote), '');
  }
});

test('pre-push refuses a checkout with untracked files', () => {
  const fixture = makeRepository();
  const remote = addRemote(fixture);
  edit(fixture, 'untracked.txt', 'untracked');
  const result = run(fixture, fixture.repo, ['push', '-q', 'origin', 'main']);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /untracked\.txt/);
  assert.deepEqual(result.log, []);
  assert.equal(remoteRefs(remote), '');
});

test('pre-push refuses to push a commit that is not checked out', () => {
  const fixture = makeRepository();
  const remote = addRemote(fixture);
  git(fixture.repo, 'branch', 'other');
  git(fixture.repo, 'switch', '-q', 'other');
  edit(fixture, 'a.txt', 'other');
  git(fixture.repo, 'commit', '-q', '--no-verify', '-am', 'other');
  git(fixture.repo, 'switch', '-q', 'main');
  const result = run(fixture, fixture.repo, ['push', '-q', 'origin', 'other']);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /refs\/heads\/other/);
  assert.deepEqual(result.log, []);
  assert.equal(remoteRefs(remote), '');
});

test('pre-push lets a branch deletion through without running the suite', () => {
  const fixture = makeRepository();
  const remote = addRemote(fixture);
  git(fixture.repo, 'push', '-q', '--no-verify', 'origin', 'main:gone');
  const result = run(fixture, fixture.repo, ['push', '-q', 'origin', ':gone']);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(result.log, []);
  assert.doesNotMatch(remoteRefs(remote), /gone/);
  rmSync(fixture.root, { recursive: true, force: true });
});
