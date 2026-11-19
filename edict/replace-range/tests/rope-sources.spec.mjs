import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { octetsSource } from './octets-source.mjs';
import { pinnedRopeSources, ropeModules, ropeSourceRoot } from './rope-modules.mjs';

function checkedIn(file) {
  return readFileSync(path.join(ropeSourceRoot, file), 'utf8');
}

test('the octet tables are exactly the generated source', () => {
  assert.equal(checkedIn('Octets.edict'), octetsSource());
});

test('every rope module import is pinned to its dependency digest', () => {
  for (const [file, pinned] of pinnedRopeSources()) {
    assert.equal(checkedIn(file), pinned, `${file} carries a stale module pin`);
  }
});

test('every rope module declares the coordinate the closure names', () => {
  for (const { file, coordinate } of ropeModules) {
    assert.match(checkedIn(file), new RegExp(`^(?://.*\\n)*package ${coordinate.replace(/[.@]/g, '\\$&')};`));
  }
});

const FIXTURES = path.join(ropeSourceRoot, '..', '..', '..', '..', 'contracts', 'jedit', 'acceptance',
  'replace-range-schema-2', 'replace-range-schema-2.fixtures.json');

function declaredIds(source) {
  const ids = new Map();
  for (const [, name, bytes] of source.matchAll(/fn (\w+)\(\) -> Id \{ return b"((?:\\x[0-9a-f]{2}){32})"; \}/g)) {
    ids.set(name, bytes.replaceAll('\\x', ''));
  }
  return ids;
}

test('every identity type id is the fixture profile id for its label', () => {
  const { profile } = JSON.parse(readFileSync(FIXTURES, 'utf8'));
  const ids = declaredIds(checkedIn('Identity.edict'));
  const expected = new Map();
  for (const kind of ['Buffer', 'Head', 'Branch', 'Leaf']) {
    const stem = kind[0].toLowerCase() + kind.slice(1);
    expected.set(`${stem}Type`, profile.nodeTypes[kind].id);
    expected.set(`${stem}AtomType`, profile.atomTypes[kind].id);
  }
  for (const edge of ['canonicalHead', 'root', 'anchor', 'left', 'right']) {
    expected.set(`${edge}Edge`, profile.edgeTypes[edge].id);
  }
  assert.deepEqual(new Map([...ids].sort()), new Map([...expected].sort()));
});

test('the jedit.text@2 lawpacks are exactly the generated documents', async () => {
  const { basisReadLawpackText, ropeLawpackText } = await import('./rope-lawpack.mjs');
  const rope = (file) => readFileSync(path.join(ropeSourceRoot, '..', file), 'utf8');
  assert.equal(rope('edict.lawpack.json'), ropeLawpackText());
  assert.equal(rope('basis-read.lawpack.json'), basisReadLawpackText());
});

// A branch's outgoing edge set (left and right) is a schema fact, not an envelope limit.
const BRANCH_EDGES = 2;
// A Head closure follows the root, left and right edge types.
const CLOSURE_EDGE_TYPES = 3;

test('every fold and list bound in the rope source is an envelope constant', async () => {
  const { envelope } = await import('./rope-lawpack.mjs');
  const height = envelope.maxWorkHeight;
  const allowedFolds = new Set([height + 1, 2 * height + 2, envelope.maxNoOpLeaves, envelope.maxFreshNodes, envelope.maxCreatedLeaves,
    envelope.maxCreatedBranches, envelope.maxEmittedNodes,
    envelope.maxArenaNodes]);
  const allowedLists = new Set([height, envelope.maxArenaNodes, envelope.maxFreshNodes, envelope.maxClosureNodes, envelope.maxClosureOccurrences,
    envelope.maxClosureEdges, BRANCH_EDGES, CLOSURE_EDGE_TYPES, envelope.maxCreatedLeaves,
    envelope.maxCreatedBranches, envelope.maxEmittedNodes, 256]);
  for (const { file } of ropeModules) {
    const source = checkedIn(file);
    for (const [, bound] of source.matchAll(/fold\([^;]*?, (\d+)u64\)/g)) {
      assert.ok(allowedFolds.has(Number(bound)), `${file} folds ${bound} times`);
    }
    for (const [, bound] of source.matchAll(/, max=(\d+)>/g)) {
      assert.ok(allowedLists.has(Number(bound)), `${file} bounds a list at ${bound}`);
    }
  }
});

test('every rope module targets the echo.dpo@2 profile the lawpack adapter pins', () => {
  const pins = JSON.parse(readFileSync(path.join(ropeSourceRoot, '..', 'echo-dpo-2-profile.json'), 'utf8'));
  for (const { file } of ropeModules) {
    for (const [, id, digest] of checkedIn(file).matchAll(/^use target (\S+) digest "([^"]+)" as /gm)) {
      assert.equal(id, pins.profile.id, `${file} targets ${id}`);
      assert.equal(digest, pins.profile.digest, `${file} pins a stale ${id} digest`);
    }
  }
});

test('the intent bumps Buffer.version against the digest of the atom it read', () => {
  const intent = checkedIn('ReplaceRange.edict');
  assert.match(intent, /echo\.attachmentValueDigest\(ids\.bufferAtomType\(\), bufferAtom\)/);
  assert.match(intent, /text\.replaceAtom\(/);
  assert.match(intent, /version: \w+/);
});

const lawpackDocument = () => JSON.parse(readFileSync(path.join(ropeSourceRoot, '..', 'edict.lawpack.json'), 'utf8'));

test('every declared read failure carries the authority class of the Echo failure it maps to', async () => {
  const { decode } = await import('cbor-x');
  const pins = JSON.parse(readFileSync(path.join(ropeSourceRoot, '..', 'echo-dpo-2-profile.json'), 'utf8'));
  const catalog = decode(Buffer.from(pins.intrinsicCatalogHex, 'hex'));
  const { lawpack } = lawpackDocument();
  const adapter = lawpack.targetAdapters[0];
  for (const effect of lawpack.exports.effects) {
    const binding = adapter.effectImplementations[effect.coordinate];
    const echoFailures = catalog.intrinsics[binding.targetIntrinsic].effectFailures ?? {};
    for (const [name, declared] of Object.entries(effect.effectFailures)) {
      const echoName = binding.failureMappings[name];
      assert.equal(declared.authorityClass, echoFailures[echoName].authorityClass, `${effect.coordinate}.${name}`);
    }
  }
});

test('every authored failure arm maps to an obstruction of the failure\'s authority class', () => {
  const { lawpack } = lawpackDocument();
  const obstructionClass = new Map(lawpack.exports.obstructions.map((item) => [item.coordinate.split('.').pop(), item.authorityClass]));
  const intent = checkedIn('ReplaceRange.edict');
  for (const [, effect, arms] of intent.matchAll(/text\.(\w+)\([^;]*?\)\s*else\s*\{([^}]*)\}/gs)) {
    const failures = lawpack.exports.effects.find((item) => item.coordinate.endsWith(`.${effect}`)).effectFailures;
    for (const [, failure, obstruction] of arms.matchAll(/(\w+)\(\w+\) => text\.(\w+)/g)) {
      assert.equal(obstructionClass.get(obstruction), failures[failure].authorityClass, `${effect}.${failure} => ${obstruction}`);
    }
  }
});

// Echo's effect-profile ceilings for a footprint law (authored-operation-effects.md, Footprint law).
const ECHO_LAW_CEILINGS = Object.freeze({ max_reads: 4096, max_writes: 256, max_range_edges: 65536 });

test('both lawpacks keep their footprint laws within Echo\'s ceilings', async () => {
  const { decode } = await import('cbor-x');
  for (const file of ['edict.lawpack.json', 'basis-read.lawpack.json']) {
    const { lawpack } = JSON.parse(readFileSync(path.join(ropeSourceRoot, '..', file), 'utf8'));
    const config = lawpack.localResources.find((item) => item.name === 'echo-config').value;
    const law = decode(Buffer.from(config.footprintLaw.$edictBytes, 'hex'));
    for (const [count, ceiling] of Object.entries(ECHO_LAW_CEILINGS)) {
      assert.ok(law[count] <= ceiling, `${file} ${count} ${law[count]} > ${ceiling}`);
    }
  }
});
