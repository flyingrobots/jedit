// SPDX-License-Identifier: Apache-2.0 OR LicenseRef-MIND-UCAL-1.0
// © James Ross Ω FLYING•ROBOTS <https://github.com/flyingrobots>
// Independent checks of the schema-2 fixture artifact. This file reads only the
// artifact, the retained oracle and the ContentAddressV1 transcription; it never
// imports the specification model, the row definitions or the builder, so a
// builder bug cannot validate itself. cbor-x decodes atoms as a second codec.
// Outcomes, deciding checks, required rows and moves come from validator-oracle.mjs,
// written by hand. Two things are only change-detected by the regeneration test,
// not derived here: read sets (the specification model's reads; only their shape is
// checked) and multi-leaf tree topology (rope-build.mts is the normative reference;
// this file checks that a result is a lawful rope with the right text, leaf sizes and
// sharing, not that it is the profile's shape). Whether a basis triggers exactly its
// deciding check is also left to the builder's consistency check.
import { createHash } from 'node:crypto';
import { decode as cborDecode } from 'cbor-x';
import { blake3 } from './blake3.mts';
import { decodesAsRecord, headIsLawful } from './validate-basis.mjs';
import { CHECK_ORDER, COMPETING, EVIDENCE, EXPECTED_OBSTRUCTIONS, MOVED, OUTCOMES, REQUIRED_ADDITIONS }
  from './validator-oracle.mjs';
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
  const additionIds = artifact.additions.map((addition) => addition.id);
  if (new Set(additionIds).size !== additionIds.length) fail('register', 'an addition id appears twice');
  if (artifact.retainedOracle.caseCount !== retained.length || artifact.register.carry !== 28
    || artifact.register.counterpart !== 12) fail('register', 'the declared counts are not the register');
  artifact.rows.forEach((row, index) => {
    if (row.retainedCaseIndex !== index) fail('register', `${row.id} names retained case ${row.retainedCaseIndex}`);
  });
  for (const addition of artifact.additions) {
    if (rows.includes(addition.id) || addition.mapping !== 'addition') fail('register', `${addition.id} replaces a row`);
    if (addition.status !== 'unexecuted' || addition.target !== 'persistent-rope') {
      fail('register', `${addition.id} claims ${addition.status} for ${addition.target}`);
    }
  }
}

// Oracle: the schema-1 semanticCode each schema-2 outcome continues; a row that departs must say why.
const RETAINED_OUTCOME = new Map([['range-order-invalid', 'RangeOrderInvalid'],
  ['range-out-of-bounds', 'RangeOutOfBounds'], ['utf8-boundary-invalid', 'Utf8BoundaryInvalid'], ['no-op', 'NoOp'],
  ['basis-not-canonical', 'BasisNotCanonical'], ['arithmetic-overflow', 'ArithmeticOverflow'],
  ['fact-missing', 'FactMissing'], ['fact-malformed', 'FactMalformed'],
  ['content-identity-mismatch', 'ContentIdentityMismatch'], ['malformed-rope', 'MalformedRope']]);

/** A read set is non-empty and names only basis nodes or the invocation's own (possibly absent) ids. */
export function checkReadSet(row, readSet) {
  const known = new Set([...row.basis.nodes.map((node) => node.id), row.invocation.bufferId, row.invocation.basisHeadId]);
  if (readSet.nodes.length === 0 || readSet.nodes.some((id) => !known.has(id))) {
    fail('outcome-binding', `${row.id} read set names no read or an unknown node`);
  }
}

/** A counter at U64::MAX, or a new head whose claimed extent or line count must pass U64::MAX. */
function countersOverflow(row, head) {
  const max = 0xffff_ffff_ffff_ffffn;
  const buffer = row.basis.nodes.find((node) => node.id === row.invocation.bufferId);
  const replacement = unhex(row.invocation.replacementHex);
  const removed = BigInt(row.invocation.endByte) - BigInt(row.invocation.startByte);
  const newlines = BigInt(replacement.filter((byte) => byte === 0x0a).length);
  return BigInt(head.fact.sequence) === max || BigInt(buffer.fact.version) === max
    || BigInt(head.fact.byteLength) - removed + BigInt(replacement.length) > max
    || (removed === 0n && BigInt(head.fact.lineCount) + newlines > max);
}

/** Rows decided at closure validation store an unlawful rope; rows decided elsewhere (except counters, whose
 * fault may sit in a sibling the edit never validates) store a lawful one. */
function checkBasisFault(row, check) {
  const head = row.basis.nodes.find((node) => node.id === row.invocation.basisHeadId);
  if (head === undefined) return;
  const lawful = headIsLawful(row, head.id);
  if (check === 'closure-validation' ? lawful : (check !== 'counters' && !lawful)) {
    fail('outcome-binding', `${row.id} basis does not show a ${check} fault`);
  }
  if (check === 'counters' && !countersOverflow(row, head)) fail('outcome-binding', `${row.id} no counter can overflow`);
  const [start, end] = [BigInt(row.invocation.startByte), BigInt(row.invocation.endByte)];
  if (check === 'range-order' && !(start > end)) fail('outcome-binding', `${row.id} range is in order`);
  if (check === 'range-bounds' && !(end > BigInt(head.fact.byteLength))) fail('outcome-binding', `${row.id} range is in bounds`);
}

/** The invocation names the basis it claims: the canonical head, or for BasisNotCanonical a different stored head. */
function checkInvocationIds(row, outcome) {
  const target = row.basis.buffers.find((buffer) => buffer.bufferId === row.invocation.bufferId);
  if (target === undefined) {
    if (outcome !== 'FactMissing') fail('outcome-binding', `${row.id} invokes a buffer the basis lacks`);
    return;
  }
  const stored = row.basis.nodes.some((node) => node.id === row.invocation.basisHeadId && node.type === 'Head');
  const canonical = target.canonicalHead === row.invocation.basisHeadId;
  if (outcome === 'BasisNotCanonical' ? (canonical || !stored) : !canonical) {
    fail('outcome-binding', `${row.id} basis head does not match its expected outcome`);
  }
}

/** Required additions exist, every pinned obstruction is a row, and moved obligations name their surfaces. */
function checkRequiredRows(artifact) {
  const all = new Map([...artifact.rows, ...artifact.additions].map((row) => [row.id, row]));
  const additions = new Set(artifact.additions.map((row) => row.id));
  for (const id of [...REQUIRED_ADDITIONS, ...EXPECTED_OBSTRUCTIONS.keys()]) {
    if (!all.has(id)) fail('outcome-binding', `${id} is missing`);
  }
  for (const row of all.values()) {
    const named = row.movedObligations.map((moved) => moved.surface).sort().join();
    if (named !== [...(MOVED.get(row.id) ?? [])].sort().join()) fail('outcome-binding', `${row.id} moves [${named}]`);
    if (row.expected.posture === 'obstructed'
      && row.expected.precedence.competing.join() !== (COMPETING.get(row.id) ?? []).join()) {
      fail('outcome-binding', `${row.id} competing checks [${row.expected.precedence.competing.join()}]`);
    }
  }
  for (const [id, surfaces] of MOVED) {
    const named = all.get(id).movedObligations.map((moved) => moved.surface);
    for (const surface of surfaces) {
      const addition = surface.startsWith('addition:') ? surface.slice('addition:'.length) : null;
      if (!named.includes(surface) || (addition !== null && !additions.has(addition))) {
        fail('outcome-binding', `${id} does not move its obligation to ${surface}`);
      }
    }
  }
}

export function checkOutcomeBindings(artifact, oracle) {
  checkRequiredRows(artifact);
  const { checkOrder, outcomes } = artifact.profile;
  if (checkOrder.join() !== CHECK_ORDER.join() || outcomes.join() !== OUTCOMES.join()) {
    fail('outcome-binding', 'the profile changes the declared check order or outcome vocabulary');
  }
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
    if (terminal !== undefined && RETAINED_OUTCOME.get(terminal.semanticCode) !== expected.typedOutcome
      && !(typeof row.decision === 'string' && row.decision.length > 0)) {
      fail('outcome-binding', `${row.id} departs from ${terminal.semanticCode} without a decision`);
    }
    const pinned = EXPECTED_OBSTRUCTIONS.get(row.id);
    if (pinned === undefined || pinned[0] !== expected.typedOutcome || pinned[1] !== expected.decidingCheck
      || expected.precedence.deciding !== expected.decidingCheck) {
      fail('outcome-binding', `${row.id} expects ${expected.typedOutcome} at ${expected.decidingCheck}`);
    }
    if (expected.evidence.join() !== EVIDENCE.obstructed.join()) fail('outcome-binding', `${row.id} evidence`);
    checkReadSet(row, expected.readSet);
    checkBasisFault(row, expected.decidingCheck);
    checkInvocationIds(row, expected.typedOutcome);
  }
  for (const row of [...artifact.rows, ...artifact.additions]) {
    if (row.expected.posture === 'committed') checkInvocationIds(row, null);
    for (const moved of row.movedObligations) {
      if (![moved.surface, moved.obligation, moved.owner, moved.status].every((text) => typeof text === 'string' && text.length > 0)) {
        fail('outcome-binding', `${row.id} records a moved obligation without surface, owner or status`);
      }
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

/** Warp, type and Buffer ids follow from their declared labels and keys. */
function checkDeclaredIds(artifact) {
  const { profile } = artifact;
  const derive = (prefix, text) => hex(blake3(new TextEncoder().encode(prefix + text)));
  if (derive('warp:', profile.warp.label) !== profile.warp.id) fail('identity', 'warp id');
  for (const table of [profile.nodeTypes, profile.atomTypes, profile.edgeTypes]) {
    for (const [name, entry] of Object.entries(table)) {
      if (derive('type:', entry.label) !== entry.id) fail('identity', `type id of ${name}`);
    }
  }
  for (const row of [...artifact.rows, ...artifact.additions]) {
    for (const buffer of row.basis.buffers) {
      if (derive(profile.bufferKeyDomain, buffer.key) !== buffer.bufferId) fail('identity', `${row.id} BufferId`);
    }
  }
}

/** Every content node id is its ContentAddressV1 address, unless the row marks it injected and witnesses it. */
export function checkIdentities(artifact) {
  const ids = typeIds(artifact.profile);
  checkDeclaredIds(artifact);
  for (const row of [...artifact.rows, ...artifact.additions]) {
    const { nodes, edges } = row.basis;
    const witnessed = new Set(row.admissionWitnesses.map((witness) => witness.effect.node));
    for (const witness of row.admissionWitnesses) {
      const node = nodes.find((entry) => entry.id === witness.effect.node);
      if (witness.expectedOutcome !== 'IdentityLawViolation' || witness.boundary !== 'echo-admission'
        || node === undefined || node.admission !== 'requires-non-bridge-writer' || witness.contentAddress === node.id
        || witness.contentAddress !== addressOf(ids, node, edgesFrom(edges, node.id))) {
        fail('identity', `${row.id} witness for ${witness.effect.node} is not an IdentityLawViolation at admission`);
      }
    }
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
      for (const edge of node.edges) {
        const expected = contentEdgeId(ids.warp, unhex(node.id), ids.edges.get(edge.type), unhex(edge.to));
        if (hex(expected) !== edge.id) fail('identity', `${row.id} created edge ${edge.id} is not its address`);
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
      if ('undecodable' in node.fact) {
        if (decodesAsRecord(node.type, node.atomHex)) fail('atoms', `${row.id} ${node.id} is marked undecodable but decodes`);
        continue;
      }
      if (!decodesAsRecord(node.type, node.atomHex)) fail('atoms', `${row.id} ${node.id} atom is not its closed record`);
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
