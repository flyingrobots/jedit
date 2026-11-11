// SPDX-License-Identifier: Apache-2.0 OR LicenseRef-MIND-UCAL-1.0
// © James Ross Ω FLYING•ROBOTS <https://github.com/flyingrobots>
// Schema-2-only rows. They supplement the 40 retained ids and replace none.
import { encodeFact, U64_MAX } from './schema-2-facts.mts';
import { repeat, utf8 } from './fixture-basis.mts';
import { branch, buffer, claims, ExpectCommitted, ExpectObstructed, head, invoke, leaf, RowSpec } from './row-spec.mts';

/** Distinct, deterministic ASCII so constructed leaves never share content. */
function alphabet(length: number): Uint8Array {
  return Uint8Array.from({ length }, (_, index) => 0x61 + (index % 26));
}

function addition(id: string, obligation: string, decision?: string): { id: string; mapping: 'addition';
  obligation: string; decision?: string } {
  return decision === undefined ? { id, mapping: 'addition', obligation } : { id, mapping: 'addition', obligation, decision };
}

/** Leaf sizes fromBytes must produce, worked by hand: halve at the boundary at or before the middle. */
const CONSTRUCTOR_LEAVES: ReadonlyMap<number, readonly number[]> = new Map([
  [4097, [2048, 2049]], [8193, [4096, 2048, 2049]], [8194, [2048, 2049, 2048, 2049]]]);

const SHARED_LEAF = leaf('a');

export const ADDITION_ROWS: readonly RowSpec[] = [
  new RowSpec(addition('shared-head-two-buffers',
    'Positive shared Head: two Buffers share one content-identical Head; editing one leaves the other attached',
    'Both buffers import the same file, so their heads are one node. Sharing is valid; only the edited '
    + 'buffer\'s slot moves.'),
  [buffer('shared-head-left', head(leaf('shared'))),
    buffer('shared-head-right', head(leaf('shared')), { importFrom: 'shared-head-left' })],
  invoke(0n, 0n, 'x', { buffer: 'shared-head-left' }),
  new ExpectCommitted([utf8('shared'), utf8('xshared')], [7])),
  new RowSpec(addition('equal-leaf-second-position',
    '"aa" stored as one shared leaf; editing the second "a" addresses the second position'),
  [buffer('equal-leaf-second-position', head(branch(SHARED_LEAF, SHARED_LEAF)))],
  invoke(1n, 2n, 'b'),
  new ExpectCommitted([utf8('aa'), utf8('ab')], [1, 1], [utf8('a')])),
  new RowSpec(addition('equal-content-new-leaves',
    'Two equal new leaves: the proposal ensures one node, and both text positions remain'),
  [buffer('equal-content-new-leaves', head(null))],
  invoke(0n, 0n, repeat('z', 8192)),
  new ExpectCommitted([utf8(''), repeat('z', 8192)], [4096, 4096])),
  ...[4097, 8193, 8194].map((length) => new RowSpec(addition(`constructor-${length}-bytes`,
    `fromBytes over ${length} bytes: leaf and branch counts follow the constructor, not ceil(n / 4096)`),
  [buffer(`constructor-${length}-bytes`, head(null))],
  invoke(0n, 0n, alphabet(length)),
  new ExpectCommitted([utf8(''), alphabet(length)], CONSTRUCTOR_LEAVES.get(length)!))),
  new RowSpec(addition('invalid-utf8-replacement',
    'Invalid UTF-8 replacement bytes: typed outcome at the replacement check'),
  [buffer('invalid-utf8-replacement', head(leaf('abc')))],
  invoke(0n, 1n, Uint8Array.of(0xff)),
  new ExpectObstructed('ReplacementNotUtf8', 'replacement')),
  new RowSpec(addition('branch-missing-right-edge',
    'A branch stored without its right edge; its id is its true address, so admission allows it'),
  [buffer('branch-missing-right-edge', head(branch(leaf('ab'), leaf('cd'), { edges: [['left', leaf('ab')]] })))],
  invoke(0n, 1n, 'x'),
  new ExpectObstructed('MalformedRope', 'closure-validation')),
  new RowSpec(addition('branch-duplicate-left-edge',
    'A branch with two left edges to different targets; distinct edges, so admission allows it'),
  [buffer('branch-duplicate-left-edge', head(branch(leaf('ab'), leaf('cd'),
    { edges: [['left', leaf('ab')], ['left', leaf('zz')], ['right', leaf('cd')]] })))],
  invoke(0n, 1n, 'x'),
  new ExpectObstructed('MalformedRope', 'closure-validation')),
  new RowSpec(addition('branch-wrong-type-edge',
    'A branch whose second child hangs from a root-typed edge instead of right',
    'Marked bridge-admissible by identity alone; whether Echo\'s graph schema admits a Branch-to-root edge depends on '
    + 'the unpublished jedit.text@2 schema, which may refuse it earlier with SchemaViolation.'),
  [buffer('branch-wrong-type-edge', head(branch(leaf('ab'), leaf('cd'),
    { edges: [['left', leaf('ab')], ['root', leaf('cd')]] })))],
  invoke(0n, 1n, 'x'),
  new ExpectObstructed('MalformedRope', 'closure-validation')),
  new RowSpec(addition('branch-height-exceeds-u8',
    'Codec half of branch-height-u32-max-at-zero: a U32::MAX height does not decode as U8'),
  [buffer('branch-height-exceeds-u8', head(branch(leaf(repeat('a', 4096)), leaf('b'), {
    atom: encodeFact(new Map([['byteLength', 4097n], ['lineBreaks', 0n], ['height', 0xffff_ffffn]])),
    claims: claims({ height: 2n }) })))],
  invoke(0n, 0n, 'x'),
  new ExpectObstructed('FactMalformed', 'closure-validation')),
  new RowSpec(addition('malformed-closure-masks-no-op',
    'A malformed closure whose claimed bytes would make the edit a NoOp is still MalformedRope',
    'The retained no-op-mask rows cannot reach NoOp in schema 2 (their lengths differ). Here the replacement '
    + 'equals the bytes it replaces, so an implementation that checked no-op before validating would report NoOp.'),
  [buffer('malformed-closure-masks-no-op', head(branch(leaf(repeat('a', 4096)), leaf('b'),
    { claims: claims({ byteLength: 4098n }) })))],
  invoke(0n, 1n, 'a'),
  new ExpectObstructed('MalformedRope', 'closure-validation', ['no-op'])),
  new RowSpec(addition('empty-root-masks-no-op',
    'An empty root claiming one byte is MalformedRope even for an edit that is trivially NoOp',
    'An empty range with an empty replacement is NoOp on any valid rope; validation must come first.'),
  [buffer('empty-root-masks-no-op', head(null, { claims: claims({ byteLength: 1n }) }))],
  invoke(0n, 0n, ''),
  new ExpectObstructed('MalformedRope', 'closure-validation', ['no-op'])),
  new RowSpec(addition('new-head-line-count-overflow',
    'The edit\'s own new head: inserting a line break past U64::MAX lines is ArithmeticOverflow at counters',
    'An untouched sibling claims U64::MAX - 1 line breaks; the root and head agree with it, so validation passes.'),
  [buffer('new-head-line-count-overflow', head(branch(
    branch(leaf('a'), leaf('b'), { claims: claims({ lineBreaks: U64_MAX - 1n }) }), leaf('c'))))],
  invoke(3n, 3n, '\n'),
  new ExpectObstructed('ArithmeticOverflow', 'counters')),
  new RowSpec(addition('new-head-extent-overflow',
    'The edit\'s own new head: growing the text past U64::MAX bytes is ArithmeticOverflow at counters',
    'An untouched sibling claims U64::MAX - 1 bytes; the edit appends one byte at the claimed end.'),
  [buffer('new-head-extent-overflow', head(branch(
    branch(leaf('a'), leaf('b'), { claims: claims({ byteLength: U64_MAX - 1n }) }), leaf('c'))))],
  invoke(U64_MAX, U64_MAX, 'x'),
  new ExpectObstructed('ArithmeticOverflow', 'counters')),
  new RowSpec(addition('branch-extra-edge-type',
    'A branch whose id is its true address over left, right and an extra anchor edge',
    'Identity covers the complete edge set, so the id is lawful; the extra edge type breaks the rope shape.'),
  [buffer('branch-extra-edge-type', head(branch(leaf('ab'), leaf('cd'),
    { edges: [['left', leaf('ab')], ['right', leaf('cd')], ['anchor', leaf('zz')]] })))],
  invoke(0n, 1n, 'x'),
  new ExpectObstructed('MalformedRope', 'closure-validation')),
  new RowSpec(addition('leaf-with-edge',
    'A leaf whose id is its true address over one outgoing edge; leaves have none',
    'Identity covers the complete edge set, so the id is lawful; any leaf edge breaks the rope shape.'),
  [buffer('leaf-with-edge', head(branch(leaf('ab', { edges: [['left', leaf('zz')]] }), leaf('cd'))))],
  invoke(3n, 4n, 'x'),
  new ExpectObstructed('MalformedRope', 'closure-validation')),
  new RowSpec(addition('head-sequence-at-limit-no-op',
    'A NoOp at U64::MAX sequence is still NoOp: no-op precedes the counter checks',
    'Pins the order of the no-op and counter checks with a fixture that fails both.'),
  [buffer('head-sequence-at-limit-no-op', head(leaf('abc'), { claims: claims({ sequence: U64_MAX }) }))],
  invoke(1n, 1n, ''),
  new ExpectObstructed('NoOp', 'no-op', ['counters'])),
];
