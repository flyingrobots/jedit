import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const REPO_ROOT = process.cwd();
const RETIRED_WESLEY_SURFACES = [
  'scripts/run-wesley-tool.mjs',
  'src/generated/jedit/rope.types.generated.ts',
  'src/generated/jedit/rope.zod.generated.ts',
  'src/generated/jedit/worldlineSnapshot.observer-plan.generated.ts',
];
const LEGACY_IMPORT_PATTERN = /rope\.(?:types|zod)\.generated/;

test('retired Wesley Node-host contract surfaces are deleted', () => {
  for (const relativePath of RETIRED_WESLEY_SURFACES) {
    assert.equal(existsSync(path.join(REPO_ROOT, relativePath)), false, `${relativePath} must not exist`);
  }
});

test('production source cannot import legacy Wesley contract projections', () => {
  for (const sourcePath of sourceFiles(path.join(REPO_ROOT, 'src'))) {
    const source = readFileSync(sourcePath, 'utf8');
    assert.doesNotMatch(source, LEGACY_IMPORT_PATTERN, path.relative(REPO_ROOT, sourcePath));
  }
});

test('package scripts cannot restore retired Wesley Node-host generation', () => {
  const packageJson = JSON.parse(readFileSync(path.join(REPO_ROOT, 'package.json'), 'utf8'));

  assert.equal(packageJson.scripts['gen:contract:legacy'], undefined);
  assert.equal(packageJson.scripts['gen:observer'], undefined);
  assert.doesNotMatch(packageJson.scripts['gen:contract'] ?? '', /legacy/);
  assert.doesNotMatch(Object.values(packageJson.scripts).join('\n'), /host-node/);
});

function sourceFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      return sourceFiles(entryPath);
    }
    return entry.isFile() && entry.name.endsWith('.ts') ? [entryPath] : [];
  });
}
