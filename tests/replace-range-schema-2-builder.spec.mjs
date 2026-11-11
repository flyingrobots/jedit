// SPDX-License-Identifier: Apache-2.0 OR LicenseRef-MIND-UCAL-1.0
// © James Ross Ω FLYING•ROBOTS <https://github.com/flyingrobots>
// The schema-2 fixture builder refuses a row whose hand-written expectation
// disagrees with the specification model, so a typo in a row cannot be frozen.
import assert from 'node:assert/strict';
import test from 'node:test';
import { committedJson, FixtureInconsistency, obstructedJson, resolveInvocation }
  from './support/replace-range-schema-2/artifact-rows.mts';
import { Basis, utf8 } from './support/replace-range-schema-2/fixture-basis.mts';
import { ReplaceRangeModel } from './support/replace-range-schema-2/replace-range-model.mts';
import { buffer, ExpectCommitted, ExpectObstructed, head, invoke, leaf, RowSpec }
  from './support/replace-range-schema-2/row-spec.mts';

function render(row) {
  const basis = new Basis(row.buffers);
  const model = new ReplaceRangeModel(basis.graph, resolveInvocation(row, basis));
  return row.expected instanceof ExpectCommitted
    ? committedJson(row, row.expected, basis, model)
    : obstructedJson(row, row.expected, model);
}

function abcRow(range, replacement, expected) {
  return new RowSpec({ id: 'builder-probe', mapping: 'addition', obligation: 'builder refusal probe' },
    [buffer('builder-probe', head(leaf('abc')))], invoke(range[0], range[1], replacement), expected);
}

test('a row expecting the outcome the model reaches renders', () => {
  // Oracle: the declared check order puts range order before every state-dependent check.
  const rendered = render(abcRow([2n, 1n], 'x', new ExpectObstructed('RangeOrderInvalid', 'range-order')));
  assert.equal(rendered.typedOutcome, 'RangeOrderInvalid');
});

test('a row expecting a different outcome or boundary is refused', () => {
  assert.throws(() => render(abcRow([2n, 1n], 'x', new ExpectObstructed('NoOp', 'no-op'))), FixtureInconsistency);
  assert.throws(() => render(abcRow([2n, 1n], 'x', new ExpectObstructed('RangeOrderInvalid', 'basis'))),
    FixtureInconsistency);
});

test('a competing check that is not later than the deciding check is refused', () => {
  assert.throws(() => render(abcRow([1n, 1n], '', new ExpectObstructed('NoOp', 'no-op', ['basis']))),
    FixtureInconsistency);
});

test('a committed row whose hand-written text disagrees with the model is refused', () => {
  // Oracle: "abc" with 0..1 replaced by "x" is "xbc", written by hand.
  assert.doesNotThrow(() => render(abcRow([0n, 1n], 'x', new ExpectCommitted(utf8('abc'), utf8('xbc')))));
  assert.throws(() => render(abcRow([0n, 1n], 'x', new ExpectCommitted(utf8('abc'), utf8('xabc')))),
    FixtureInconsistency);
  assert.throws(() => render(abcRow([0n, 1n], 'x', new ExpectCommitted(utf8('abc'), utf8('xbc'), [utf8('abc')]))),
    FixtureInconsistency);
});
