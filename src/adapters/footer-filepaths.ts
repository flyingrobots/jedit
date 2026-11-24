import { execFileSync } from 'node:child_process';
const GIT_ROOT_TIMEOUT_MS = 1000;
const GIT_ROOT_MAX_BYTES = 65536;
export function discoverGitRoot(cwd: string): string | undefined {
  try {
    return execFileSync('git', ['rev-parse', '--show-toplevel'], {
      cwd, encoding: 'utf8', timeout: GIT_ROOT_TIMEOUT_MS, maxBuffer: GIT_ROOT_MAX_BYTES,
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trimEnd() || undefined;
  } catch { return undefined; }
}
