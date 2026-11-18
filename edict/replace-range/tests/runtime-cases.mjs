// Turns each schema-2 fixture row into a runtime case for the 40-row runner:
// the basis graph with resolved schema-2 type ids, the exact invocation input
// of the authored intent, and the row it must satisfy. A Rust consumer
// installs the graph, invokes the locked package and returns an observation
// that tests/support/replace-range-schema-2/judge.mjs judges under the #296
// read-set ruling. Nothing here executes the operation.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const FIXTURES = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'contracts', 'jedit',
  'acceptance', 'replace-range-schema-2', 'replace-range-schema-2.fixtures.json');

// A node that ordinary bridge admission refuses is installed straight into
// the store as a declared negative-admission witness, never through the bridge.
const INSTALL = Object.freeze({ 'bridge-admissible': 'bridge', 'requires-non-bridge-writer': 'raw-store-witness' });

function graph(profile, basis) {
  const nodeType = (kind) => profile.nodeTypes[kind].id;
  const atomType = (kind) => profile.atomTypes[kind].id;
  return {
    warpId: profile.warp.id,
    buffers: basis.buffers,
    nodes: basis.nodes.map((node) => ({
      id: node.id, nodeType: nodeType(node.type), atomType: atomType(node.type), atomHex: node.atomHex,
      install: INSTALL[node.admission],
    })),
    edges: basis.edges.map((edge) => ({
      id: edge.id, from: edge.from, to: edge.to, edgeType: profile.edgeTypes[edge.type].id,
    })),
  };
}

function runtimeCase(profile, row, retained) {
  const basis = graph(profile, row.basis);
  return {
    id: row.id, retained, graph: basis,
    input: { warpId: basis.warpId, ...row.invocation },
    row,
  };
}

/** Every retained row, then every schema-2 addition, as a runtime case. */
export function runtimeCases(fixtures = FIXTURES) {
  const artifact = JSON.parse(readFileSync(fixtures, 'utf8'));
  return [
    ...artifact.rows.map((row) => runtimeCase(artifact.profile, row, true)),
    ...artifact.additions.map((row) => runtimeCase(artifact.profile, row, false)),
  ];
}
