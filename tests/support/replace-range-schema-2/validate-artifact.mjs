// SPDX-License-Identifier: Apache-2.0 OR LicenseRef-MIND-UCAL-1.0
// © James Ross Ω FLYING•ROBOTS <https://github.com/flyingrobots>
// Independent checks of the schema-2 fixture artifact. This file reads only the
// artifact, the retained oracle and the ContentAddressV1 transcription; it never
// imports the specification model, the row definitions or the builder, so a
// builder bug cannot validate itself. cbor-x decodes atoms as a second codec.
import { createHash } from 'node:crypto';
import { decode as cborDecode } from 'cbor-x';
import { attachmentDigest, contentEdgeId, contentNodeId, OutgoingEdge, slotEdgeId, unhex, hex }
  from './content-address-v1.mts';

export class ArtifactCheckError extends Error {
  constructor(check, message) {
    super(`${check}: ${message}`);
    this.check = check;
  }
}

function fail(check, message) {
  throw new ArtifactCheckError(check, message);
}

const MUTABLE_TYPES = new Set(['Buffer']);
const MAX_LEAF_BYTES = 4096;
const U64_MAX = 0xffff_ffff_ffff_ffffn;

export function checkOracleUnchanged(oracleBytes, artifact, pinnedSha256) {
  const actual = createHash('sha256').update(oracleBytes).digest('hex');
  if (actual !== pinnedSha256) fail('oracle-unchanged', `retained oracle sha256 ${actual} != ${pinnedSha256}`);
  if (artifact.retainedOracle.sha256 !== pinnedSha256) fail('oracle-unchanged', 'artifact pins another oracle');
}

export function checkRegister(artifact, oracle, mappingTable) {
  const retained = oracle.cases.map((entry) => entry.id);
  const rows = artifact.rows.map((row) => row.id);
  if (rows.join('\n') !== retained.join('\n')) fail('register', 'rows are not the retained ids in oracle order');
  if (new Set(rows).size !== rows.length) fail('register', 'a retained id appears twice');
  for (const row of artifact.rows) {
    if (mappingTable.get(row.id) !== row.mapping) fail('register', `${row.id} mapping ${row.mapping}`);
    if (row.status !== 'unexecuted') fail('register', `${row.id} claims status ${row.status}`);
    if (row.target !== 'persistent-rope') fail('register', `${row.id} targets ${row.target}`);
    if (row.mapping === 'counterpart' && !(typeof row.decision === 'string' && row.decision.length > 0)) {
      fail('register', `${row.id} counterpart has no decision`);
    }
  }
  const invocations = new Map(oracle.cases.map((entry) => [entry.id, entry.invocation]));
  for (const row of artifact.rows) {
    const retained = invocations.get(row.id);
    const ours = row.invocation;
    if (String(retained.startByte) !== ours.startByte || String(retained.endByte) !== ours.endByte
      || retained.replacementUtf8Hex !== ours.replacementHex) fail('register', `${row.id} changes the retained invocation`);
  }
  const counts = { carry: 0, counterpart: 0 };
  for (const row of artifact.rows) counts[row.mapping] += 1;
  if (counts.carry !== 28 || counts.counterpart !== 12) fail('register', `counts ${JSON.stringify(counts)}`);
  for (const addition of artifact.additions) {
    if (rows.includes(addition.id) || addition.mapping !== 'addition') fail('register', `${addition.id} replaces a row`);
  }
}

export function checkOutcomeBindings(artifact, oracle) {
  const { checkOrder, outcomes } = artifact.profile;
  const retained = new Map(oracle.cases.map((entry) => [entry.id, entry.terminal]));
  for (const row of [...artifact.rows, ...artifact.additions]) {
    const terminal = retained.get(row.id);
    const expected = row.expected;
    if (terminal !== undefined && (terminal.posture === 'obstructed') !== (expected.posture === 'obstructed')) {
      fail('outcome-binding', `${row.id} changes the retained posture`);
    }
    if (expected.posture !== 'obstructed') continue;
    if (terminal !== undefined && row.retainedSemanticCode !== terminal.semanticCode) {
      fail('outcome-binding', `${row.id} semanticCode ${row.retainedSemanticCode} != ${terminal.semanticCode}`);
    }
    if (!outcomes.includes(expected.typedOutcome)) fail('outcome-binding', `${row.id} outcome ${expected.typedOutcome}`);
    const rank = checkOrder.indexOf(expected.decidingCheck);
    if (rank < 0) fail('outcome-binding', `${row.id} names no rejecting boundary`);
    if (expected.precedence.passed.join() !== checkOrder.slice(0, rank).join()) {
      fail('outcome-binding', `${row.id} precedence does not end at ${expected.decidingCheck}`);
    }
    for (const later of expected.precedence.competing) {
      if (checkOrder.indexOf(later) <= rank) fail('outcome-binding', `${row.id} competing ${later} is not later`);
    }
    if (expected.effects.length !== 0 || expected.patch !== 'none' || expected.parentGraphUnchanged !== true) {
      fail('outcome-binding', `${row.id} obstruction mutates`);
    }
  }
}

function edgesFrom(edges, id) {
  return edges.filter((edge) => edge.from === id);
}

function typeIds(profile) {
  const pick = (table) => new Map(Object.entries(table).map(([name, entry]) => [name, unhex(entry.id)]));
  return { nodes: pick(profile.nodeTypes), atoms: pick(profile.atomTypes), edges: pick(profile.edgeTypes),
    warp: unhex(profile.warp.id) };
}

/** Every content node id is its ContentAddressV1 address, unless the row marks it injected and witnesses it. */
export function checkIdentities(artifact) {
  const ids = typeIds(artifact.profile);
  for (const row of [...artifact.rows, ...artifact.additions]) {
    const { nodes, edges } = row.basis;
    const witnessed = new Set(row.admissionWitnesses.map((witness) => witness.effect.node));
    for (const node of nodes) {
      const address = addressOf(ids, node, edgesFrom(edges, node.id));
      const injected = node.admission === 'requires-non-bridge-writer';
      if (MUTABLE_TYPES.has(node.type)) continue;
      if (!injected && address !== node.id) fail('identity', `${row.id} ${node.type} ${node.id} is not its address`);
      if (injected && (address === node.id || !witnessed.has(node.id))) fail('identity', `${row.id} unwitnessed ${node.id}`);
    }
    for (const edge of edges) checkEdgeId(ids, row, nodes, edge);
    if (row.expected.posture !== 'committed') continue;
    for (const node of row.expected.createdNodes) {
      if (addressOf(ids, node, node.edges.map((edge) => ({ ...edge, from: node.id }))) !== node.id) {
        fail('identity', `${row.id} created ${node.id} is not its address`);
      }
    }
  }
}

function addressOf(ids, node, edges) {
  return hex(contentNodeId(ids.warp, ids.nodes.get(node.type), ids.atoms.get(node.type), unhex(node.atomHex),
    edges.map((edge) => new OutgoingEdge(ids.edges.get(edge.type), unhex(edge.to)))));
}

function checkEdgeId(ids, row, nodes, edge) {
  const source = nodes.find((node) => node.id === edge.from);
  const type = ids.edges.get(edge.type);
  const expected = MUTABLE_TYPES.has(source.type)
    ? slotEdgeId(ids.warp, unhex(edge.from), type)
    : contentEdgeId(ids.warp, unhex(edge.from), type, unhex(edge.to));
  if (hex(expected) !== edge.id) fail('identity', `${row.id} edge ${edge.id} is not its address`);
}

/** cbor-x decodes every decodable atom to exactly the declared fact. */
export function checkAtoms(artifact) {
  for (const row of [...artifact.rows, ...artifact.additions]) {
    const created = row.expected.posture === 'committed' ? row.expected.createdNodes : [];
    for (const node of [...row.basis.nodes, ...created]) {
      if ('undecodable' in node.fact) continue;
      const decoded = cborDecode(Buffer.from(node.atomHex, 'hex'));
      const fields = Object.keys(decoded).sort();
      if (fields.join() !== Object.keys(node.fact).sort().join()) fail('atoms', `${row.id} ${node.id} fields differ`);
      for (const field of fields) {
        const value = decoded[field];
        const rendered = value instanceof Uint8Array ? hex(value) : String(value);
        if (rendered !== node.fact[field]) fail('atoms', `${row.id} ${node.id}.${field} = ${rendered}`);
      }
    }
  }
}

export { checkCommitted } from './validate-committed.mjs';
export { attachmentDigest, MAX_LEAF_BYTES, U64_MAX };
