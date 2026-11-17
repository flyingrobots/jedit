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
