// SPDX-License-Identifier: Apache-2.0 OR LicenseRef-MIND-UCAL-1.0
// © James Ross Ω FLYING•ROBOTS <https://github.com/flyingrobots>
// Assembles the schema-2 acceptance fixture artifact from the hand-written rows.
import { hex } from './content-address-v1.mts';
import { Basis } from './fixture-basis.mts';
import { admissionWitnesses, committedJson, graphJson, isCommitted, obstructedJson, resolveInvocation }
  from './artifact-rows.mts';
import type { Json } from './artifact-rows.mts';
import { CHECK_ORDER, ECHO_ADMISSION, IDENTITY_LAW_VIOLATION, OUTCOMES } from './outcomes.mts';
import { ReplaceRangeModel } from './replace-range-model.mts';
import type { RowSpec } from './row-spec.mts';
import { ADDITION_ROWS } from './rows-additions.mts';
import { CARRY_OBSTRUCTED_ROWS } from './rows-carry-obstructed.mts';
import { COMMITTED_ROWS } from './rows-committed.mts';
import { COUNTERPART_ROWS } from './rows-counterpart.mts';
import { ATOM_TYPE_IDS, EDGE_TYPE_IDS, LABELS, MAX_LEAF_BYTES, NODE_TYPE_IDS, WARP_ID } from './schema-2-facts.mts';

export const ARTIFACT_COORDINATE = 'jedit.text.ReplaceRange.schema-2-fixtures@1';
export const RETAINED_ORACLE_PATH = 'contracts/jedit/lawpacks/replace-range-v1/replace-range-v1.oracle.json';

export const RETAINED_ROWS: readonly RowSpec[] = [...COMMITTED_ROWS, ...CARRY_OBSTRUCTED_ROWS, ...COUNTERPART_ROWS];

function labelled(labels: Readonly<Record<string, string>>, ids: ReadonlyMap<string, Uint8Array>): Json {
  return Object.fromEntries(Object.entries(labels).map(([kind, label]) => [kind, { label, id: hex(ids.get(kind)!) }]));
}

function profile(): Json {
  return {
    status: 'fixture-declared until the jedit.text@2 lawpack and the authored outcome type are published (#296)',
    identityLaw: 'Echo ContentAddressV1 (identity law 1)',
    idDerivation: 'warp and type ids are BLAKE3 over "warp:" or "type:" and the label; BufferId is BLAKE3 over the '
      + 'buffer-key domain and the key',
    warp: { label: LABELS.warp, id: hex(WARP_ID) },
    bufferKeyDomain: LABELS.bufferKeyDomain,
    nodeTypes: labelled(LABELS.nodeTypes, NODE_TYPE_IDS),
    atomTypes: labelled(LABELS.atomTypes, ATOM_TYPE_IDS),
    edgeTypes: labelled(LABELS.edgeTypes, EDGE_TYPE_IDS),
    atomCodec: 'edict.canonical-cbor/v1 map keyed by field name; U64/U8 unsigned, Bytes byte string, String text',
    rope: {
      maxLeafBytes: MAX_LEAF_BYTES,
      height: 'leaf 1; branch 1 + max(children); AVL: children differ by at most 1',
      lineBreaks: 'count of 0x0A; Head.lineCount = root lineBreaks + 1',
      fromBytes: 'one leaf up to 4096 bytes; otherwise split at the last character boundary at or before half',
      leafRewrite: 'an edit inside one leaf whose result is 1-4096 bytes rewrites that leaf and path-copies ancestors',
      general: 'otherwise prefix(start), fromBytes(replacement), suffix(end), joined by AVL concatenation',
      descent: 'a range descends left while end <= left length, right while start >= left length',
    },
    validation: 'a leaf is validated when its atom is decoded; a branch when expanded: edge counts, identity, then '
      + 'its decoded children\'s checked sums, equality, height and balance, before any child is expanded',
    footprint: 'reads are the node records/atoms and (source, edge type) ranges the specification model resolved; '
      + 'writes follow Echo\'s slot model; an Ensure of an existing identical node is a read',
    checkOrder: CHECK_ORDER,
    outcomes: OUTCOMES,
    echoAdmission: { boundary: ECHO_ADMISSION, identityViolation: IDENTITY_LAW_VIOLATION },
    effectOrder: 'Echo canonical order: node record, then attachment, then edge; then local id bytes',
    pending: {
      worldlineRoot: 'echo#927 owns the worldline-root-to-Buffer layout; reachability starts at the Buffer',
      closureSelector: 'echo#926 owns the bounded closure read; reads here are the model\'s, not a selector\'s',
      envelope: 'v1 resource envelope unmeasured; rows record their needs and a refusal outside it is a gap',
    },
  };
}

function rowJson(row: RowSpec, retainedIndex: number | null): Json {
  const basis = new Basis(row.buffers);
  const invocation = resolveInvocation(row, basis);
  const model = new ReplaceRangeModel(basis.graph, invocation);
  const expected = isCommitted(row.expected)
    ? committedJson(row, row.expected, basis, model)
    : obstructedJson(row, row.expected, model);
  return {
    id: row.id,
    mapping: row.mapping,
    ...(retainedIndex === null ? {} : { retainedCaseIndex: retainedIndex }),
    obligation: row.obligation,
    retainedSemanticCode: row.retainedSemanticCode,
    decision: row.decision,
    movedObligations: row.moved.map((moved) => ({ surface: moved.surface, obligation: moved.obligation,
      owner: moved.owner, status: 'gap until discharged on that surface' })),
    status: 'unexecuted',
    target: 'persistent-rope',
    basis: { buffers: [...basis.buffers.values()].map((buffer) => ({ key: buffer.key, bufferId: hex(buffer.bufferId),
      canonicalHead: hex(buffer.canonicalHead), otherHeads: buffer.otherHeads.map(hex) })),
    ...graphJson(basis.graph, basis.injected) },
    admissionWitnesses: admissionWitnesses(basis),
    invocation: { bufferId: hex(invocation.bufferId), basisHeadId: hex(invocation.basisHeadId),
      startByte: invocation.start.toString(), endByte: invocation.end.toString(),
      replacementHex: hex(invocation.replacement) },
    ...(isCommitted(row.expected)
      ? { text: { beforeHex: hex(row.expected.textBefore), afterHex: hex(row.expected.textAfter),
        mustShareHex: row.expected.mustShare.map(hex) } } : {}),
    expected,
  };
}

export function buildArtifact(retainedIds: readonly string[], oracleSha256: string): Json {
  const byId = new Map(RETAINED_ROWS.map((row) => [row.id, row]));
  return {
    schemaVersion: 1,
    coordinate: ARTIFACT_COORDINATE,
    status: 'fixtures only: no row has been executed; a row passes only with persistent-rope execution evidence',
    retainedOracle: { path: RETAINED_ORACLE_PATH, coordinate: 'jedit.text.ReplaceRange.oracle@1',
      sha256: oracleSha256, caseCount: retainedIds.length },
    register: { owner: 'docs/design/0159-edict-rope-representation.md', carry: 28, counterpart: 12 },
    profile: profile(),
    rows: retainedIds.map((id, index) => {
      const row = byId.get(id);
      if (row === undefined) throw new Error(`no schema-2 row for retained case ${id}`);
      return rowJson(row, index);
    }),
    additions: ADDITION_ROWS.map((row) => rowJson(row, null)),
  };
}
