// SPDX-License-Identifier: Apache-2.0 OR LicenseRef-MIND-UCAL-1.0
// © James Ross Ω FLYING•ROBOTS <https://github.com/flyingrobots>
// The schema-2 fixture builder refuses a row whose hand-written expectation
// disagrees with the specification model, so a typo in a row cannot be frozen.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { committedJson, FixtureInconsistency, obstructedJson, resolveInvocation }
  from './support/replace-range-schema-2/artifact-rows.mts';
import { Basis, repeat, utf8 } from './support/replace-range-schema-2/fixture-basis.mts';
import { ReplaceRangeModel } from './support/replace-range-schema-2/replace-range-model.mts';
import { ARTIFACT_PATH, renderArtifact } from './support/replace-range-schema-2/generate.mts';
import { edgeTypeId } from './support/replace-range-schema-2/schema-2-facts.mts';
import { ADDITION_ROWS } from './support/replace-range-schema-2/rows-additions.mts';
import { contentEdgeId, contentNodeId, hex, slotEdgeId } from './support/replace-range-schema-2/content-address-v1.mts';
import { branch, buffer, claims, ExpectCommitted, ExpectObstructed, head, invoke, leaf, RowSpec }
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
  assert.doesNotThrow(() => render(abcRow([0n, 1n], 'x', new ExpectCommitted([utf8('abc'), utf8('xbc')], [3]))));
  assert.throws(() => render(abcRow([0n, 1n], 'x', new ExpectCommitted([utf8('abc'), utf8('xabc')], [4]))),
    FixtureInconsistency);
  assert.throws(() => render(abcRow([0n, 1n], 'x', new ExpectCommitted([utf8('abc'), utf8('xbc')], [1, 2]))),
    FixtureInconsistency);
  assert.throws(() => render(abcRow([0n, 1n], 'x', new ExpectCommitted([utf8('abc'), utf8('xbc')], [3], [utf8('abc')]))),
    FixtureInconsistency);
});

/** Deterministic linear congruential generator; the seed is printed on failure. */
function generator(seed) {
  let state = seed;
  return (bound) => {
    // Exact 32-bit arithmetic; the low bits of an LCG cycle quickly, so draw from the high bits.
    state = (Math.imul(state, 1103515245) + 12345) >>> 0;
    return (state >>> 16) % bound;
  };
}

function balanced(texts, corrupt, counter) {
  if (texts.length === 1) return leaf(texts[0]);
  const middle = Math.ceil(texts.length / 2);
  const left = balanced(texts.slice(0, middle), corrupt, counter);
  const right = balanced(texts.slice(middle), corrupt, counter);
  const index = counter.next;
  counter.next += 1;
  const length = BigInt(texts.join('').length) + 1n;
  return index === corrupt ? branch(left, right, { claims: claims({ byteLength: length }) }) : branch(left, right);
}

test('every node the operation resolves is read before any endpoint is classified', () => {
  // Oracle: the declared check order; closure validation must finish before character-boundary, no-op and counters.
  const seed = 389;
  const random = generator(seed);
  for (let iteration = 0; iteration < 1500; iteration += 1) {
    const texts = Array.from({ length: 4 + random(10) }, () => 'abcdefgh'.slice(0, 1 + random(8)));
    const corrupt = random(texts.length * 2) - 1;
    const length = texts.join('').length;
    const [a, b] = [random(length + 1), random(length + 1)];
    const row = new RowSpec({ id: 'probe', mapping: 'addition', obligation: 'probe' },
      [buffer('probe', head(balanced(texts, corrupt, { next: 0 })))],
      invoke(BigInt(Math.min(a, b)), BigInt(Math.max(a, b)), 'xyz'.slice(0, random(4))),
      new ExpectObstructed('NoOp', 'no-op'));
    const basis = new Basis(row.buffers);
    const model = new ReplaceRangeModel(basis.graph, resolveInvocation(row, basis));
    model.run();
    if (model.readsAtClassification === null) continue;
    assert.deepEqual([model.view.nodeReads.size, model.view.rangeReads.size], model.readsAtClassification,
      `seed ${seed} iteration ${iteration}: a node was resolved after endpoint classification`);
  }
});

test('a competing check is accepted only when removing the deciding check reaches it', () => {
  assert.doesNotThrow(() => render(abcRow([1n, 1n], '', new ExpectObstructed('NoOp', 'no-op'))));
  const emoji = new RowSpec({ id: 'builder-probe', mapping: 'addition', obligation: 'probe' },
    [buffer('builder-probe', head(leaf('A😀B')))], invoke(2n, 2n, ''), undefined);
  const expect = (competing) => new RowSpec({ id: 'builder-probe', mapping: 'addition', obligation: 'probe' },
    emoji.buffers, emoji.invocation, new ExpectObstructed('Utf8BoundaryInvalid', 'character-boundary', competing));
  assert.doesNotThrow(() => render(expect(['no-op'])));
  assert.throws(() => render(expect(['counters'])), FixtureInconsistency);
});

test('the committed artifact is exactly what the rows render', () => {
  // Oracle class 5 (change detection): any diff is reviewed, never re-blessed in bulk.
  const root = process.cwd();
  const rendered = renderArtifact(root);
  assert.equal(readFileSync(path.join(root, ARTIFACT_PATH), 'utf8'), rendered);
  assert.equal(readFileSync(path.join(root, ARTIFACT_PATH.replace(/\.json$/, '.sha256')), 'utf8'),
    `${createHash('sha256').update(rendered).digest('hex')}\n`);
});

test('malformed closures that would otherwise be NoOp are rejected by closure validation', () => {
  // Oracle: the declared order puts closure validation before no-op; each honest twin of the basis is NoOp.
  const honest = new Map([
    ['malformed-closure-masks-no-op', head(branch(leaf(repeat('a', 4096)), leaf('b')))],
    ['empty-root-masks-no-op', head(null)],
  ]);
  for (const [id, honestHead] of honest) {
    const masked = ADDITION_ROWS.find((entry) => entry.id === id);
    assert.ok(masked !== undefined, `${id} is an addition`);
    assert.equal(render(masked).typedOutcome, 'MalformedRope', id);
    const twin = new RowSpec({ id: `${id}-twin`, mapping: 'addition', obligation: 'twin' }, [buffer(id, honestHead)],
      masked.invocation, new ExpectObstructed('NoOp', 'no-op'));
    assert.equal(render(twin).typedOutcome, 'NoOp', `${id} twin`);
  }
});

const U64_MAX = 0xffff_ffff_ffff_ffffn;

function probe(tree, range, replacement, expected) {
  return render(new RowSpec({ id: 'builder-probe', mapping: 'addition', obligation: 'probe' },
    [buffer('builder-probe', head(tree))], invoke(range[0], range[1], replacement), expected));
}

test('the new head\'s line count and extent are checked at the counters step', () => {
  // Oracle: DL-0159 checked arithmetic; the declared order puts the result's counters after no-op.
  const manyBreaks = branch(branch(leaf('a'), leaf('b'), { claims: claims({ lineBreaks: U64_MAX - 1n }) }), leaf('c'));
  assert.equal(probe(manyBreaks, [3n, 3n], '\n', new ExpectObstructed('ArithmeticOverflow', 'counters')).decidingCheck,
    'counters');
  const manyBytes = branch(branch(leaf('a'), leaf('b'), { claims: claims({ byteLength: U64_MAX - 1n }) }), leaf('c'));
  assert.equal(probe(manyBytes, [U64_MAX, U64_MAX], 'x', new ExpectObstructed('ArithmeticOverflow', 'counters'))
    .decidingCheck, 'counters');
});

test('identity is computed over every outgoing edge; an unexpected edge type is MalformedRope', () => {
  // Oracle: Echo ContentAddressV1 hashes a content node's complete outgoing edge set.
  const extra = branch(leaf('ab'), leaf('cd'), { edges: [['left', leaf('ab')], ['right', leaf('cd')], ['anchor', leaf('zz')]] });
  assert.equal(probe(extra, [0n, 1n], 'x', new ExpectObstructed('MalformedRope', 'closure-validation')).typedOutcome,
    'MalformedRope');
  const leafWithEdge = leaf('ab', { edges: [['left', leaf('zz')]] });
  assert.equal(probe(branch(leafWithEdge, leaf('cd')), [3n, 4n], 'x',
    new ExpectObstructed('MalformedRope', 'closure-validation')).typedOutcome, 'MalformedRope');
});

test('the NoOp-masking additions declare no-op as a verified competing check', () => {
  for (const id of ['malformed-closure-masks-no-op', 'empty-root-masks-no-op']) {
    const masked = ADDITION_ROWS.find((entry) => entry.id === id);
    assert.deepEqual(masked.expected.competing, ['no-op'], id);
    assert.deepEqual(render(masked).precedence.competing, ['no-op'], id);
  }
});

test('a row must declare every competing check the model reaches with the deciding check passed', () => {
  const malformed = branch(leaf('A😀'), leaf('b'), { claims: claims({ byteLength: 7n }) });
  assert.throws(() => probe(malformed, [2n, 2n], 'x', new ExpectObstructed('MalformedRope', 'closure-validation')),
    FixtureInconsistency);
  assert.equal(probe(malformed, [2n, 2n], 'x', new ExpectObstructed('MalformedRope', 'closure-validation',
    ['character-boundary'])).precedence.competing[0], 'character-boundary');
});

test('content-address helpers refuse ids that are not 32 bytes', () => {
  const id = new Uint8Array(32);
  assert.throws(() => contentEdgeId(new Uint8Array(31), id, id, id), RangeError);
  assert.throws(() => slotEdgeId(id, new Uint8Array(33), id), RangeError);
  assert.throws(() => contentNodeId(id, id, new Uint8Array(0), new Uint8Array(), []), RangeError);
});

test('a self edge without a stored-id override is an explicit authoring error', () => {
  assert.throws(() => new Basis([buffer('self-probe', head(branch(leaf('a'), 'self')))]), /self edge needs an id override/);
});

test('expansion reads every edge type and both child records before rejecting anything', () => {
  // Oracle: DL-0163 read profile; a fault found early must not shorten the declared read set.
  const wrongType = branch(leaf('ab'), leaf('cd'), { edges: [['left', leaf('ab')], ['root', leaf('cd')]] });
  const basis = new Basis([buffer('read-probe', head(wrongType))]);
  const row = new RowSpec({ id: 'read-probe', mapping: 'addition', obligation: 'probe' }, [buffer('read-probe', head(wrongType))],
    invoke(0n, 1n, 'x'), new ExpectObstructed('MalformedRope', 'closure-validation'));
  const model = new ReplaceRangeModel(basis.graph, resolveInvocation(row, basis));
  model.run();
  const ranges = [...model.view.rangeReads.values()].map((range) => range.from);
  const headId = basis.buffers.get('read-probe').canonicalHead;
  const rootId = basis.graph.outgoing(headId, edgeTypeId('root'))[0].to;
  for (const edge of basis.graph.allOutgoing(rootId)) {
    assert.ok(model.view.nodeReads.has(hex(edge.to)), 'both child records are read');
  }
  const counts = new Map();
  for (const from of ranges) counts.set(from, (counts.get(from) ?? 0) + 1);
  assert.ok([...counts.values()].some((count) => count === 6), 'some node had all six edge types read');
  assert.ok([...counts.values()].every((count) => count === 6 || count === 1), JSON.stringify([...counts.values()]));
});
