// SPDX-License-Identifier: Apache-2.0 OR LicenseRef-MIND-UCAL-1.0
// © James Ross Ω FLYING•ROBOTS <https://github.com/flyingrobots>
// Independent checks of committed rows: the expected post-state is rebuilt from
// the artifact's own facts and edges and must satisfy the rope law, carry the
// retained text outcome, share what the row says it shares, and propose exactly
// the effects Echo's canonical order requires.
import { decode as cborDecode } from 'cbor-x';
import { attachmentDigest, compareBytes, hex, unhex } from './content-address-v1.mts';

const MAX_LEAF_BYTES = 4096;

class CommittedCheckError extends Error {
  constructor(message) {
    super(`committed: ${message}`);
    this.check = 'committed';
  }
}

function fail(message) {
  throw new CommittedCheckError(message);
}

class PostState {
  constructor(row) {
    this.nodes = new Map(row.basis.nodes.map((node) => [node.id, node]));
    this.edges = new Map(row.basis.edges.map((edge) => [edge.id, edge]));
    for (const node of row.expected.createdNodes) {
      this.nodes.set(node.id, node);
      for (const edge of node.edges) this.edges.set(edge.id, { ...edge, from: node.id });
    }
    const slot = row.expected.effects.find((effect) => effect.kind === 'ReplaceEdge');
    this.edges.set(slot.edge, { ...this.edges.get(slot.edge), to: slot.to });
  }

  child(id, type) {
    return [...this.edges.values()].filter((edge) => edge.from === id && edge.type === type).map((edge) => edge.to);
  }

  reachable(from) {
    const seen = new Set();
    const pending = [from];
    while (pending.length > 0) {
      const id = pending.pop();
      if (seen.has(id)) continue;
      seen.add(id);
      for (const edge of this.edges.values()) if (edge.from === id) pending.push(edge.to);
    }
    return seen;
  }

  /** Validates a subtree and returns its metrics and text. */
  tree(id, row) {
    const node = this.nodes.get(id);
    if (node.type === 'Leaf') {
      const bytes = unhex(node.fact.bytes);
      new TextDecoder('utf-8', { fatal: true }).decode(bytes);
      const breaks = bytes.filter((byte) => byte === 0x0a).length;
      if (bytes.length < 1 || bytes.length > MAX_LEAF_BYTES || String(breaks) !== node.fact.lineBreaks) {
        fail(`${row.id} leaf ${id} breaks the leaf law`);
      }
      return { length: BigInt(bytes.length), breaks: BigInt(breaks), height: 1n, text: bytes, leaves: [bytes.length] };
    }
    const [left] = this.child(id, 'left');
    const [right] = this.child(id, 'right');
    const [l, r] = [this.tree(left, row), this.tree(right, row)];
    const height = 1n + (l.height > r.height ? l.height : r.height);
    const skew = l.height - r.height;
    if (String(l.length + r.length) !== node.fact.byteLength || String(l.breaks + r.breaks) !== node.fact.lineBreaks
      || String(height) !== node.fact.height || skew > 1n || skew < -1n) {
      fail(`${row.id} branch ${id} breaks the rope law`);
    }
    return { length: l.length + r.length, breaks: l.breaks + r.breaks, height, text: Uint8Array.from([...l.text, ...r.text]),
      leaves: [...l.leaves, ...r.leaves] };
  }
}

function checkHead(row, state, basisHead) {
  const head = state.nodes.get(row.expected.headAfter.id);
  const [root] = state.child(head.id, 'root');
  const metrics = root === undefined ? { length: 0n, breaks: 0n, text: new Uint8Array(), leaves: [] } : state.tree(root, row);
  if (String(metrics.length) !== head.fact.byteLength || String(metrics.breaks + 1n) !== head.fact.lineCount) {
    fail(`${row.id} head metrics`);
  }
  if (hex(metrics.text) !== row.text.afterHex) fail(`${row.id} post-state text is not the expected text`);
  if (metrics.leaves.join() !== row.text.leafSizes.join()) fail(`${row.id} leaf sizes ${metrics.leaves.join()}`);
  if (BigInt(head.fact.sequence) !== BigInt(basisHead.fact.sequence) + 1n) fail(`${row.id} head sequence`);
  if (state.child(head.id, 'anchor').join() !== state.child(basisHead.id, 'anchor').join()) {
    fail(`${row.id} the anchor is not carried forward`);
  }
}

function sameFields(effect, expected) {
  return Object.entries(expected).every(([name, value]) => effect[name] === value);
}

function checkEffects(row, profile, basisBuffer, basisHeadId) {
  const { effects, createdNodes, headAfter } = row.expected;
  const classOf = { EnsureNode: 0, ReplaceAtom: 1, EnsureEdge: 2, ReplaceEdge: 2 };
  const slot = (effect) => unhex(effect.node ?? effect.edge);
  for (let index = 1; index < effects.length; index += 1) {
    const [a, b] = [effects[index - 1], effects[index]];
    if (classOf[a.kind] > classOf[b.kind] || (classOf[a.kind] === classOf[b.kind] && compareBytes(slot(a), slot(b)) >= 0)) {
      fail(`${row.id} effects are not in Echo canonical order`);
    }
  }
  const wanted = [
    ...createdNodes.map((node) => ({ kind: 'EnsureNode', node: node.id, nodeType: profile.nodeTypes[node.type].id,
      atomType: profile.atomTypes[node.type].id, atomHex: node.atomHex })),
    ...createdNodes.flatMap((node) => node.edges.map((edge) => ({ kind: 'EnsureEdge', edge: edge.id, from: node.id,
      edgeType: profile.edgeTypes[edge.type].id, to: edge.to }))),
    { kind: 'ReplaceAtom', node: basisBuffer.id, atomType: profile.atomTypes.Buffer.id,
      expectedAtomDigest: hex(attachmentDigest(unhex(profile.atomTypes.Buffer.id), unhex(basisBuffer.atomHex))) },
    { kind: 'ReplaceEdge', expectedTo: basisHeadId, to: headAfter.id },
  ];
  if (effects.length !== wanted.length) fail(`${row.id} proposes ${effects.length} effects, not ${wanted.length}`);
  for (const expected of wanted) {
    if (!effects.some((effect) => sameFields(effect, expected))) fail(`${row.id} has no effect matching ${expected.kind}`);
  }
  const atom = effects.find((effect) => effect.kind === 'ReplaceAtom');
  const decoded = cborDecode(Buffer.from(atom.atomHex, 'hex'));
  const after = row.expected.bufferAfter;
  if (Object.keys(decoded).sort().join() !== 'bufferKey,version' || decoded.bufferKey !== after.bufferKey
    || String(decoded.version) !== after.version) fail(`${row.id} ReplaceAtom does not write bufferAfter`);
  if (BigInt(after.version) !== BigInt(basisBuffer.fact.version) + 1n || after.bufferKey !== basisBuffer.fact.bufferKey) {
    fail(`${row.id} version`);
  }
  const basisIds = new Set(row.basis.nodes.map((node) => node.id));
  const written = createdNodes.map((node) => node.id).filter((id) => !basisIds.has(id)).sort();
  const basisEdges = new Set(row.basis.edges.map((edge) => edge.id));
  const newEdges = createdNodes.filter((node) => !basisIds.has(node.id)).flatMap((node) =>
    node.edges.filter((edge) => !basisEdges.has(edge.id)).map((edge) => ({ ...edge, from: node.id })));
  const slotEdge = effects.find((effect) => effect.kind === 'ReplaceEdge').edge;
  const ranges = new Map([[`${basisBuffer.id}/canonicalHead`, { from: basisBuffer.id, type: 'canonicalHead' }],
    ...newEdges.map((edge) => [`${edge.from}/${edge.type}`, { from: edge.from, type: edge.type }])]);
  const expectedWrites = { nodes: written, atoms: [...written, basisBuffer.id].sort(),
    edges: [...newEdges.map((edge) => edge.id), slotEdge].sort(),
    edgeRanges: [...ranges].sort(([a], [b]) => (a < b ? -1 : 1)).map(([, range]) => range) };
  if (JSON.stringify(row.expected.writeSet) !== JSON.stringify(expectedWrites)) fail(`${row.id} write set`);
}

function checkReach(row, state, basisHeadId) {
  const before = new PostState({ ...row, expected: { createdNodes: [], effects: [{ kind: 'ReplaceEdge',
    edge: row.expected.effects.find((effect) => effect.kind === 'ReplaceEdge').edge, to: basisHeadId }] } });
  const after = state.reachable(row.invocation.bufferId);
  if ([...after].sort().join() !== row.expected.reachability.fromBufferAfter.join()) fail(`${row.id} reachability`);
  const oldTree = before.reachable(basisHeadId);
  for (const leafHex of row.text.mustShareHex) {
    const leaf = [...oldTree].find((id) => state.nodes.get(id).type === 'Leaf' && state.nodes.get(id).fact.bytes === leafHex);
    if (leaf === undefined || !after.has(leaf)) fail(`${row.id} leaf ${leafHex.slice(0, 16)}… is not shared`);
  }
  for (const other of row.basis.buffers.filter((buffer) => buffer.bufferId !== row.invocation.bufferId)) {
    if ([...before.reachable(other.bufferId)].sort().join() !== [...state.reachable(other.bufferId)].sort().join()) {
      fail(`${row.id} editing one buffer changed ${other.key}`);
    }
  }
  const known = new Set([...row.basis.nodes.map((node) => node.id), row.invocation.bufferId]);
  if (row.expected.readSet.nodes.some((id) => !known.has(id))) fail(`${row.id} reads a node outside the basis`);
  const reads = new Set(row.expected.readSet.nodes);
  if (!reads.has(row.invocation.bufferId) || !reads.has(basisHeadId)) fail(`${row.id} reads omit the Buffer or Head`);
  for (const other of row.basis.buffers.filter((buffer) => buffer.bufferId !== row.invocation.bufferId)) {
    if (reads.has(other.bufferId)) fail(`${row.id} reads another buffer`);
  }
}

export function checkCommitted(artifact, oracle) {
  const retained = new Map(oracle.cases.map((entry) => [entry.id, entry.terminal]));
  for (const row of [...artifact.rows, ...artifact.additions]) {
    if (row.expected.posture !== 'committed') continue;
    const terminal = retained.get(row.id);
    if (terminal !== undefined && terminal.result.materializedTextUtf8Hex !== row.text.afterHex) {
      fail(`${row.id} text differs from the retained outcome`);
    }
    const before = unhex(row.text.beforeHex);
    const [start, end] = [Number(row.invocation.startByte), Number(row.invocation.endByte)];
    const spliced = Uint8Array.from([...before.subarray(0, start), ...unhex(row.invocation.replacementHex),
      ...before.subarray(end)]);
    if (hex(spliced) !== row.text.afterHex) fail(`${row.id} after-text is not the splice of the before-text`);
    if (row.expected.evidence.length === 0) fail(`${row.id} names no execution evidence`);
    const state = new PostState(row);
    const basisBuffer = row.basis.nodes.find((node) => node.id === row.invocation.bufferId);
    const basisHead = row.basis.nodes.find((node) => node.id === row.invocation.basisHeadId);
    const basisText = new PostState({ ...row, expected: { createdNodes: [], effects: [{ kind: 'ReplaceEdge',
      edge: row.expected.effects.find((effect) => effect.kind === 'ReplaceEdge').edge, to: basisHead.id }] } });
    const [basisRoot] = basisText.child(basisHead.id, 'root');
    const stored = basisRoot === undefined ? '' : hex(basisText.tree(basisRoot, row).text);
    if (stored !== row.text.beforeHex) fail(`${row.id} before-text is not the basis head's text`);
    checkHead(row, state, basisHead);
    checkEffects(row, artifact.profile, basisBuffer, basisHead.id);
    checkReach(row, state, basisHead.id);
  }
}
