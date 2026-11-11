// SPDX-License-Identifier: Apache-2.0 OR LicenseRef-MIND-UCAL-1.0
// © James Ross Ω FLYING•ROBOTS <https://github.com/flyingrobots>
// Renders one hand-written row into its artifact entry. The specification
// model supplies ids, footprints and effects; the row supplies the texts and
// outcomes, and generation fails when the two disagree.
import { contentNodeId, hex, OutgoingEdge } from './content-address-v1.mts';
import { Basis } from './fixture-basis.mts';
import type { GraphState } from './graph.mts';
import { CHECK_ORDER, checkRank, ECHO_ADMISSION, IDENTITY_LAW_VIOLATION } from './outcomes.mts';
import { proposalFor } from './proposal.mts';
import type { Proposal } from './proposal.mts';
import { Invocation, ModelCommit, ReplaceRangeModel } from './replace-range-model.mts';
import { ExpectCommitted } from './row-spec.mts';
import type { ExpectObstructed, RowSpec } from './row-spec.mts';
import { bytesField, decodeFact, EDGE_KINDS, edgeTypeId, FACT_KINDS, nodeTypeId, WARP_ID } from './schema-2-facts.mts';
import type { FactKind } from './schema-2-facts.mts';

export type Json = string | number | boolean | null | readonly Json[] | { readonly [key: string]: Json };

export class FixtureInconsistency extends Error {}

const COMMITTED_EVIDENCE = Object.freeze([
  'admission receipt with committed posture naming exactly these effects',
  'WAL entry for the Tick carrying the derived patch',
  'restart recovers a reachable state equal to the expected post-state',
]);
const OBSTRUCTED_EVIDENCE = Object.freeze([
  'receipt naming the typed outcome and deciding check',
  'no patch derived and no WAL write',
  'reachable state after equals the basis',
]);

function kindName(nodeType: Uint8Array): FactKind | null {
  return FACT_KINDS.find((kind) => hex(nodeTypeId(kind)) === hex(nodeType)) ?? null;
}

function edgeName(edgeType: Uint8Array): string {
  return EDGE_KINDS.find((kind) => hex(edgeTypeId(kind)) === hex(edgeType)) ?? hex(edgeType);
}

function factJson(kind: FactKind | null, atom: Uint8Array): Json {
  if (kind === null) return { undecodable: 'unknown node type' };
  try {
    return Object.fromEntries([...decodeFact(kind, atom)].map(([name, value]) =>
      [name, typeof value === 'bigint' ? value.toString() : (typeof value === 'string' ? value : hex(value))]));
  } catch (error) {
    return { undecodable: String(error instanceof Error ? error.message : error) };
  }
}

export function graphJson(graph: GraphState, injected: ReadonlySet<string>): { nodes: Json; edges: Json } {
  return {
    nodes: [...graph.nodes.values()].sort((a, b) => hex(a.id).localeCompare(hex(b.id))).map((node) => ({
      id: hex(node.id), type: kindName(node.nodeType) ?? hex(node.nodeType), atomHex: hex(node.atom),
      fact: factJson(kindName(node.nodeType), node.atom),
      admission: injected.has(hex(node.id)) ? 'requires-non-bridge-writer' : 'bridge-admissible',
    })),
    edges: [...graph.edges.values()].sort((a, b) => hex(a.id).localeCompare(hex(b.id))).map((edge) => ({
      id: hex(edge.id), from: hex(edge.from), type: edgeName(edge.edgeType), to: hex(edge.to),
    })),
  };
}

function reachable(graph: GraphState, from: Uint8Array, extra: Proposal | null): Set<string> {
  const seen = new Set<string>();
  const pending = [hex(from)];
  const replaced = extra === null ? null : hex(extra.slotEdge);
  while (pending.length > 0) {
    const id = pending.pop()!;
    if (seen.has(id)) continue;
    seen.add(id);
    const edges = [...graph.edges.values(), ...(extra?.createdEdges.values() ?? [])]
      .filter((edge) => hex(edge.from) === id);
    for (const edge of edges) {
      pending.push(hex(edge.id) === replaced && extra !== null ? hex(extra.headId) : hex(edge.to));
    }
  }
  return seen;
}

/** Concatenated leaf bytes under a head, following created edges first and basis edges otherwise. */
function proposalText(proposal: Proposal, graph: GraphState, id: Uint8Array): Uint8Array {
  const key = hex(id);
  const node = proposal.created.get(key) ?? graph.nodes.get(key)!;
  const kind = kindName(node.nodeType);
  if (kind === 'Leaf') return bytesField(decodeFact('Leaf', node.atom), 'bytes');
  const edges = [...new Map([...graph.edges, ...proposal.createdEdges]).values()].filter((edge) => hex(edge.from) === key);
  const parts = ['root', 'left', 'right'].flatMap((name) => edges.filter((edge) => edgeName(edge.edgeType) === name)
    .map((edge) => proposalText(proposal, graph, edge.to)));
  return Uint8Array.from(parts.flatMap((part) => [...part]));
}

export function resolveInvocation(row: RowSpec, basis: Basis): Invocation {
  const spec = row.invocation;
  const target = typeof spec.buffer === 'string' ? basis.buffers.get(spec.buffer)! : null;
  const bufferId = target === null ? (spec.buffer instanceof Uint8Array ? spec.buffer : new Uint8Array()) : target.bufferId;
  const ref = spec.basis;
  let basisHead: Uint8Array;
  if (ref instanceof Uint8Array) basisHead = ref;
  else if (ref === 'canonical') basisHead = target!.canonicalHead;
  else if ('other' in ref) basisHead = target!.otherHeads[ref.other]!;
  else basisHead = basis.buffers.get(ref.canonicalOf)!.canonicalHead;
  return new Invocation(bufferId, basisHead, [spec.start, spec.end], spec.replacement);
}

function readsJson(model: ModelCommit | { view: ModelCommit['view'] }): Json {
  return {
    nodes: [...model.view.nodeReads].sort(),
    edgeRanges: [...model.view.rangeReads.values()].map((range) => ({ from: range.from, type: edgeName(
      Uint8Array.from(range.edgeType.match(/../g)!, (pair) => Number.parseInt(pair, 16))) }))
      .sort((a, b) => `${a.from}/${a.type}`.localeCompare(`${b.from}/${b.type}`)),
  };
}

export function admissionWitnesses(basis: Basis): Json[] {
  return [...basis.injected].sort().map((id) => {
    const node = basis.graph.node(Uint8Array.from(id.match(/../g)!, (pair) => Number.parseInt(pair, 16)))!;
    const edges = basis.graph.allOutgoing(node.id);
    const address = contentNodeId(WARP_ID, node.nodeType, node.atomType, node.atom,
      edges.map((edge) => new OutgoingEdge(edge.edgeType, edge.to)));
    return {
      effect: { kind: 'EnsureNode', node: id, nodeType: kindName(node.nodeType), atomHex: hex(node.atom),
        edges: edges.map((edge) => ({ type: edgeName(edge.edgeType), to: hex(edge.to) })) },
      contentAddress: hex(address), boundary: ECHO_ADMISSION, expectedOutcome: IDENTITY_LAW_VIOLATION,
      reason: 'the stored id is not the ContentAddressV1 address of the atom and edges it carries',
    };
  });
}

export function obstructedJson(row: RowSpec, expected: ExpectObstructed, model: ReplaceRangeModel): Json {
  const result = model.run();
  if (result instanceof ModelCommit || result.obstruction.outcome !== expected.outcome
    || result.obstruction.check !== expected.check) {
    throw new FixtureInconsistency(`${row.id}: model ${result instanceof ModelCommit ? 'committed'
      : result.obstruction.message}, row expects ${expected.outcome} at ${expected.check}`);
  }
  for (const later of expected.competing) {
    if (checkRank(later) <= checkRank(expected.check)) throw new FixtureInconsistency(`${row.id}: ${later} is not later`);
  }
  return {
    posture: 'obstructed', typedOutcome: expected.outcome, decidingCheck: expected.check,
    precedence: { passed: CHECK_ORDER.slice(0, checkRank(expected.check)), deciding: expected.check,
      competing: expected.competing },
    observedReads: readsJson(result), effects: [], patch: 'none', parentGraphUnchanged: true,
    evidence: OBSTRUCTED_EVIDENCE,
  };
}

/** Range keys (source, edge type) each written edge touches, as Echo's write set records them. */
function writtenRanges(proposal: Proposal, writtenEdges: readonly string[], bufferId: Uint8Array): Json {
  const keys = new Map<string, { from: string; type: string }>([[`${hex(bufferId)}/canonicalHead`,
    { from: hex(bufferId), type: 'canonicalHead' }]]);
  for (const id of writtenEdges) {
    const edge = proposal.createdEdges.get(id)!;
    keys.set(`${hex(edge.from)}/${edgeName(edge.edgeType)}`, { from: hex(edge.from), type: edgeName(edge.edgeType) });
  }
  return [...keys].sort(([a], [b]) => a.localeCompare(b)).map(([, key]) => key);
}

export function committedJson(row: RowSpec, expected: ExpectCommitted, basis: Basis, model: ReplaceRangeModel): Json {
  const result = model.run();
  if (!(result instanceof ModelCommit)) {
    throw new FixtureInconsistency(`${row.id}: model obstructed with ${result.obstruction.message}`);
  }
  const invocation = model.invocation;
  const proposal = proposalFor(result, invocation.bufferId, basis.graph);
  const before = reachable(basis.graph, invocation.basisHeadId, null);
  const after = reachable(basis.graph, invocation.bufferId, proposal);
  const textBefore = basis.texts.get(hex(invocation.basisHeadId)) ?? new Uint8Array();
  const textAfter = proposalText(proposal, basis.graph, proposal.headId);
  if (hex(textBefore) !== hex(expected.textBefore) || hex(textAfter) !== hex(expected.textAfter)) {
    throw new FixtureInconsistency(`${row.id}: model text differs from the hand-written texts`);
  }
  const shared = [...before].filter((id) => after.has(id)).sort();
  for (const text of expected.mustShare) {
    const leafId = [...before].find((id) => {
      const node = basis.graph.nodes.get(id)!;
      return kindName(node.nodeType) === 'Leaf' && hex(bytesField(decodeFact('Leaf', node.atom), 'bytes')) === hex(text);
    });
    if (leafId === undefined || !after.has(leafId)) throw new FixtureInconsistency(`${row.id}: a leaf is not shared`);
  }
  const others = [...basis.buffers.values()].filter((other) => hex(other.bufferId) !== hex(invocation.bufferId));
  const effects = proposal.effects();
  const writtenNodes = [...proposal.created.keys()].filter((id) => !basis.graph.nodes.has(id)).sort();
  const writtenEdges = [...proposal.createdEdges.keys()].filter((id) => !basis.graph.edges.has(id));
  return {
    posture: 'committed',
    headAfter: { id: hex(proposal.headId), fact: factJson('Head', proposal.created.get(hex(proposal.headId))!.atom) },
    bufferAfter: factJson('Buffer', proposal.bufferAtom),
    createdNodes: [...proposal.created.values()].sort((a, b) => hex(a.id).localeCompare(hex(b.id))).map((node) => ({
      id: hex(node.id), type: kindName(node.nodeType), atomHex: hex(node.atom), fact: factJson(kindName(node.nodeType), node.atom),
      edges: [...proposal.createdEdges.values()].filter((edge) => hex(edge.from) === hex(node.id))
        .map((edge) => ({ id: hex(edge.id), type: edgeName(edge.edgeType), to: hex(edge.to) })),
      alreadyInBasis: basis.graph.nodes.has(hex(node.id)),
    })),
    effects: effects.map((effect) => ({ kind: effect.kind, ...Object.fromEntries(effect.fields) })),
    footprint: {
      reads: readsJson(result),
      writes: { nodes: writtenNodes, atoms: [...writtenNodes, hex(invocation.bufferId)].sort(),
        edges: [...writtenEdges, hex(proposal.slotEdge)].sort(),
        edgeRanges: writtenRanges(proposal, writtenEdges, invocation.bufferId) },
    },
    reachability: {
      root: 'worldline root to Buffer layout pending echo#927; sets below start at the Buffer',
      fromBufferAfter: [...after].sort(), sharedWithBasisHead: shared,
      supersededFromBasisHead: [...before].filter((id) => !after.has(id)).sort(),
      otherBuffersUnchanged: others.map((other) => other.key),
    },
    resourceDomain: {
      replacementBytes: invocation.replacement.length, createdNodes: writtenNodes.length, effects: effects.length,
      patchOperations: writtenNodes.length * 2 + writtenEdges.length + 2, readNodes: result.view.nodeReads.size,
      membership: 'unmeasured: outside the measured v1 envelope is a gap, never a pass',
    },
    evidence: COMMITTED_EVIDENCE,
  };
}

export function isCommitted(expected: ExpectCommitted | ExpectObstructed): expected is ExpectCommitted {
  return expected instanceof ExpectCommitted;
}
