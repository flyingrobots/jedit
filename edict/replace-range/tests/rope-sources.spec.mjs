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
