import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  TEST_SHARDS,
  TEST_SHARD_NAMES,
  discoverSpecFiles,
  specsByShard,
  testShardForSpec,
} from '../scripts/ci/test-shards.mjs';
import { impactForPath, planChangedShards } from '../scripts/ci/changed-shards.mjs';

const TYPESCRIPT_BUILD_SNIPPET = 'node_modules/typescript/bin/' + 'tsc';

test('test shard manifest assigns every spec to one non-empty shard', () => {
  const specs = discoverSpecFiles();
  const grouped = specsByShard();
  const assigned = TEST_SHARD_NAMES.reduce((total, shardName) => {
    const shardSpecs = grouped.get(shardName) ?? [];
    assert.ok(shardSpecs.length > 0, `${shardName} should own at least one spec`);
    return total + shardSpecs.length;
  }, 0);

  assert.equal(assigned, specs.length);
  assert.ok(specs.length > 0);
});

test('known specs map to stable shard owners', () => {
  assert.equal(testShardForSpec('spec/title-screen.spec.mjs'), TEST_SHARDS.TitleRendering);
  assert.equal(testShardForSpec('spec/workspace-footer.spec.mjs'), TEST_SHARDS.WorkspaceUi);
  assert.equal(testShardForSpec('spec/jedit-wsc-workspace-store.spec.mjs'), TEST_SHARDS.EchoAuthority);
  assert.equal(testShardForSpec('tests/replace-range-cycle.spec.mjs'), TEST_SHARDS.Contracts);
  assert.equal(testShardForSpec('spec/release-quickstart.spec.mjs'), TEST_SHARDS.DocsRelease);
});

test('planner keeps docs-only changes narrow', () => {
  const plan = planChangedShards(['docs/BEARING.md']);

  assert.equal(plan.full, false);
  assert.equal(plan.releaseGate, false);
  assert.deepEqual(plan.testShards, [TEST_SHARDS.DocsRelease]);
});

test('planner routes workspace changes through workspace and Echo authority shards', () => {
  const plan = planChangedShards(['src/app/workspace/runtime.ts']);

  assert.equal(plan.full, false);
  assert.equal(plan.releaseGate, false);
  assert.deepEqual(plan.testShards, [TEST_SHARDS.EchoAuthority, TEST_SHARDS.WorkspaceUi]);
});

test('planner routes Echo authority changes through release gate', () => {
  const plan = planChangedShards(['src/adapters/jedit-echo-runtime.ts']);

  assert.equal(plan.full, false);
  assert.equal(plan.releaseGate, true);
  assert.deepEqual(plan.testShards, [TEST_SHARDS.EchoAuthority, TEST_SHARDS.WorkspaceUi]);
});

test('planner forces full CI for planner and unknown paths', () => {
  assert.equal(impactForPath('scripts/ci/test-shards.mjs').full, true);
  assert.equal(impactForPath('assets/unknown.bin').full, true);
});

test('planner routes changed specs to their owning shard', () => {
  const plan = planChangedShards(['spec/title-scene.spec.mjs']);

  assert.equal(plan.full, false);
  assert.deepEqual(plan.testShards, [TEST_SHARDS.TitleRendering]);
});

test('spec files use the dist helper instead of per-spec TypeScript builds', () => {
  const offenders = discoverSpecFiles()
    .filter((specPath) => specPath.startsWith('spec/'))
    .filter((specPath) => readFileSync(specPath, 'utf8').includes(TYPESCRIPT_BUILD_SNIPPET));

  assert.deepEqual(offenders, []);
});
