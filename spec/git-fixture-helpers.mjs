import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

// Fixture git processes must act on the scratch repository named by `cwd`
// and nothing else. The test runner may itself run inside a hook, where git
// exports repository variables such as GIT_DIR that would redirect a fixture
// command to the real checkout, and the developer's global or system git
// configuration (signing, a global hooksPath) must not change fixture setup.
export function cleanGitEnv(extra = {}) {
  const env = Object.fromEntries(
    Object.entries(process.env).filter(([name]) => !name.startsWith('GIT_')),
  );
  return { ...env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1', ...extra };
}

export function git(cwd, ...args) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8', env: cleanGitEnv() });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}
