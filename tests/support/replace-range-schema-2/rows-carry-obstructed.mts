// SPDX-License-Identifier: Apache-2.0 OR LicenseRef-MIND-UCAL-1.0
// © James Ross Ω FLYING•ROBOTS <https://github.com/flyingrobots>
// The 22 retained obstructed cases DL-0159 maps as carry. Each names the
// retained semanticCode, the schema-2 outcome, its deciding check and, where
// the fixture is built to trip a later check too, that competing check.
import { repeat, utf8 } from './fixture-basis.mts';
import { branch, buffer, claims, ExpectObstructed, head, invoke, leaf, RowSpec } from './row-spec.mts';
import { U64_MAX } from './schema-2-facts.mts';

const ABC = (): ReturnType<typeof head> => head(leaf('abc'));
const EMOJI = (): ReturnType<typeof head> => head(leaf('A😀B'));
/** "a"×4096 then "b", whose root claims 4,098 bytes: the stored children hold 4,097. */
const EXTENT_MISMATCH = (): ReturnType<typeof head> =>
  head(branch(leaf(repeat('a', 4096)), leaf('b'), { claims: claims({ byteLength: 4098n }) }));
const OVERSIZED = (): ReturnType<typeof head> => head(null, { claims: claims({ byteLength: 1n }) });
const TWO_TO_31 = 2n ** 31n;

function obstructed(id: string, semanticCode: string, obligation: string, decision?: string): { id: string;
  mapping: 'carry'; semanticCode: string; obligation: string; decision?: string } {
  return decision === undefined ? { id, mapping: 'carry', semanticCode, obligation }
    : { id, mapping: 'carry', semanticCode, obligation, decision };
}

const EXTENT_DECISION = 'Schema 1 reported a branch whose children disagree with its claimed extent as a malformed fact. '
  + 'Schema 2 decodes that atom successfully; the disagreement is a rope invariant, so the typed outcome is '
  + 'MalformedRope at closure validation. The row stays carry: the obligation is unchanged.';
const MASK_DECISION = 'Schema 2 compares a replacement with the replaced bytes only when their lengths are equal, so '
  + 'this fixture cannot reach NoOp; the obligation holds because closure validation rejects the rope first.';

export const CARRY_OBSTRUCTED_ROWS: readonly RowSpec[] = [
  new RowSpec(obstructed('reversed-range', 'range-order-invalid', 'Range-order obstruction; no graph mutation'),
    [buffer('reversed-range', ABC())], invoke(2n, 1n, 'x'),
    new ExpectObstructed('RangeOrderInvalid', 'range-order')),
  new RowSpec(obstructed('out-of-bounds-range', 'range-out-of-bounds', 'Out-of-bounds obstruction; no graph mutation'),
    [buffer('out-of-bounds-range', ABC())], invoke(0n, 4n, 'x'),
    new ExpectObstructed('RangeOutOfBounds', 'range-bounds')),
  new RowSpec(obstructed('start-inside-codepoint', 'utf8-boundary-invalid', 'Reject a start offset inside a code point'),
    [buffer('start-inside-codepoint', EMOJI())], invoke(2n, 5n, 'x'),
    new ExpectObstructed('Utf8BoundaryInvalid', 'character-boundary')),
  new RowSpec(obstructed('end-inside-codepoint', 'utf8-boundary-invalid', 'Reject an end offset inside a code point'),
    [buffer('end-inside-codepoint', EMOJI())], invoke(1n, 4n, 'x'),
    new ExpectObstructed('Utf8BoundaryInvalid', 'character-boundary')),
  new RowSpec(obstructed('empty-range-inside-codepoint', 'utf8-boundary-invalid',
    'Reject even an empty range inside a code point'),
  [buffer('empty-range-inside-codepoint', EMOJI())], invoke(2n, 2n, ''),
  new ExpectObstructed('Utf8BoundaryInvalid', 'character-boundary', ['no-op'])),
  new RowSpec(obstructed('empty-no-op', 'no-op', 'NoOp; no graph mutation or successful edit receipt'),
    [buffer('empty-no-op', ABC())], invoke(1n, 1n, ''),
    new ExpectObstructed('NoOp', 'no-op')),
  new RowSpec(obstructed('identical-no-op', 'no-op', 'Byte-identical replacement is NoOp, not an edit'),
    [buffer('identical-no-op', ABC())], invoke(0n, 3n, 'abc'),
    new ExpectObstructed('NoOp', 'no-op')),
  new RowSpec(obstructed('stale-basis', 'basis-not-canonical',
    'Canonical-head comparison rejects a stale basis atomically'),
  [buffer('stale-basis', head(branch(leaf('fresh-'), leaf('abc')), { claims: claims({ sequence: 1n }) }),
    { version: 1n, otherHeads: [ABC()], importText: utf8('abc') })],
  invoke(0n, 1n, 'x', { basis: { other: 0 } }),
  new ExpectObstructed('BasisNotCanonical', 'basis')),
  new RowSpec(obstructed('foreign-basis', 'basis-not-canonical',
    'Reject a basis id unequal to the named Buffer\'s canonical target; use a distinct-id foreign fixture'),
  [buffer('foreign-basis', ABC()), buffer('foreign-basis-other', head(leaf('foreign')))],
  invoke(0n, 1n, 'x', { buffer: 'foreign-basis', basis: { canonicalOf: 'foreign-basis-other' } }),
  new ExpectObstructed('BasisNotCanonical', 'basis')),
  new RowSpec(obstructed('head-sequence-overflow', 'arithmetic-overflow',
    'Checked head sequence; no partial effects on overflow'),
  [buffer('head-sequence-overflow', head(leaf('abc'), { claims: claims({ sequence: U64_MAX }) }))],
  invoke(0n, 1n, 'x'),
  new ExpectObstructed('ArithmeticOverflow', 'counters')),
  new RowSpec(obstructed('buffer-version-overflow', 'arithmetic-overflow',
    'Checked buffer version; no partial effects on overflow'),
  [buffer('buffer-version-overflow', ABC(), { version: U64_MAX })], invoke(0n, 1n, 'x'),
  new ExpectObstructed('ArithmeticOverflow', 'counters')),
  new RowSpec(obstructed('missing-buffer', 'fact-missing', 'Missing required Buffer fact is a typed obstruction'),
    [], invoke(0n, 0n, 'x', { buffer: new Uint8Array(32).fill(0x11), basis: new Uint8Array(32).fill(0x22) }),
    new ExpectObstructed('FactMissing', 'buffer-presence')),
  new RowSpec(obstructed('branch-extent-mismatch-at-zero', 'fact-malformed',
    'Validate branch/children extent before a zero-offset edit', EXTENT_DECISION),
  [buffer('branch-extent-mismatch-at-zero', EXTENT_MISMATCH())], invoke(0n, 0n, 'x'),
  new ExpectObstructed('MalformedRope', 'closure-validation')),
  new RowSpec(obstructed('branch-extent-mismatch-at-exact-end', 'fact-malformed',
    'Validate branch/children extent at the end boundary', EXTENT_DECISION),
  [buffer('branch-extent-mismatch-at-exact-end', EXTENT_MISMATCH())], invoke(4098n, 4098n, 'x'),
  new ExpectObstructed('MalformedRope', 'closure-validation')),
  new RowSpec(obstructed('branch-extent-mismatch-at-internal-boundary', 'fact-malformed',
    'Validate branch/children extent at a child boundary', EXTENT_DECISION),
  [buffer('branch-extent-mismatch-at-internal-boundary', EXTENT_MISMATCH())], invoke(4096n, 4096n, 'x'),
  new ExpectObstructed('MalformedRope', 'closure-validation')),
  new RowSpec(obstructed('branch-truncated-no-op-mask', 'malformed-rope',
    'Malformed materialization must not be hidden by NoOp', MASK_DECISION),
  [buffer('branch-truncated-no-op-mask', EXTENT_MISMATCH())],
  invoke(0n, 4098n, utf8(`${'a'.repeat(4096)}b`)),
  new ExpectObstructed('MalformedRope', 'closure-validation')),
  new RowSpec(obstructed('empty-root-nonzero-length-no-op-mask', 'malformed-rope',
    'Missing root with nonzero head length cannot become NoOp', MASK_DECISION),
  [buffer('empty-root-nonzero-length-no-op-mask', OVERSIZED())], invoke(0n, 1n, ''),
  new ExpectObstructed('MalformedRope', 'closure-validation')),
  new RowSpec(obstructed('empty-root-nonzero-length-zero-insert', 'malformed-rope',
    'Reject inconsistent empty-root metrics before insertion'),
  [buffer('empty-root-nonzero-length-zero-insert', OVERSIZED())], invoke(0n, 0n, 'x'),
  new ExpectObstructed('MalformedRope', 'closure-validation')),
  new RowSpec(obstructed('coordinate-above-graphql-int', 'malformed-rope',
    'Preserve U64 coordinates and reject inconsistent head/root metrics without narrowing'),
  [buffer('coordinate-above-graphql-int', head(null, { claims: claims({ byteLength: TWO_TO_31 }) }))],
  invoke(TWO_TO_31, TWO_TO_31, 'x'),
  new ExpectObstructed('MalformedRope', 'closure-validation')),
  new RowSpec(obstructed('rope-node-end-overflow', 'arithmetic-overflow',
    'Checked traversal position plus subtree extent'),
  [buffer('rope-node-end-overflow', head(branch(
    branch(leaf('a'), leaf('b'), { claims: claims({ byteLength: U64_MAX }) }), leaf('c'),
    { claims: claims({ byteLength: 3n }) })))],
  invoke(0n, 1n, 'x'),
  new ExpectObstructed('ArithmeticOverflow', 'closure-validation')),
  new RowSpec(obstructed('rope-line-break-count-overflow', 'arithmetic-overflow', 'Checked aggregate line-break count'),
    [buffer('rope-line-break-count-overflow', head(branch(
      branch(leaf('a'), leaf('b'), { claims: claims({ lineBreaks: U64_MAX }) }), leaf('\n'),
      { claims: claims({ lineBreaks: 1n }) })))],
    invoke(0n, 0n, '\n'),
    new ExpectObstructed('ArithmeticOverflow', 'closure-validation')),
  new RowSpec(obstructed('head-line-count-overflow', 'arithmetic-overflow', 'Checked line-break count plus one'),
    [buffer('head-line-count-overflow', head(branch(leaf('a'), leaf('b'), { claims: claims({ lineBreaks: U64_MAX }) }),
      { claims: claims({ lineCount: 1n }) }))],
    invoke(1n, 1n, 'x'),
    new ExpectObstructed('ArithmeticOverflow', 'closure-validation')),
];
