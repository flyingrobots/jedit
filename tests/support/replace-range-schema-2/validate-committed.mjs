// SPDX-License-Identifier: Apache-2.0 OR LicenseRef-MIND-UCAL-1.0
// © James Ross Ω FLYING•ROBOTS <https://github.com/flyingrobots>
// Independent checks of committed rows: the expected post-state is rebuilt from
// the artifact's own facts and edges and must satisfy the rope law, carry the
// retained text outcome, share what the row says it shares, and propose exactly
// the effects Echo's canonical order requires.
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
      return { length: BigInt(bytes.length), breaks: BigInt(breaks), height: 1n, text: bytes };
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
    return { length: l.length + r.length, breaks: l.breaks + r.breaks, height, text: Uint8Array.from([...l.text, ...r.text]) };
  }
}

function checkHead(row, state, basisHead) {
  const head = state.nodes.get(row.expected.headAfter.id);
  const [root] = state.child(head.id, 'root');
  const metrics = root === undefined ? { length: 0n, breaks: 0n, text: new Uint8Array() } : state.tree(root, row);
  if (String(metrics.length) !== head.fact.byteLength || String(metrics.breaks + 1n) !== head.fact.lineCount) {
    fail(`${row.id} head metrics`);
  }
  if (hex(metrics.text) !== row.text.afterHex) fail(`${row.id} post-state text is not the expected text`);
  if (BigInt(head.fact.sequence) !== BigInt(basisHead.fact.sequence) + 1n) fail(`${row.id} head sequence`);
  if (state.child(head.id, 'anchor').join() !== state.child(basisHead.id, 'anchor').join()) {
    fail(`${row.id} the anchor is not carried forward`);
  }
}

function checkEffects(row, basisBuffer, basisHeadId) {
  const { effects, createdNodes, headAfter } = row.expected;
  const classOf = { EnsureNode: 0, ReplaceAtom: 1, EnsureEdge: 2, ReplaceEdge: 2 };
  const slot = (effect) => unhex(effect.node ?? effect.edge);
  for (let index = 1; index < effects.length; index += 1) {
    const [a, b] = [effects[index - 1], effects[index]];
    if (classOf[a.kind] > classOf[b.kind] || (classOf[a.kind] === classOf[b.kind] && compareBytes(slot(a), slot(b)) >= 0)) {
      fail(`${row.id} effects are not in Echo canonical order`);
    }
  }
  const ensured = effects.filter((effect) => effect.kind === 'EnsureNode').map((effect) => effect.node).sort();
  if (ensured.join() !== createdNodes.map((node) => node.id).sort().join()) fail(`${row.id} EnsureNode set`);
  const edgeCount = createdNodes.reduce((sum, node) => sum + node.edges.length, 0);
  if (effects.filter((effect) => effect.kind === 'EnsureEdge').length !== edgeCount) fail(`${row.id} EnsureEdge set`);
  const [atom] = effects.filter((effect) => effect.kind === 'ReplaceAtom');
  const atomType = unhex(row.basisProfile.atomTypes.Buffer.id);
  if (atom.node !== basisBuffer.id || atom.expectedAtomDigest !== hex(attachmentDigest(atomType, unhex(basisBuffer.atomHex)))) {
    fail(`${row.id} ReplaceAtom does not compare against the basis Buffer`);
  }
  const [edge] = effects.filter((effect) => effect.kind === 'ReplaceEdge');
  if (edge.expectedTo !== basisHeadId || edge.to !== headAfter.id) fail(`${row.id} ReplaceEdge retarget`);
  if (BigInt(row.expected.bufferAfter.version) !== BigInt(basisBuffer.fact.version) + 1n) fail(`${row.id} version`);
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
  const reads = new Set(row.expected.footprint.reads.nodes);
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
    const state = new PostState(row);
    const basisBuffer = row.basis.nodes.find((node) => node.id === row.invocation.bufferId);
    const basisHead = row.basis.nodes.find((node) => node.id === row.invocation.basisHeadId);
    checkHead(row, state, basisHead);
    checkEffects({ ...row, basisProfile: artifact.profile }, basisBuffer, basisHead.id);
    checkReach(row, state, basisHead.id);
  }
}
