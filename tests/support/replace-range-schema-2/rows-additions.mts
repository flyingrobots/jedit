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

const SHARED_LEAF = leaf('a');

export const ADDITION_ROWS: readonly RowSpec[] = [
  new RowSpec(addition('shared-head-two-buffers',
    'Positive shared Head: two Buffers share one content-identical Head; editing one leaves the other attached',
    'Both buffers import the same file, so their heads are one node. Sharing is valid; only the edited '
    + 'buffer\'s slot moves.'),
  [buffer('shared-head-left', head(leaf('shared'))),
    buffer('shared-head-right', head(leaf('shared')), { importFrom: 'shared-head-left' })],
  invoke(0n, 0n, 'x', { buffer: 'shared-head-left' }),
  new ExpectCommitted(utf8('shared'), utf8('xshared'))),
  new RowSpec(addition('equal-leaf-second-position',
    '"aa" stored as one shared leaf; editing the second "a" addresses the second position'),
  [buffer('equal-leaf-second-position', head(branch(SHARED_LEAF, SHARED_LEAF)))],
  invoke(1n, 2n, 'b'),
  new ExpectCommitted(utf8('aa'), utf8('ab'), [utf8('a')])),
  new RowSpec(addition('equal-content-new-leaves',
    'Two equal new leaves: the proposal ensures one node, and both text positions remain'),
  [buffer('equal-content-new-leaves', head(null))],
  invoke(0n, 0n, repeat('z', 8192)),
  new ExpectCommitted(utf8(''), repeat('z', 8192))),
  ...[4097, 8193, 8194].map((length) => new RowSpec(addition(`constructor-${length}-bytes`,
    `fromBytes over ${length} bytes: leaf and branch counts follow the constructor, not ceil(n / 4096)`),
  [buffer(`constructor-${length}-bytes`, head(null))],
  invoke(0n, 0n, alphabet(length)),
  new ExpectCommitted(utf8(''), alphabet(length)))),
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
    'A branch whose second child hangs from a root-typed edge instead of right'),
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
  new RowSpec(addition('head-sequence-at-limit-no-op',
    'A NoOp at U64::MAX sequence is still NoOp: no-op precedes the counter checks',
    'Pins the order of the no-op and counter checks with a fixture that fails both.'),
  [buffer('head-sequence-at-limit-no-op', head(leaf('abc'), { claims: claims({ sequence: U64_MAX }) }))],
  invoke(1n, 1n, ''),
  new ExpectObstructed('NoOp', 'no-op', ['counters'])),
];
