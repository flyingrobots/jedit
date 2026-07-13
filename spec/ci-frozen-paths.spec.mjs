import assert from 'node:assert/strict';
import test from 'node:test';
import {
  TITLE_UNFREEZE_LABEL,
  evaluateFrozenPaths,
} from '../scripts/ci/frozen-paths.mjs';

test('title-scene paths are frozen without the unfreeze label', () => {
  const verdict = evaluateFrozenPaths(
    ['src/ui/title-screen.ts', 'src/app/workspace/model.ts'],
    { allowTitleChanges: false },
  );

  assert.equal(verdict.allowed, false);
  assert.deepEqual(verdict.frozenPaths, ['src/ui/title-screen.ts']);
  assert.match(verdict.reason, /title-unfreeze/);
});

test('every title path root is covered by the freeze', () => {
  const frozenExamples = [
    'src/ui/title-scene-ray-acceleration.ts',
    'src/ui/bunny.obj',
    'src/app/title-camera-fps.ts',
    'src/app/workspace/title-scene-performance-governor.ts',
    'src/adapters/title-scene-loader.ts',
    'src/adapters/raytracer-profiler.ts',
    'scripts/title-scene-preview.mjs',
  ];

  const verdict = evaluateFrozenPaths(frozenExamples, { allowTitleChanges: false });

  assert.equal(verdict.allowed, false);
  assert.deepEqual(verdict.frozenPaths, [...frozenExamples].sort());
});

test('the unfreeze label allows title-scene changes through', () => {
  const verdict = evaluateFrozenPaths(
    ['src/ui/title-screen.ts'],
    { allowTitleChanges: true },
  );

  assert.equal(verdict.allowed, true);
  assert.deepEqual(verdict.frozenPaths, ['src/ui/title-screen.ts']);
});

test('non-title changes are never frozen', () => {
  const verdict = evaluateFrozenPaths(
    ['src/domain/text-edit-contract.ts', 'docs/BEARING.md', 'src/ui/theme-builder.ts'],
    { allowTitleChanges: false },
  );

  assert.equal(verdict.allowed, true);
  assert.deepEqual(verdict.frozenPaths, []);
});

test('the unfreeze label name is the documented one', () => {
  assert.equal(TITLE_UNFREEZE_LABEL, 'title-unfreeze');
});
