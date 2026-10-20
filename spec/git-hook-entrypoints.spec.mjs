import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { REPO_ROOT } from './dist-helpers.mjs';
import { cleanGitEnv, git } from './git-fixture-helpers.mjs';

// These specs run the real hook entrypoints in scripts/hooks/ against a
// scratch repository. Only the expensive tools are stubbed: `npm` and `npx`
// on PATH record how they were invoked, from which directory, commit, and
// tree, what that tree contained, where dependencies resolve, and which of
// git's repository variables were still set.
const HOOKS = path.join(REPO_ROOT, 'scripts', 'hooks');
const NATIVE = path.join('native', 'jedit-echo-host');
const NPM_CI = 'run npm ci --prefer-offline --no-audit --no-fund';

const STUB = `#!/usr/bin/env bash
{
  printf 'run %s' "$(basename "$0")"
  printf ' %s' "$@"
  printf '\\n'
} >> "$HOOK_LOG"
if [[ "$(basename "$0") $1" == "npm ci" ]]; then
  printf 'install-cwd %s\\n' "$PWD" >> "$HOOK_LOG"
  [[ "npm ci" != "$STUB_FAIL" ]]
  exit
fi
{
  printf 'cwd %s\\n' "$PWD"
  printf 'head %s\\n' "$(git rev-parse --verify --quiet HEAD 2>/dev/null || echo none)"
  printf 'tree %s\\n' "$(git rev-parse --verify --quiet 'HEAD^{tree}' 2>/dev/null || echo none)"
  printf 'deps %s\\n' "$(readlink node_modules || echo none)"
  printf 'target %s\\n' "$(readlink ${NATIVE}/target || echo none)"
  for file in a.txt b.txt untracked.txt; do
    if [[ -L "$file" ]]; then
      printf 'saw %s symlink\\n' "$file"
    elif [[ -e "$file" ]]; then
      printf 'saw %s %s\\n' "$file" "$(cat "$file")"
    else
      printf 'saw %s absent\\n' "$file"
    fi
  done
  if [[ -e tool.sh ]]; then
    printf 'exec %s\\n' "$([[ -x tool.sh ]] && echo yes || echo no)"
  fi
  if [[ -L link.txt ]]; then
    printf 'link %s %s\\n' "$(readlink link.txt)" "$(cat link.txt)"
  fi
  if [[ -e crlf.txt ]]; then
    printf 'crlf %s\\n' "$(tr -cd '\\r' < crlf.txt | wc -c | tr -d ' ')"
  fi
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

function makeRepository(t) {
  const root = realpathSync(mkdtempSync(path.join(tmpdir(), 'jedit-hook-entrypoints-')));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const repo = path.join(root, 'repo');
  const bin = path.join(root, 'bin');
  mkdirSync(path.join(repo, 'sub'), { recursive: true });
  mkdirSync(path.join(repo, 'node_modules'));
  mkdirSync(path.join(repo, NATIVE, 'target'), { recursive: true });
  mkdirSync(bin);
  writeFileSync(path.join(bin, 'npm'), STUB, { mode: 0o755 });
  writeFileSync(path.join(bin, 'npx'), STUB, { mode: 0o755 });
  writeFileSync(path.join(repo, '.gitignore'), 'node_modules/\nnative/**/target/\n');
  writeFileSync(path.join(repo, 'package.json'), '{}\n');
  writeFileSync(path.join(repo, 'package-lock.json'), '{}\n');
  writeFileSync(path.join(repo, NATIVE, 'Cargo.toml'), '[package]\n');
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

function run(fixture, cwd, args, stubFail = '', env = {}) {
  const result = spawnSync('git', args, {
    cwd,
    encoding: 'utf8',
    env: cleanGitEnv({
      PATH: `${fixture.bin}${path.delimiter}${process.env.PATH}`,
      HOOK_LOG: fixture.log,
      STUB_FAIL: stubFail,
      ...env,
    }),
  });
  const log = existsSync(fixture.log) ? readFileSync(fixture.log, 'utf8') : '';
  writeFileSync(fixture.log, '');
  return { ...result, log: log.split('\n').filter(Boolean) };
}

function commit(fixture, cwd, ...extra) {
  return run(fixture, cwd, ['commit', '-q', '-m', 'change', ...extra]);
}

function push(fixture, cwd, refspecs, stubFail = '') {
  return run(fixture, cwd, ['push', '-q', 'origin', ...refspecs], stubFail);
}

function lines(result, prefix) {
  return result.log.filter((line) => line.startsWith(prefix));
}

// The commands a hook ran, without the dependency install that precedes the
// checks in every checkout.
function runs(result) {
  return lines(result, 'run ').filter((line) => line !== NPM_CI);
}

function distinct(result, prefix) {
  return [...new Set(lines(result, prefix))];
}

function seen(result) {
  return distinct(result, 'saw ');
}

function onlyDirectory(result) {
  const directories = distinct(result, 'cwd ');
  assert.equal(directories.length, 1, directories.join(', '));
  return directories[0].slice('cwd '.length);
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

function worktreeCount(fixture) {
  return git(fixture.repo, 'worktree', 'list', '--porcelain').split('\n').filter((line) => line.startsWith('worktree ')).length;
}

function assertRemovedCheckout(fixture, result) {
  const checkout = onlyDirectory(result);
  assert.notEqual(checkout, fixture.repo);
  assert.equal(existsSync(checkout), false, 'the temporary checkout is removed');
  assert.equal(worktreeCount(fixture), 1, 'and unregistered');
}

test('pre-commit runs the quality gate then the typecheck in a checkout of the recorded tree', (t) => {
  const fixture = makeRepository(t);
  edit(fixture, 'a.txt', 'a2');
  git(fixture.repo, 'add', 'a.txt');
  const result = commit(fixture, path.join(fixture.repo, 'sub'));
  assert.equal(result.status, 0, result.stderr);
  assert.equal(lines(result, 'run ')[0], NPM_CI, 'dependencies are installed first');
  assert.deepEqual(runs(result), [
    'run npm run --silent quality',
    'run npx --no-install tsc -p tsconfig.json --noEmit',
  ]);
  assertRemovedCheckout(fixture, result);
  assert.deepEqual(lines(result, 'install-cwd '), [`install-cwd ${onlyDirectory(result)}`], 'in the checkout');
  assert.deepEqual(distinct(result, 'tree '), [`tree ${git(fixture.repo, 'rev-parse', 'HEAD^{tree}')}`]);
  assert.deepEqual(distinct(result, 'deps '), ['deps none'], 'the checkout never borrows node_modules');
  assert.deepEqual(lines(result, 'leak '), []);
});

test('pre-commit clears git repository variables in a linked worktree', (t) => {
  const fixture = makeRepository(t);
  const worktree = path.join(fixture.root, 'linked');
  git(fixture.repo, 'worktree', 'add', '-q', worktree);
  writeFileSync(path.join(worktree, 'a.txt'), 'linked\n');
  git(worktree, 'add', 'a.txt');
  const result = commit(fixture, worktree);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(lines(result, 'leak '), []);
  assert.ok(seen(result).includes('saw a.txt linked'));
});

test('pre-commit stops at a failing quality gate without running the typecheck', (t) => {
  const fixture = makeRepository(t);
  edit(fixture, 'a.txt', 'a2');
  git(fixture.repo, 'add', 'a.txt');
  const result = run(fixture, fixture.repo, ['commit', '-q', '-m', 'change'], 'npm run');
  assert.notEqual(result.status, 0);
  assert.deepEqual(runs(result), ['run npm run --silent quality']);
  assertRemovedCheckout(fixture, result);
  assert.equal(commitCount(fixture), '1');
});

test('pre-commit checks the staged copy of a partially staged file', (t) => {
  const fixture = makeRepository(t);
  edit(fixture, 'a.txt', 'staged');
  git(fixture.repo, 'add', 'a.txt');
  edit(fixture, 'a.txt', 'staged then edited');
  const result = commit(fixture, fixture.repo);
  assert.equal(result.status, 0, result.stderr);
  assert.ok(seen(result).includes('saw a.txt staged'));
  assert.equal(git(fixture.repo, 'show', 'HEAD:a.txt'), 'staged');
});

test('pre-commit does not see a file staged for deletion and then recreated', (t) => {
  const fixture = makeRepository(t);
  git(fixture.repo, 'rm', '-q', 'a.txt');
  edit(fixture, 'a.txt', 'recreated');
  const result = commit(fixture, fixture.repo);
  assert.equal(result.status, 0, result.stderr);
  assert.ok(seen(result).includes('saw a.txt absent'));
  assert.equal(git(fixture.repo, 'ls-tree', '--name-only', 'HEAD', 'a.txt'), '');
});

test('pre-commit sees neither unstaged work in other files nor untracked files', (t) => {
  const fixture = makeRepository(t);
  edit(fixture, 'a.txt', 'staged');
  git(fixture.repo, 'add', 'a.txt');
  edit(fixture, 'b.txt', 'unstaged elsewhere');
  edit(fixture, 'untracked.txt', 'untracked');
  const result = commit(fixture, fixture.repo);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(seen(result), ['saw a.txt staged', 'saw b.txt b', 'saw untracked.txt absent']);
  assert.equal(commitCount(fixture), '2');
});

test('pre-commit does not see an intent-to-add file the commit omits', (t) => {
  const fixture = makeRepository(t);
  edit(fixture, 'a.txt', 'staged');
  git(fixture.repo, 'add', 'a.txt');
  edit(fixture, 'untracked.txt', 'intended');
  git(fixture.repo, 'add', '-N', 'untracked.txt');
  const result = commit(fixture, fixture.repo);
  assert.equal(result.status, 0, result.stderr);
  assert.ok(seen(result).includes('saw untracked.txt absent'));
  assert.equal(git(fixture.repo, 'ls-tree', '--name-only', 'HEAD', 'untracked.txt'), '');
});

test('pre-commit sees skip-worktree files the commit records', (t) => {
  const fixture = makeRepository(t);
  git(fixture.repo, 'update-index', '--skip-worktree', 'b.txt');
  unlinkSync(path.join(fixture.repo, 'b.txt'));
  edit(fixture, 'a.txt', 'staged');
  git(fixture.repo, 'add', 'a.txt');
  const result = commit(fixture, fixture.repo);
  assert.equal(result.status, 0, result.stderr);
  assert.ok(seen(result).includes('saw b.txt b'));
  assert.equal(git(fixture.repo, 'show', 'HEAD:b.txt'), 'b');
});

test('pre-commit checks every tracked change under commit -a', (t) => {
  const fixture = makeRepository(t);
  edit(fixture, 'a.txt', 'staged');
  git(fixture.repo, 'add', 'a.txt');
  edit(fixture, 'a.txt', 'staged then edited');
  const result = commit(fixture, fixture.repo, '-a');
  assert.equal(result.status, 0, result.stderr);
  assert.ok(seen(result).includes('saw a.txt staged then edited'));
  assert.equal(git(fixture.repo, 'show', 'HEAD:a.txt'), 'staged then edited');
});

test('pre-commit checks only the selected path of a path-limited commit', (t) => {
  const fixture = makeRepository(t);
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

test('pre-commit checks the working copy of a selected partially staged path', (t) => {
  const fixture = makeRepository(t);
  edit(fixture, 'a.txt', 'staged');
  git(fixture.repo, 'add', 'a.txt');
  edit(fixture, 'a.txt', 'staged then edited');
  const result = commit(fixture, fixture.repo, '--', 'a.txt');
  assert.equal(result.status, 0, result.stderr);
  assert.ok(seen(result).includes('saw a.txt staged then edited'));
  assert.equal(git(fixture.repo, 'show', 'HEAD:a.txt'), 'staged then edited');
});

test('pre-commit checkouts keep staged modes, symlink targets, and attributes', (t) => {
  const fixture = makeRepository(t);
  edit(fixture, 'tool.sh', '#!/bin/sh');
  chmodSync(path.join(fixture.repo, 'tool.sh'), 0o644);
  git(fixture.repo, 'add', 'tool.sh');
  git(fixture.repo, 'update-index', '--chmod=+x', 'tool.sh');
  symlinkSync('a.txt', path.join(fixture.repo, 'link.txt'));
  writeFileSync(path.join(fixture.repo, '.gitattributes'), 'crlf.txt text eol=crlf\n');
  edit(fixture, 'crlf.txt', 'one\ntwo');
  git(fixture.repo, 'add', 'link.txt', '.gitattributes', 'crlf.txt');
  unlinkSync(path.join(fixture.repo, 'link.txt'));
  symlinkSync('b.txt', path.join(fixture.repo, 'link.txt'));
  writeFileSync(path.join(fixture.repo, '.gitattributes'), 'crlf.txt text eol=lf\n');
  const result = commit(fixture, fixture.repo);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(distinct(result, 'exec '), ['exec yes'], 'the staged mode, not the working-tree mode');
  assert.deepEqual(distinct(result, 'link '), ['link a.txt a'], 'the staged symlink target, resolving inside the checkout');
  assert.deepEqual(distinct(result, 'crlf '), ['crlf 2'], 'conversion from the staged .gitattributes');
  assert.ok(seen(result).includes('saw a.txt a'), 'sources are copies, not links into the checkout');
});

test('pre-push runs the suite in a removed checkout of the pushed commit', (t) => {
  const fixture = makeRepository(t);
  const remote = addRemote(fixture);
  const head = git(fixture.repo, 'rev-parse', 'HEAD');
  const result = push(fixture, path.join(fixture.repo, 'sub'), ['main']);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(lines(result, 'run ')[0], NPM_CI, 'dependencies are installed first');
  assert.deepEqual(runs(result), ['run npm run --silent test:all']);
  assertRemovedCheckout(fixture, result);
  assert.deepEqual(lines(result, 'install-cwd '), [`install-cwd ${onlyDirectory(result)}`], 'in the checkout');
  assert.deepEqual(lines(result, 'head '), [`head ${head}`]);
  assert.deepEqual(lines(result, 'deps '), ['deps none'], 'the checkout never borrows node_modules');
  assert.deepEqual(lines(result, 'target '), [`target ${path.join(fixture.repo, NATIVE, 'target')}`]);
  assert.deepEqual(lines(result, 'leak '), []);
  assert.notEqual(remoteRefs(remote), '');
});

test('pre-push blocks the push when the suite fails and still removes the checkout', (t) => {
  const fixture = makeRepository(t);
  const remote = addRemote(fixture);
  const result = push(fixture, fixture.repo, ['main'], 'npm run');
  assert.notEqual(result.status, 0);
  assertRemovedCheckout(fixture, result);
  assert.equal(remoteRefs(remote), '');
});

test('pre-push tests the pushed commit, not a dirty checkout', (t) => {
  const fixture = makeRepository(t);
  addRemote(fixture);
  edit(fixture, 'a.txt', 'staged');
  git(fixture.repo, 'add', 'a.txt');
  edit(fixture, 'b.txt', 'unstaged');
  edit(fixture, 'untracked.txt', 'untracked');
  const result = push(fixture, fixture.repo, ['main']);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(seen(result), ['saw a.txt a', 'saw b.txt b', 'saw untracked.txt absent']);
  assert.equal(git(fixture.repo, 'show', ':a.txt'), 'staged', 'the checkout is untouched');
});

test('pre-push tests a pushed branch that is not checked out', (t) => {
  const fixture = makeRepository(t);
  addRemote(fixture);
  git(fixture.repo, 'switch', '-q', '-c', 'other');
  edit(fixture, 'a.txt', 'other');
  git(fixture.repo, 'commit', '-q', '--no-verify', '-am', 'other');
  const other = git(fixture.repo, 'rev-parse', 'HEAD');
  git(fixture.repo, 'switch', '-q', 'main');
  const result = push(fixture, fixture.repo, ['other']);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(lines(result, 'head '), [`head ${other}`]);
  assert.ok(seen(result).includes('saw a.txt other'));
});

test('pre-push tests the original commit, not a local replacement', (t) => {
  const fixture = makeRepository(t);
  addRemote(fixture);
  const original = git(fixture.repo, 'rev-parse', 'HEAD');
  git(fixture.repo, 'switch', '-q', '-c', 'substitute');
  edit(fixture, 'a.txt', 'replacement');
  git(fixture.repo, 'commit', '-q', '--no-verify', '-am', 'substitute');
  const substitute = git(fixture.repo, 'rev-parse', 'HEAD');
  git(fixture.repo, 'switch', '-q', 'main');
  git(fixture.repo, 'replace', original, substitute);
  const result = push(fixture, fixture.repo, ['main']);
  assert.equal(result.status, 0, result.stderr);
  assert.ok(seen(result).includes('saw a.txt a'), 'the tree the push sends');
  assert.ok(!seen(result).includes('saw a.txt replacement'));
});

test('pre-push tests the commit each pushed ref will point to, once per commit', (t) => {
  const fixture = makeRepository(t);
  addRemote(fixture);
  git(fixture.repo, 'branch', 'same');
  const result = push(fixture, fixture.repo, ['main', 'same']);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(runs(result), ['run npm run --silent test:all']);
});

test('pre-push lets a branch deletion through without running the suite', (t) => {
  const fixture = makeRepository(t);
  const remote = addRemote(fixture);
  git(fixture.repo, 'push', '-q', '--no-verify', 'origin', 'main:gone');
  const result = push(fixture, fixture.repo, [':gone']);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(result.log, []);
  assert.doesNotMatch(remoteRefs(remote), /gone/);
});

test('both hooks check out every path even from a sparse checkout', (t) => {
  const fixture = makeRepository(t);
  addRemote(fixture);
  git(fixture.repo, 'sparse-checkout', 'set', '--no-cone', '/a.txt', '/package*.json', '/.gitignore');
  assert.equal(existsSync(path.join(fixture.repo, 'b.txt')), false, 'b.txt is outside the sparse checkout');
  edit(fixture, 'a.txt', 'staged');
  git(fixture.repo, 'add', 'a.txt');
  const committed = commit(fixture, fixture.repo);
  assert.equal(committed.status, 0, committed.stderr);
  assert.ok(seen(committed).includes('saw b.txt b'));
  const pushed = push(fixture, fixture.repo, ['main']);
  assert.equal(pushed.status, 0, pushed.stderr);
  assert.ok(seen(pushed).includes('saw b.txt b'));
});

test('a failed dependency install blocks the commit before any check', (t) => {
  const fixture = makeRepository(t);
  edit(fixture, 'package.json', '{"dependencies":{"zod":"^4"}}');
  git(fixture.repo, 'add', 'package.json');
  const result = run(fixture, fixture.repo, ['commit', '-q', '-m', 'change'], 'npm ci');
  assert.notEqual(result.status, 0);
  assert.deepEqual(lines(result, 'run '), [NPM_CI], 'npm ci refused, as it does for a manifest its lockfile disagrees with');
  assert.match(result.stderr, /npm ci failed/);
  assert.equal(existsSync(lines(result, 'install-cwd ')[0].slice('install-cwd '.length)), false);
  assert.equal(worktreeCount(fixture), 1);
  assert.equal(commitCount(fixture), '1');
});

test('a relative TMPDIR still leaves no temporary checkout behind', (t) => {
  const fixture = makeRepository(t);
  addRemote(fixture);
  mkdirSync(path.join(fixture.repo, '.tmp'));
  edit(fixture, 'a.txt', 'staged');
  git(fixture.repo, 'add', 'a.txt');
  const committed = run(fixture, fixture.repo, ['commit', '-q', '-m', 'change'], '', { TMPDIR: '.tmp' });
  assert.equal(committed.status, 0, committed.stderr);
  const pushed = run(fixture, fixture.repo, ['push', '-q', 'origin', 'main'], '', { TMPDIR: '.tmp' });
  assert.equal(pushed.status, 0, pushed.stderr);
  assert.equal(worktreeCount(fixture), 1);
  assert.equal(readdirSync(path.join(fixture.repo, '.tmp')).length, 0);
});
