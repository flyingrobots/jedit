import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { REPO_ROOT } from './dist-helpers.mjs';

// These specs run the real hook entrypoints in scripts/hooks/ against a
// scratch repository. Only the expensive tools are stubbed: `npm` and `npx`
// on PATH record how they were invoked, so the specs check what each hook
// runs, from where, and with which of git's repository variables still set.
const HOOKS = path.join(REPO_ROOT, 'scripts', 'hooks');

const STUB = `#!/usr/bin/env bash
{
  printf 'run %s' "$(basename "$0")"
  printf ' %s' "$@"
  printf '\\n'
  printf 'cwd %s\\n' "$PWD"
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

// The test runner may itself run inside a hook; start every child clean.
function cleanEnv(extra = {}) {
  const env = Object.fromEntries(
    Object.entries(process.env).filter(([name]) => !name.startsWith('GIT_')),
  );
  return { ...env, ...extra };
}

function git(cwd, ...args) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8', env: cleanEnv() });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}

function makeRepository() {
  const root = realpathSync(mkdtempSync(path.join(tmpdir(), 'jedit-hook-entrypoints-')));
  const repo = path.join(root, 'repo');
  const bin = path.join(root, 'bin');
  mkdirSync(path.join(repo, 'sub'), { recursive: true });
  mkdirSync(bin);
  writeFileSync(path.join(bin, 'npm'), STUB, { mode: 0o755 });
  writeFileSync(path.join(bin, 'npx'), STUB, { mode: 0o755 });
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
    env: cleanEnv({
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

test('pre-commit runs the quality gate then the typecheck from the repository root', () => {
  const fixture = makeRepository();
  writeFileSync(path.join(fixture.repo, 'a.txt'), 'a2\n');
  git(fixture.repo, 'add', 'a.txt');
  const result = commit(fixture, path.join(fixture.repo, 'sub'));
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(result.log, [
    'run npm run --silent quality',
    `cwd ${fixture.repo}`,
    'run npx --no-install tsc -p tsconfig.json --noEmit',
    `cwd ${fixture.repo}`,
  ]);
});

test('pre-commit clears git repository variables in a linked worktree', () => {
  const fixture = makeRepository();
  const worktree = path.join(fixture.root, 'linked');
  git(fixture.repo, 'worktree', 'add', '-q', worktree);
  writeFileSync(path.join(worktree, 'a.txt'), 'linked\n');
  git(worktree, 'add', 'a.txt');
  const result = commit(fixture, worktree);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(
    result.log.filter((line) => !line.startsWith('run ')),
    [`cwd ${worktree}`, `cwd ${worktree}`],
  );
});

test('pre-commit stops at a failing quality gate without running the typecheck', () => {
  const fixture = makeRepository();
  writeFileSync(path.join(fixture.repo, 'a.txt'), 'a2\n');
  git(fixture.repo, 'add', 'a.txt');
  const result = run(fixture, fixture.repo, ['commit', '-q', '-m', 'change'], 'npm run');
  assert.notEqual(result.status, 0);
  assert.deepEqual(result.log, ['run npm run --silent quality', `cwd ${fixture.repo}`]);
  assert.equal(git(fixture.repo, 'rev-list', '--count', 'HEAD'), '1');
});

test('pre-commit refuses a tracked file with both staged and unstaged changes', () => {
  const fixture = makeRepository();
  writeFileSync(path.join(fixture.repo, 'a.txt'), 'staged\n');
  git(fixture.repo, 'add', 'a.txt');
  writeFileSync(path.join(fixture.repo, 'a.txt'), 'staged then edited\n');
  const result = commit(fixture, fixture.repo);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /a\.txt/);
  assert.deepEqual(result.log, [], 'no check runs against content the commit would not contain');
  assert.equal(git(fixture.repo, 'rev-list', '--count', 'HEAD'), '1');
});

test('pre-commit allows unstaged work in other files and untracked files', () => {
  const fixture = makeRepository();
  writeFileSync(path.join(fixture.repo, 'a.txt'), 'staged\n');
  git(fixture.repo, 'add', 'a.txt');
  writeFileSync(path.join(fixture.repo, 'b.txt'), 'unstaged elsewhere\n');
  writeFileSync(path.join(fixture.repo, 'untracked.txt'), 'untracked\n');
  const result = commit(fixture, fixture.repo);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(git(fixture.repo, 'rev-list', '--count', 'HEAD'), '2');
});

test('pre-commit accepts commit -a, whose index holds every tracked change', () => {
  const fixture = makeRepository();
  writeFileSync(path.join(fixture.repo, 'a.txt'), 'staged\n');
  git(fixture.repo, 'add', 'a.txt');
  writeFileSync(path.join(fixture.repo, 'a.txt'), 'staged then edited\n');
  const result = commit(fixture, fixture.repo, '-a');
  assert.equal(result.status, 0, result.stderr);
  assert.equal(git(fixture.repo, 'show', 'HEAD:a.txt'), 'staged then edited');
});

test('pre-push runs the full suite from the repository root', () => {
  const fixture = makeRepository();
  const remote = path.join(fixture.root, 'remote.git');
  git(fixture.root, 'init', '-q', '--bare', remote);
  git(fixture.repo, 'remote', 'add', 'origin', remote);
  const result = run(fixture, path.join(fixture.repo, 'sub'), ['push', '-q', 'origin', 'main']);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(result.log, ['run npm run --silent test:all', `cwd ${fixture.repo}`]);
});

test('pre-push blocks the push when the suite fails', () => {
  const fixture = makeRepository();
  const remote = path.join(fixture.root, 'remote.git');
  git(fixture.root, 'init', '-q', '--bare', remote);
  git(fixture.repo, 'remote', 'add', 'origin', remote);
  const result = run(fixture, fixture.repo, ['push', '-q', 'origin', 'main'], 'npm run');
  assert.notEqual(result.status, 0);
  const refs = spawnSync('git', ['--git-dir', remote, 'show-ref'], { encoding: 'utf8', env: cleanEnv() });
  assert.equal(refs.stdout.trim(), '');
});
