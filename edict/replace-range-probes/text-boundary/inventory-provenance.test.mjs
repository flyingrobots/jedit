// SPDX-License-Identifier: Apache-2.0 OR LicenseRef-MIND-UCAL-1.0
// © James Ross Ω FLYING•ROBOTS <https://github.com/flyingrobots>
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { inventoryProvenance } from './inventory-provenance.mjs';
const report = name => JSON.parse(readFileSync(new URL(`../compiler-inventory/${name}`, import.meta.url)));

test('current inventory keeps its observed Echo checkout identity', () => {
  const current = report('current-source-modules.json');
  assert.deepEqual(inventoryProvenance(current), {
    compilerCommit: current.compilerCommit, echoCheckoutCommit: current.echoCheckoutCommit,
  });
});
test('historical inventory normalizes the captured checkout label without changing the report', () => {
  const historical = report('candidate-boundary-drafts.json');
  const original = JSON.stringify(historical);
  assert.deepEqual(inventoryProvenance(historical), {
    compilerCommit: historical.compilerCommit, echoCheckoutCommit: historical.echoCommit,
  });
  assert.equal(JSON.stringify(historical), original);
});
test('missing, malformed or contradictory checkout identities refuse', () => {
  const current = report('current-source-modules.json');
  for (const mutation of [
    { compilerCommit: undefined }, { compilerCommit: 'invalid' },
    { echoCheckoutCommit: undefined }, { echoCheckoutCommit: 'invalid' },
    { echoCommit: '0'.repeat(40) },
  ]) assert.throws(() => inventoryProvenance({ ...current, ...mutation }), /inventory provenance/);
});
