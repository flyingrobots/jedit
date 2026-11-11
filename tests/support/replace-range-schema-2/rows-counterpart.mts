// SPDX-License-Identifier: Apache-2.0 OR LicenseRef-MIND-UCAL-1.0
// © James Ross Ω FLYING•ROBOTS <https://github.com/flyingrobots>
// The 12 counterpart rows. Each replaces a schema-1 representation detail
// (JSON atoms, Blob slices, stored UTF-16, U32 height) with an explicit
// schema-2 fixture, typed outcome, deciding check and written decision.
import { blake3 } from './blake3.mts';
import { CborBytes, CborMap, CborUint, encodeCbor } from './canonical-cbor.mts';
import type { CborValue } from './canonical-cbor.mts';
import { repeat, utf8 } from './fixture-basis.mts';
import { branch, buffer, claims, ExpectObstructed, head, invoke, leaf, MovedObligation, RowSpec }
  from './row-spec.mts';
import { U64_MAX } from './schema-2-facts.mts';

/** A Buffer atom with both fields well typed but bufferKey encoded first: not canonical. */
function unsortedBufferAtom(key: string): Uint8Array {
  const keyBytes = utf8(key);
  return Uint8Array.from([0xa2, 0x69, ...utf8('bufferKey'), 0x60 + keyBytes.length, ...keyBytes,
    0x67, ...utf8('version'), 0x00]);
}

/** A leaf atom that still carries a stored UTF-16 length: not the closed schema-2 record. */
function leafAtomWithUtf16(): Uint8Array {
  return encodeCbor(new CborMap(new Map<string, CborValue>([['bytes', new CborBytes(utf8('a'))], ['lineBreaks', new CborUint(0n)],
    ['utf16Length', new CborUint(U64_MAX)]])));
}

/** A stored id that is not the content address of anything: blake3 of a fixed label. */
const CORRUPT_LEAF_ID = blake3(utf8('jedit.text.fixture.corrupt-content-identity.v1'));
const SELF_REFERENCING_ID = new Uint8Array(32).fill(0xcc);

function counterpart(id: string, semanticCode: string, obligation: string, decision: string,
  moved: readonly MovedObligation[] = []): { id: string; mapping: 'counterpart'; semanticCode: string;
  obligation: string; decision: string; moved: readonly MovedObligation[] } {
  return { id, mapping: 'counterpart', semanticCode, obligation, decision, moved };
}

const SHORT_LEAF = (): ReturnType<typeof head> => head(leaf('abc'), { claims: claims({ byteLength: 4n }) });

export const COUNTERPART_ROWS: readonly RowSpec[] = [
  new RowSpec(counterpart('malformed-buffer', 'fact-malformed',
    'Malformed canonical atom/type fixture, replacing JSON parse failure',
    'Schema-2 Buffer atoms are edict.canonical-cbor/v1 records. The counterpart stores well-typed fields in '
    + 'non-canonical order; the operation rejects it when it decodes the Buffer. Echo admits mutable-node bytes '
    + 'without decoding them, so this state is constructible and needs no admission witness.'),
  [buffer('malformed-buffer', head(leaf('abc')), { atom: unsortedBufferAtom('malformed-buffer') })],
  invoke(0n, 1n, 'x'),
  new ExpectObstructed('FactMalformed', 'buffer-decode')),
  new RowSpec(counterpart('bad-blob-content-hash', 'content-identity-mismatch',
    'Corrupt content identity on a schema-2 content node; no Blob type exists',
    'No Blob type exists. The counterpart stores the canonical root leaf under an id that is not its '
    + 'ContentAddressV1 address. Echo refuses to create it (IdentityLawViolation), so the state needs a '
    + 'non-bridge writer; the operation still recomputes the leaf id and rejects the mismatch.'),
  [buffer('bad-blob-content-hash', head(leaf('abc', { id: CORRUPT_LEAF_ID })))],
  invoke(0n, 1n, 'x'),
  new ExpectObstructed('ContentIdentityMismatch', 'closure-validation')),
  new RowSpec(counterpart('cyclic-right-endpoint', 'fact-malformed',
    'Cyclic structural edges: define admission-versus-read rejection and prove non-acceptance',
    'A content id commits to its outgoing edges, so no admitted node can reach itself: Echo refuses the '
    + 'self-edge node with IdentityLawViolation. At read time the self-edge is a lawful edge set, '
    + 'and identity is checked before the traversal could revisit the node, so the injected cycle is '
    + 'ContentIdentityMismatch, not a traversal cycle error.'),
  [buffer('cyclic-right-endpoint', head(branch(leaf('abc'), 'self',
    { id: SELF_REFERENCING_ID, claims: claims({ byteLength: 3n, lineBreaks: 0n, height: 2n }) })))],
  invoke(3n, 3n, 'x'),
  new ExpectObstructed('ContentIdentityMismatch', 'closure-validation')),
  new RowSpec(counterpart('leaf-ends-inside-codepoint-at-exact-end', 'utf8-boundary-invalid',
    'Invalid UTF-8 leaf bytes replacing a partial Blob slice; specify fault precedence',
    'A schema-2 leaf stores its own bytes; a lone 0xC3 is an invalid leaf, rejected by closure validation as '
    + 'MalformedRope. The retained boundary code does not survive: offset 1 is the end of the leaf, which is a '
    + 'character boundary under the DL-0159 predicate.'),
  [buffer('leaf-ends-inside-codepoint-at-exact-end', head(leaf(Uint8Array.of(0xc3))))],
  invoke(1n, 1n, 'x'),
  new ExpectObstructed('MalformedRope', 'closure-validation')),
  new RowSpec(counterpart('leaf-exceeds-blob-at-zero', 'fact-malformed',
    'Define equivalent malformed-leaf extent coverage without Blob ranges',
    'Without Blob ranges, an extent can only be overstated by an ancestor. The head claims 4 bytes over a '
    + '3-byte leaf; the edit at zero is rejected by head/root validation.'),
  [buffer('leaf-exceeds-blob-at-zero', SHORT_LEAF())], invoke(0n, 0n, 'x'),
  new ExpectObstructed('MalformedRope', 'closure-validation')),
  new RowSpec(counterpart('leaf-exceeds-blob-at-exact-end', 'fact-malformed',
    'Preserve exact-end validation coverage without Blob ranges',
    'Same overstated head as the zero case, edited at the claimed end (4). The range is in bounds of the claim, '
    + 'so the bounds check passes and closure validation rejects.'),
  [buffer('leaf-exceeds-blob-at-exact-end', SHORT_LEAF())], invoke(4n, 4n, 'x'),
  new ExpectObstructed('MalformedRope', 'closure-validation')),
  new RowSpec(counterpart('leaf-exceeds-blob-at-internal-boundary', 'fact-malformed',
    'Preserve internal-boundary validation coverage without Blob ranges',
    'The root claims 4,097 bytes over a 4,095-byte leaf and a 1-byte leaf; the edit sits at the claimed '
    + 'internal boundary (4,096). Expanding the root rejects the understated child.'),
  [buffer('leaf-exceeds-blob-at-internal-boundary', head(branch(leaf(repeat('a', 4095)), leaf('b'),
    { claims: claims({ byteLength: 4097n }) })))],
  invoke(4096n, 4096n, 'x'),
  new ExpectObstructed('MalformedRope', 'closure-validation')),
  new RowSpec(counterpart('leaf-range-start-overflow', 'arithmetic-overflow',
    'Blob offset addition is removed; specify the surviving arithmetic obligation',
    'Blob offsets are gone; the surviving arithmetic is the checked sum of child extents. Here it overflows '
    + 'below the root, inside the subtree the descent enters, so the check must run at every level.'),
  [buffer('leaf-range-start-overflow', head(branch(
    branch(leaf('a'), branch(leaf('x'), leaf('y'), { claims: claims({ byteLength: U64_MAX }) }),
      { claims: claims({ byteLength: 2n }) }),
    branch(leaf('c'), leaf('d')))))],
  invoke(1n, 2n, 'x'),
  new ExpectObstructed('ArithmeticOverflow', 'closure-validation')),
  new RowSpec(counterpart('leaf-range-end-overflow', 'arithmetic-overflow',
    'Blob range-end addition is removed; specify the surviving arithmetic obligation',
    'The surviving obligation is the same checked extent sum with the overflowing claim as the right '
    + 'operand, so neither operand order escapes the check.'),
  [buffer('leaf-range-end-overflow', head(branch(leaf('a'),
    branch(leaf('b'), leaf('c'), { claims: claims({ byteLength: U64_MAX }) }),
    { claims: claims({ byteLength: 3n }) })))],
  invoke(0n, 1n, 'x'),
  new ExpectObstructed('ArithmeticOverflow', 'closure-validation')),
  new RowSpec(counterpart('leaf-extent-u64-max-at-zero', 'fact-malformed',
    'Bounded inline leaves cannot carry that Blob extent; specify malformed-extent rejection coverage',
    'A leaf holds at most 4,096 inline bytes, so the U64::MAX extent moves to the only place it can be '
    + 'claimed: the head. Head/root validation rejects it before the edit at zero.'),
  [buffer('leaf-extent-u64-max-at-zero', head(leaf('a'), { claims: claims({ byteLength: U64_MAX }) }))],
  invoke(0n, 0n, 'x'),
  new ExpectObstructed('MalformedRope', 'closure-validation')),
  new RowSpec(counterpart('rope-utf16-length-overflow', 'arithmetic-overflow',
    'Stored UTF-16 metric is removed; resolve derived-reading versus operation coverage explicitly',
    'Schema 2 stores no UTF-16 metric, so the operation does no UTF-16 arithmetic. Its operation-level '
    + 'counterpart is that a leaf atom still carrying utf16Length is not the closed record and is rejected. The '
    + 'checked UTF-16 arithmetic moves to the derived reading and stays a gap there.',
  [new MovedObligation('utf16-derived-reading',
    'Checked UTF-16 length of a derived reading cached by subtree identity and conversion version',
    'DL-0159 Coordinates and Follow-On Debt (UTF-16 derived reading); no tracking issue yet')]),
  [buffer('rope-utf16-length-overflow', head(leaf('a', { atom: leafAtomWithUtf16() })))],
  invoke(0n, 0n, 'x'),
  new ExpectObstructed('FactMalformed', 'closure-validation')),
  new RowSpec(counterpart('branch-height-u32-max-at-zero', 'fact-malformed',
    'Height is bounded U8, not U32; specify malformed height/codec and child consistency checks',
    'Height is U8. This row covers child consistency: a valid U8 height of 255 over two leaves is rejected '
    + 'when the branch is expanded. The codec half (a U32::MAX height) is the addition '
    + 'branch-height-exceeds-u8.'),
  [buffer('branch-height-u32-max-at-zero', head(branch(leaf(repeat('a', 4096)), leaf('b'),
    { claims: claims({ height: 255n }) })))],
  invoke(0n, 0n, 'x'),
  new ExpectObstructed('MalformedRope', 'closure-validation')),
];
