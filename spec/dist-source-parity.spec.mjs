import assert from 'node:assert/strict';
import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { REPO_ROOT, ensureDistBuilt } from './dist-helpers.mjs';

const CHECKED_LAYERS = [
  'adapters',
  'app',
  'domain',
  'generated',
  'ports',
  'transport',
  'ui',
];

export function sourcePathForDistArtifact(distRelativePath) {
  if (!distRelativePath.endsWith('.js')) {
    return undefined;
  }
  const withoutExtension = distRelativePath.slice(0, -'.js'.length);
  const [layer] = withoutExtension.split('/');
  const rootLevel = !withoutExtension.includes('/');
  if (!rootLevel && !CHECKED_LAYERS.includes(layer)) {
    return undefined;
  }
  return `src/${withoutExtension}.ts`;
}

function distArtifacts(directory, prefix = '') {
  const entries = readdirSync(directory, { withFileTypes: true });
  const artifacts = [];
  for (const entry of entries) {
    const relative = prefix === '' ? entry.name : `${prefix}/${entry.name}`;
    if (entry.isDirectory()) {
      artifacts.push(...distArtifacts(path.join(directory, entry.name), relative));
    } else {
      artifacts.push(relative);
    }
  }
  return artifacts;
}

test('the parity mapping flags stale compiled modules for deleted sources', () => {
  assert.equal(
    sourcePathForDistArtifact('adapters/in-memory-hot-text-runtime.js'),
    'src/adapters/in-memory-hot-text-runtime.ts',
  );
  assert.equal(sourcePathForDistArtifact('main.js'), 'src/main.ts');
  assert.equal(sourcePathForDistArtifact('ui/bunny.obj'), undefined);
  assert.equal(sourcePathForDistArtifact('scenes/default.json'), undefined);
  assert.equal(sourcePathForDistArtifact('generated/i18n.js'), 'src/generated/i18n.ts');
});

test('every compiled dist module has a living source twin', async () => {
  await ensureDistBuilt();
  const distRoot = path.join(REPO_ROOT, 'dist');

  const stale = distArtifacts(distRoot)
    .map((artifact) => ({ artifact, source: sourcePathForDistArtifact(artifact) }))
    .filter(({ source }) => source !== undefined)
    .filter(({ source }) => !existsSync(path.join(REPO_ROOT, source)))
    .map(({ artifact, source }) => `dist/${artifact} has no ${source}`);

  assert.deepEqual(stale, [], `stale dist artifacts mask deleted sources:\n${stale.join('\n')}`);
});
