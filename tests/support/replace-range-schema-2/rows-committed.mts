// SPDX-License-Identifier: Apache-2.0 OR LicenseRef-MIND-UCAL-1.0
// © James Ross Ω FLYING•ROBOTS <https://github.com/flyingrobots>
// The six retained committable cases. Texts before and after are written by
// hand from each case's invocation; basis shapes give each obligation
// something to observe (an untouched sibling, a shared suffix, a rotation).
import { repeat, utf8 } from './fixture-basis.mts';
import { branch, buffer, ExpectCommitted, head, invoke, leaf, MovedObligation, RowSpec } from './row-spec.mts';

/** Schema-1 committed results also carried Rewrite/Diff facts and stored UTF-16 lengths; schema 2 moves both. */
const SCHEMA1_ONLY: readonly MovedObligation[] = [
  new MovedObligation('rewrite-diff-facts', 'The Rewrite and Diff facts schema 1 recorded for each committed edit',
    'DL-0159 Follow-On Debt (Rewrite and Diff facts in schema 2); no tracking issue yet'),
  new MovedObligation('utf16-derived-reading', 'The stored UTF-16 length of the new head',
    'DL-0159 Coordinates and Follow-On Debt (UTF-16 derived reading); no tracking issue yet'),
];

const CAT_NEWLINE = utf8('猫\n');
const LARGE_REPLACEMENT = utf8(`${'猫'.repeat(1400)}\n`);

export const COMMITTED_ROWS: readonly RowSpec[] = [
  new RowSpec(
    { id: 'empty-unicode-insert', mapping: 'carry',
      moved: SCHEMA1_ONLY,
      obligation: 'Empty root to Unicode text; head/root edges and line metrics' },
    [buffer('empty-unicode-insert', head(null))],
    invoke(0n, 0n, CAT_NEWLINE),
    new ExpectCommitted([utf8(''), CAT_NEWLINE], [4])),
  new RowSpec(
    { id: 'middle-ascii-insert', mapping: 'carry',
      moved: SCHEMA1_ONLY,
      obligation: 'Exact insertion position; unaffected subtrees retain identity',
      decision: 'The schema-2 basis stores "abcd" as two leaves so an unaffected subtree exists to keep its id.' },
    [buffer('middle-ascii-insert', head(branch(leaf('ab'), leaf('cd'))))],
    invoke(2n, 2n, 'XY'),
    new ExpectCommitted([utf8('abcd'), utf8('abXYcd')], [4, 2], [utf8('cd')])),
  new RowSpec(
    { id: 'whole-buffer-delete', mapping: 'carry',
      moved: SCHEMA1_ONLY,
      obligation: 'Empty text, absent root edge, correct head metrics and counters' },
    [buffer('whole-buffer-delete', head(leaf('abc')))],
    invoke(0n, 3n, ''),
    new ExpectCommitted([utf8('abc'), utf8('')], [])),
  new RowSpec(
    { id: 'unicode-replacement', mapping: 'carry',
      moved: SCHEMA1_ONLY,
      obligation: 'Exact UTF-8 replacement and unaffected content/sharing',
      decision: 'The schema-2 basis splits "A😀é\\nB" after the emoji so the unaffected leaf keeps its id.' },
    [buffer('unicode-replacement', head(branch(leaf('A😀'), leaf('é\nB'))))],
    invoke(1n, 5n, 'λ\n'),
    new ExpectCommitted([utf8('A😀é\nB'), utf8('Aλ\né\nB')], [4, 4], [utf8('é\nB')])),
  new RowSpec(
    { id: 'cross-leaf-rebalance', mapping: 'carry',
      moved: SCHEMA1_ONLY,
      obligation: 'Cross-leaf edit, AVL invariants, path-copy sharing',
      decision: 'The 12,288-byte basis keeps its text but stores the c run as five leaves, so the edit leaves a '
        + 'shared suffix and the AVL join must rotate.' },
    [buffer('cross-leaf-rebalance', head(branch(
      branch(leaf(repeat('a', 4096)), branch(leaf(repeat('b', 2047)), leaf(repeat('b', 2049)))),
      branch(branch(leaf(repeat('c', 2)), leaf(repeat('c', 1000))),
        branch(branch(leaf(repeat('c', 1001)), leaf(repeat('c', 1002))), leaf(repeat('c', 1091)))))))],
    invoke(4094n, 8194n, 'β\nZ'),
    new ExpectCommitted([utf8('a'.repeat(4096) + 'b'.repeat(4096) + 'c'.repeat(4096)),
      utf8(`${'a'.repeat(4094)}β\nZ${'c'.repeat(4094)}`)], [4094, 4, 1000, 1001, 1002, 1091],
      [repeat('c', 1000), repeat('c', 1001), repeat('c', 1002), repeat('c', 1091)])),
  new RowSpec(
    { id: 'replacement-larger-than-leaf', mapping: 'carry',
      moved: SCHEMA1_ONLY,
      obligation: 'Character-aligned leaf partition and branch metrics within a measured envelope' },
    [buffer('replacement-larger-than-leaf', head(leaf('edges')))],
    invoke(0n, 5n, LARGE_REPLACEMENT),
    new ExpectCommitted([utf8('edges'), LARGE_REPLACEMENT], [2100, 2101])),
];
