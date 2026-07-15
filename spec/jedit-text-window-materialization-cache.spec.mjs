import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';
import { REPO_ROOT, ensureDistBuilt } from './dist-helpers.mjs';

const CACHE_MODULE_PATH = path.join(REPO_ROOT, 'dist', 'app', 'jedit-text-window-materialization-cache.js');
const COORDINATE_MODULE_PATH = path.join(REPO_ROOT, 'dist', 'domain', 'graph-rope-coordinates.js');
const GRAPH_RUNTIME_MODULE_PATH = path.join(REPO_ROOT, 'dist', 'domain', 'graph-rope-runtime.js');
const HASH_MODULE_PATH = path.join(REPO_ROOT, 'dist', 'adapters', 'hash.js');

let modulesPromise;

test('materialization keys name basis, coverage, versions, observer, and policy', async () => {
  const modules = await loadModules();
  const projection = sampleProjection();
  const key = materializationKey(modules, projection);
  const entry = modules.cache.createJeditTextWindowMaterialization(key, projection);

  assert.deepEqual(key.basis, {
    worldlineId: projection.basis.worldlineId,
    headId: projection.basis.headId,
    requestFrontierRef: 'frontier:materialization:1',
  });
  assert.equal(key.coverage.startByte.kind, 'utf8-byte-offset');
  assert.equal(key.coverage.endByte.value, 6);
  assert.equal(key.schemaVersion, 1);
  assert.equal(key.materializerVersion, 'jedit.text-window.materializer.v1');
  assert.equal(key.observerPlanId, 'observer-plan:textWindow:test');
  assert.match(key.policyDigest, /^[a-f0-9]{64}$/);
  assert.match(key.coordinateDigest, /^[a-f0-9]{64}$/);
  assert.match(key.cacheKeyDigest, /^[a-f0-9]{64}$/);
  assert.equal(entry.completeness, 'complete');
  assert.equal(entry.materializedProjectionBytes, 6);
});

test('materialization provenance snapshots caller-owned cache coordinates', async () => {
  const modules = await loadModules();
  const projection = sampleProjection();
  const coverage = {
    startByte: { kind: 'utf8-byte-offset', value: 0 },
    endByte: { kind: 'utf8-byte-offset', value: 6 },
  };
  const key = modules.cache.createJeditTextWindowMaterializationKey({
    worldlineId: projection.basis.worldlineId,
    headId: projection.basis.headId,
    requestFrontierRef: 'request:materialization:snapshot',
    coverage,
    observerPlanId: 'observer-plan:textWindow:test',
  }, modules.hash);
  const entry = modules.cache.createJeditTextWindowMaterialization(key, projection);

  coverage.endByte.value = 99;
  assert.equal(key.coverage.endByte.value, 6);
  assert.equal(entry.key.coverage.endByte.value, 6);
  assert.equal(Object.isFrozen(entry.key.coverage.endByte), true);
});

test('materialization cache refuses and evicts stale provenance', async () => {
  const modules = await loadModules();
  const projection = sampleProjection();
  const key = materializationKey(modules, projection);
  const staleKey = {
    ...key,
    materializerVersion: 'jedit.text-window.materializer.v0',
  };
  const cache = modules.cache.createDisposableJeditTextWindowMaterializationCache();

  cache.retain(modules.cache.createJeditTextWindowMaterialization(staleKey, projection));
  const lookup = cache.lookup(key);

  assert.equal(lookup.status, modules.cache.JEDIT_MATERIALIZATION_CACHE_STALE);
  assert.equal(lookup.code, modules.cache.JEDIT_MATERIALIZATION_CACHE_KEY_MISMATCH);
  assert.deepEqual(cache.metrics(), {
    entryCount: 0,
    materializedProjectionBytes: 0,
  });
});

test('materialization cache measures projection bytes outside graph authority', async () => {
  const modules = await loadModules();
  const graph = modules.graph.createGraphRopeRuntime({ hash: modules.hash });
  const created = graph.createBufferWorldline({
    worldlineId: 'wl:materialization-authority',
    initialText: 'causal',
  });
  assert.equal(created.ok, true);
  const headId = created.value.head.headId;
  const before = graph.debugRopeShape(headId);
  assert.equal(before.ok, true);
  const projection = sampleProjection({
    basisHeadId: headId,
    basis: {
      worldlineId: created.value.head.worldlineId,
      headId,
      rootNodeId: created.value.head.rootNodeId,
      byteLength: created.value.head.byteLength,
      lineCount: created.value.head.lineCount,
    },
  });
  const cache = modules.cache.createDisposableJeditTextWindowMaterializationCache();
  cache.retain(modules.cache.createJeditTextWindowMaterialization(
    materializationKey(modules, projection),
    projection,
  ));

  assert.deepEqual(cache.metrics(), {
    entryCount: 1,
    materializedProjectionBytes: 6,
  });
  assert.equal('retainedAuthoritativeBytes' in cache.metrics(), false);

  cache.clear();
  assert.deepEqual(graph.debugRopeShape(headId), before);
});

async function loadModules() {
  await ensureDistBuilt();
  modulesPromise ??= Promise.all([
    import(pathToFileURL(CACHE_MODULE_PATH).href),
    import(pathToFileURL(COORDINATE_MODULE_PATH).href),
    import(pathToFileURL(GRAPH_RUNTIME_MODULE_PATH).href),
    import(pathToFileURL(HASH_MODULE_PATH).href),
  ]).then(([cache, coordinates, graph, hashAdapter]) => ({
    cache,
    coordinates,
    graph,
    hash: hashAdapter.createHashPort(),
  }));
  return modulesPromise;
}

function materializationKey(modules, projection) {
  return modules.cache.createJeditTextWindowMaterializationKey({
    worldlineId: projection.basis.worldlineId,
    headId: projection.basis.headId,
    requestFrontierRef: 'frontier:materialization:1',
    coverage: requiredRange(modules, projection.byteRange),
    observerPlanId: 'observer-plan:textWindow:test',
  }, modules.hash);
}

function requiredRange(modules, range) {
  const start = modules.coordinates.makeByteOffset(range.startByte);
  const end = modules.coordinates.makeByteOffset(range.endByte);
  assert.equal(start.ok, true);
  assert.equal(end.ok, true);
  const branded = modules.coordinates.makeTextByteRange(start.value, end.value);
  assert.equal(branded.ok, true);
  return branded.value;
}

function sampleProjection(overrides = {}) {
  return {
    basisHeadId: 'head:materialization',
    basis: {
      worldlineId: 'wl:materialization',
      headId: 'head:materialization',
      rootNodeId: 'node:materialization',
      byteLength: 6,
      lineCount: 1,
    },
    byteRange: { startByte: 0, endByte: 6 },
    text: 'causal',
    support: [],
    ...overrides,
  };
}
