import assert from 'node:assert/strict';
import test from 'node:test';
import { runtimeCases } from './runtime-cases.mjs';

const cases = runtimeCases();

test('every retained row and addition becomes exactly one runtime case', () => {
  const ids = cases.map((entry) => entry.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(cases.filter((entry) => entry.retained).length, 40);
});

test('every basis node and edge resolves to its schema-2 type ids', () => {
  for (const entry of cases) {
    for (const node of entry.graph.nodes) {
      assert.match(node.nodeType, /^[0-9a-f]{64}$/, entry.id);
      assert.match(node.atomType, /^[0-9a-f]{64}$/, entry.id);
    }
    for (const edge of entry.graph.edges) assert.match(edge.edgeType, /^[0-9a-f]{64}$/, entry.id);
  }
});

test('every invocation names the case warp and keeps its exact coordinates and bytes', () => {
  for (const entry of cases) {
    assert.equal(entry.input.warpId, entry.graph.warpId);
    assert.equal(typeof entry.input.startByte, 'string');
    assert.match(entry.input.replacementHex, /^([0-9a-f]{2})*$/);
  }
});

test('a node that normal admission would refuse is installed only as a declared witness', () => {
  for (const entry of cases) {
    for (const node of entry.graph.nodes.filter((item) => item.install !== 'bridge')) {
      assert.equal(node.install, 'raw-store-witness', `${entry.id} ${node.id}`);
    }
  }
});
