import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(SCRIPT_PATH), '..');
const SCHEMA_PATH = path.join(REPO_ROOT, 'contracts', 'jedit', 'hot-text-runtime.graphql');
const OUT_PATH = path.join(REPO_ROOT, 'src', 'generated', 'jedit', 'hot-text-runtime.wesley.generated.ts');
const SIBLING_WESLEY_MANIFEST = path.resolve(REPO_ROOT, '..', 'wesley', 'crates', 'wesley-cli', 'Cargo.toml');
const WESLEY_ARGS = ['emit', 'typescript', '--schema', SCHEMA_PATH, '--out', OUT_PATH];

if (process.env.WESLEY_BIN != null && process.env.WESLEY_BIN.length > 0) {
  run(process.env.WESLEY_BIN, WESLEY_ARGS);
}

if (existsSync(SIBLING_WESLEY_MANIFEST)) {
  run('cargo', [
    'run',
    '--quiet',
    '--manifest-path',
    SIBLING_WESLEY_MANIFEST,
    '--',
    ...WESLEY_ARGS,
  ]);
}

console.error([
  'Unable to locate Wesley TypeScript emitter.',
  'Set WESLEY_BIN to a Wesley CLI executable, or check out Wesley at ../wesley.',
].join('\n'));
process.exit(1);

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: REPO_ROOT,
    stdio: 'inherit',
  });

  if (result.error != null) {
    console.error(`Failed to run ${command}: ${result.error.message}`);
    process.exit(1);
  }

  process.exit(result.status ?? 1);
}
