// SPDX-License-Identifier: Apache-2.0 OR LicenseRef-MIND-UCAL-1.0
// © James Ross Ω FLYING•ROBOTS <https://github.com/flyingrobots>
// Schema-2 ReplaceRange acceptance fixtures (#389). These checks validate the
// fixture artifact against the frozen schema-1 oracle, Echo's identity vectors
// and an independent codec. No row is executed; nothing here claims the rope runs.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { blake3 } from './support/replace-range-schema-2/blake3.mts';
import { decodeCanonicalCbor } from './support/replace-range-schema-2/canonical-cbor.mts';
import { attachmentDigest, contentEdgeId, contentNodeId, hex, OutgoingEdge, slotEdgeId }
  from './support/replace-range-schema-2/content-address-v1.mts';
import { exactObservation, unmetReasons } from './support/replace-range-schema-2/judge.mjs';
import { checkAtoms, checkCommitted, checkIdentities, checkOracleUnchanged, checkOutcomeBindings, checkRegister }
  from './support/replace-range-schema-2/validate-artifact.mjs';

const ROOT = process.cwd();
const ORACLE_PATH = path.join(ROOT, 'contracts/jedit/lawpacks/replace-range-v1/replace-range-v1.oracle.json');
const ARTIFACT_PATH = path.join(ROOT,
  'contracts/jedit/acceptance/replace-range-schema-2/replace-range-schema-2.fixtures.json');
const TOOLING = path.join(ROOT, 'tests/support/replace-range-schema-2');
// Oracle: the retained oracle's own sidecar at merge d8915f3e; the oracle must never move.
const RETAINED_ORACLE_SHA256 = '89a15993d9317383f8b7bf4c36d6d00a4c9b13e7684f91916a926bea74f1eb01';

// Oracle: DL-0159 "ReplaceRange acceptance across representations", copied by hand.
const COUNTERPARTS = new Set(['malformed-buffer', 'bad-blob-content-hash', 'cyclic-right-endpoint',
  'leaf-ends-inside-codepoint-at-exact-end', 'leaf-exceeds-blob-at-zero', 'leaf-exceeds-blob-at-exact-end',
  'leaf-exceeds-blob-at-internal-boundary', 'leaf-range-start-overflow', 'leaf-range-end-overflow',
  'leaf-extent-u64-max-at-zero', 'rope-utf16-length-overflow', 'branch-height-u32-max-at-zero']);

const oracleBytes = readFileSync(ORACLE_PATH);
const oracle = JSON.parse(oracleBytes.toString('utf8'));
const artifact = JSON.parse(readFileSync(ARTIFACT_PATH, 'utf8'));
const MAPPING = new Map(oracle.cases.map((entry) => [entry.id, COUNTERPARTS.has(entry.id) ? 'counterpart' : 'carry']));

function mutated(mutate) {
  const copy = structuredClone(artifact);
  mutate(copy);
  return copy;
}

function row(source, id) {
  return [...source.rows, ...source.additions].find((entry) => entry.id === id);
}

test('BLAKE3 transcription matches the blake3 1.8.7 reference crate across chunk boundaries', () => {
  // Oracle: blake3::hash from the blake3 1.8.7 crate over bytes i % 251, run once and frozen here.
  const vectors = new Map([[0, 'af1349b9f5f9a1a6a0404dea36dcc9499bcb25c9adc112b7cc9a93cae41f3262'],
    [1, '2d3adedff11b61f14c886e35afa036736dcd87a74d27b5c1510225d0f592e213'],
    [1023, '10108970eeda3eb932baac1428c7a2163b0e924c9a9e25b35bba72b28f70bd11'],
    [1024, '42214739f095a406f3fc83deb889744ac00df831c10daa55189b5d121c855af7'],
    [1025, 'd00278ae47eb27b34faecf67b4fe263f82d5412916c1ffd97c8cb7fb814b8444'],
    [3073, '7124b49501012f81cc7f11ca069ec9226cecb8a2c850cfe644e327d22d3e1cd3'],
    [4097, '9b4052b38f1c5fc8b1f9ff7ac7b27cd242487b3d890d15c96a1c25b8aa0fb995'],
    [9000, 'e9daa1ff8a19d7618f9721c83a17cffd6976a323aa116d030aac239c98b6a046']]);
  for (const [length, expected] of vectors) {
    assert.equal(hex(blake3(Uint8Array.from({ length }, (_, index) => index % 251))), expected, `length ${length}`);
  }
});

test('ContentAddressV1 transcription reproduces Echo\'s frozen identity vectors', () => {
  // Oracle: echo e5604e0c crates/warp-core/tests/content_address_v1_tests.rs frozen hex.
  const fill = (byte) => new Uint8Array(32).fill(byte);
  const [warp, nodeType, atomType, edgeA, edgeB, low, high] = [3, 7, 2, 6, 8, 4, 5].map(fill);
  const atom = new TextEncoder().encode('new');
  assert.equal(hex(attachmentDigest(atomType, atom)), 'a658effc54ff1c915e9544c327aafaeb65d00a83e99d0c0c9848f3c2aa3bbafc');
  assert.equal(hex(contentNodeId(warp, nodeType, atomType, atom, [])),
    '127c0d47351ee88620bec24603a1b8949610d792f06f913227308ee5c7e47f90');
  assert.equal(hex(contentNodeId(warp, nodeType, atomType, atom, [new OutgoingEdge(edgeA, high)])),
    '322afec5e32a48d3ab373c0b7efbf614bda7cf391d01b726a72c64c753fc5e10');
  assert.equal(hex(contentNodeId(warp, nodeType, atomType, atom,
    [new OutgoingEdge(edgeB, low), new OutgoingEdge(edgeA, high)])),
  'b64b6a4157a7a819c217a9e39a927ce71d13aeeb6d161b4ad266e3489036c6af');
  assert.equal(hex(contentEdgeId(warp, low, edgeA, high)), '76c81ad538b8c6e18a6a93039137a13ad7dc6608d6ba3ce895634fc004787117');
  assert.equal(hex(slotEdgeId(warp, low, edgeA)), 'bd913d145bb0da61dc572cf56a5a4abd442bf295b7020c32aa1de85a3dd70aa2');
});

test('the canonical decoder rejects non-canonical, trailing and duplicate encodings', () => {
  // Oracle: edict.canonical-cbor/v1 rules (shortest heads, sorted unique keys, one value).
  const rejects = [Uint8Array.of(0x18, 0x05), Uint8Array.of(0x00, 0x00),
    Uint8Array.of(0xa2, 0x61, 0x62, 0x00, 0x61, 0x61, 0x00), Uint8Array.of(0xa2, 0x61, 0x61, 0x00, 0x61, 0x61, 0x01)];
  for (const bytes of rejects) assert.throws(() => decodeCanonicalCbor(bytes), undefined, hex(bytes));
  assert.doesNotThrow(() => decodeCanonicalCbor(Uint8Array.of(0xa2, 0x61, 0x61, 0x00, 0x61, 0x62, 0x00)));
});

test('the retained schema-1 oracle bytes are unchanged and pinned by the artifact', () => {
  checkOracleUnchanged(oracleBytes, artifact, RETAINED_ORACLE_SHA256);
  assert.throws(() => checkOracleUnchanged(Buffer.concat([oracleBytes, Buffer.from(' ')]), artifact,
    RETAINED_ORACLE_SHA256), /oracle-unchanged/);
});

test('the register covers every retained id exactly once with DL-0159\'s mapping; additions only supplement', () => {
  checkRegister(artifact, oracle, MAPPING);
  assert.equal(artifact.rows.length, 40);
  assert.ok(artifact.additions.length > 0);
  assert.throws(() => checkRegister(mutated((copy) => copy.rows.pop()), oracle, MAPPING), /register/);
  assert.throws(() => checkRegister(mutated((copy) => { copy.rows[0].mapping = 'counterpart'; }), oracle, MAPPING),
    /register/);
  assert.throws(() => checkRegister(mutated((copy) => { copy.rows[3].status = 'passing'; }), oracle, MAPPING),
    /register/);
  assert.throws(() => checkRegister(mutated((copy) => { copy.additions[0].id = copy.rows[1].id; }), oracle, MAPPING),
    /register/);
  assert.throws(() => checkRegister(mutated((copy) => { row(copy, 'out-of-bounds-range').invocation.endByte = '3'; }),
    oracle, MAPPING), /register/);
});

test('every obstructed row binds the retained semanticCode, a typed outcome, its boundary and precedence', () => {
  checkOutcomeBindings(artifact, oracle);
  const obstructed = artifact.rows.filter((entry) => entry.expected.posture === 'obstructed');
  assert.equal(obstructed.length, 34);
  assert.throws(() => checkOutcomeBindings(mutated((copy) => {
    row(copy, 'stale-basis').retainedSemanticCode = 'generic-refusal';
  }), oracle), /outcome-binding/);
  assert.throws(() => checkOutcomeBindings(mutated((copy) => {
    row(copy, 'branch-truncated-no-op-mask').expected.precedence.competing = ['basis'];
  }), oracle), /outcome-binding/);
  assert.throws(() => checkOutcomeBindings(mutated((copy) => {
    row(copy, 'reversed-range').expected.decidingCheck = 'somewhere';
  }), oracle), /outcome-binding/);
});

test('every content id is its ContentAddressV1 address or a witnessed non-bridge injection', () => {
  checkIdentities(artifact);
  const injected = [...artifact.rows, ...artifact.additions].filter((entry) => entry.admissionWitnesses.length > 0);
  assert.deepEqual(injected.map((entry) => entry.id), ['bad-blob-content-hash', 'cyclic-right-endpoint']);
  for (const entry of injected) {
    assert.ok(entry.admissionWitnesses.every((witness) => witness.expectedOutcome === 'IdentityLawViolation'));
  }
  assert.throws(() => checkIdentities(mutated((copy) => { row(copy, 'cyclic-right-endpoint').admissionWitnesses = []; })),
    /identity/);
  assert.throws(() => checkIdentities(mutated((copy) => { row(copy, 'empty-no-op').basis.buffers[0].key = 'other'; })),
    /identity/);
  assert.throws(() => checkIdentities(mutated((copy) => { copy.profile.edgeTypes.left.label = 'jedit.text.lft'; })),
    /identity/);
  assert.throws(() => checkIdentities(mutated((copy) => {
    const node = row(copy, 'middle-ascii-insert').expected.createdNodes[0];
    node.atomHex = `${node.atomHex.slice(0, -2)}00`;
  })), /identity/);
});

test('cbor-x decodes every declared atom to exactly its declared fact', () => {
  checkAtoms(artifact);
  assert.throws(() => checkAtoms(mutated((copy) => { row(copy, 'whole-buffer-delete').basis.nodes[0].fact = { x: '1' }; })),
    /atoms/);
});

test('committed rows rebuild into a lawful rope with the retained text, sharing and canonical effects', () => {
  checkCommitted(artifact, oracle);
  assert.equal(artifact.rows.filter((entry) => entry.expected.posture === 'committed').length, 6);
  assert.throws(() => checkCommitted(mutated((copy) => { row(copy, 'middle-ascii-insert').text.afterHex = '00'; }),
    oracle), /committed/);
  assert.throws(() => checkCommitted(mutated((copy) => { row(copy, 'cross-leaf-rebalance').expected.effects.reverse(); }),
    oracle), /committed/);
  assert.throws(() => checkCommitted(mutated((copy) => {
    row(copy, 'unicode-replacement').text.mustShareHex.push('aaaa');
  }), oracle), /committed/);
});

test('text equality, generic refusal, resource refusal or a Reference pass never satisfies a persistent row', () => {
  for (const entry of [...artifact.rows, ...artifact.additions]) {
    const exact = exactObservation(entry);
    assert.deepEqual(unmetReasons(entry, exact), [], `${entry.id}: the exact observation is the only pass`);
    const refusal = { target: 'persistent-rope', executed: true, evidence: exact.evidence, posture: 'refused' };
    const resource = { ...refusal, posture: 'obstructed', typedOutcome: 'ResourceLimitExceeded', decidingCheck: 'envelope' };
    const textOnly = { ...refusal, posture: entry.expected.posture, textAfterHex: entry.text?.afterHex };
    for (const observation of [refusal, resource, textOnly, { ...exact, target: 'reference' }, { ...exact, executed: false }]) {
      assert.notDeepEqual(unmetReasons(entry, observation), [], `${entry.id} accepted ${JSON.stringify(observation).slice(0, 80)}`);
    }
  }
});

test('the artifact regenerates byte for byte from its hand-written rows', () => {
  // Oracle class 5 (change detection): any diff here is reviewed, never re-blessed in bulk.
  const result = spawnSync(process.execPath, [path.join(TOOLING, 'generate.mts'), '--check'], { cwd: ROOT, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
});

test('the fixture tooling type-checks under the repository compiler options', () => {
  const result = spawnSync(process.execPath, [path.join(ROOT, 'node_modules/typescript/bin/tsc'), '-p',
    path.join(TOOLING, 'tsconfig.json')], { cwd: ROOT, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stdout + result.stderr);
});

test('fixture tooling imports no planner, runtime or authored source, and the validator no builder', () => {
  // Oracle: #389 requires expectations independent of the native planner and of the code they will judge.
  const imports = (file) => [...readFileSync(path.join(TOOLING, file), 'utf8').matchAll(/from '([^']+)'/g)]
    .map((match) => match[1]);
  const files = readdirSync(TOOLING).filter((file) => /\.m[jt]s$/.test(file));
  assert.ok(files.length > 10);
  for (const file of files) {
    for (const specifier of imports(file)) {
      assert.match(specifier, /^(?:\.\/[a-z0-9-]+\.m[jt]s|node:[a-z]+|cbor-x)$/, `${file} imports ${specifier}`);
    }
  }
  const independent = ['validate-artifact.mjs', 'validate-committed.mjs', 'judge.mjs'];
  const allowed = new Set(['./content-address-v1.mts', './blake3.mts', './validate-committed.mjs']);
  for (const file of independent) {
    for (const specifier of imports(file).filter((entry) => entry.startsWith('./'))) {
      assert.ok(allowed.has(specifier), `${file} must not import ${specifier}`);
    }
  }
});
