// SPDX-License-Identifier: Apache-2.0 OR LicenseRef-MIND-UCAL-1.0
// © James Ross Ω FLYING•ROBOTS <https://github.com/flyingrobots>
// Hand-written expectations the validator holds independently of the rows and
// the builder. Each list was written from DL-0159 and the reviewed row decisions;
// a change here is a reviewed change of the acceptance contract.

// Oracle: DL-0163 declared check order and outcome vocabulary.
export const CHECK_ORDER = Object.freeze(['buffer-presence', 'buffer-decode', 'basis', 'range-order', 'replacement',
  'envelope', 'head-decode', 'range-bounds', 'closure-validation', 'character-boundary', 'no-op', 'counters']);
export const OUTCOMES = Object.freeze(['FactMissing', 'FactMalformed', 'BasisNotCanonical', 'RangeOrderInvalid',
  'ReplacementNotUtf8', 'ResourceLimitExceeded', 'RangeOutOfBounds', 'ContentIdentityMismatch', 'MalformedRope',
  'ArithmeticOverflow', 'Utf8BoundaryInvalid', 'NoOp']);

/** Every obstructed row's typed outcome and deciding check. No row may expect a resource refusal. */
export const EXPECTED_OBSTRUCTIONS = new Map([
  ['reversed-range', ['RangeOrderInvalid', 'range-order']],
  ['out-of-bounds-range', ['RangeOutOfBounds', 'range-bounds']],
  ['start-inside-codepoint', ['Utf8BoundaryInvalid', 'character-boundary']],
  ['end-inside-codepoint', ['Utf8BoundaryInvalid', 'character-boundary']],
  ['empty-range-inside-codepoint', ['Utf8BoundaryInvalid', 'character-boundary']],
  ['empty-no-op', ['NoOp', 'no-op']],
  ['identical-no-op', ['NoOp', 'no-op']],
  ['stale-basis', ['BasisNotCanonical', 'basis']],
  ['foreign-basis', ['BasisNotCanonical', 'basis']],
  ['head-sequence-overflow', ['ArithmeticOverflow', 'counters']],
  ['buffer-version-overflow', ['ArithmeticOverflow', 'counters']],
  ['missing-buffer', ['FactMissing', 'buffer-presence']],
  ['malformed-buffer', ['FactMalformed', 'buffer-decode']],
  ['bad-blob-content-hash', ['ContentIdentityMismatch', 'closure-validation']],
  ['branch-extent-mismatch-at-zero', ['MalformedRope', 'closure-validation']],
  ['branch-extent-mismatch-at-exact-end', ['MalformedRope', 'closure-validation']],
  ['branch-extent-mismatch-at-internal-boundary', ['MalformedRope', 'closure-validation']],
  ['branch-truncated-no-op-mask', ['MalformedRope', 'closure-validation']],
  ['cyclic-right-endpoint', ['ContentIdentityMismatch', 'closure-validation']],
  ['empty-root-nonzero-length-no-op-mask', ['MalformedRope', 'closure-validation']],
  ['empty-root-nonzero-length-zero-insert', ['MalformedRope', 'closure-validation']],
  ['leaf-ends-inside-codepoint-at-exact-end', ['MalformedRope', 'closure-validation']],
  ['leaf-exceeds-blob-at-zero', ['MalformedRope', 'closure-validation']],
  ['leaf-exceeds-blob-at-exact-end', ['MalformedRope', 'closure-validation']],
  ['leaf-exceeds-blob-at-internal-boundary', ['MalformedRope', 'closure-validation']],
  ['coordinate-above-graphql-int', ['MalformedRope', 'closure-validation']],
  ['leaf-range-start-overflow', ['ArithmeticOverflow', 'closure-validation']],
  ['leaf-range-end-overflow', ['ArithmeticOverflow', 'closure-validation']],
  ['rope-node-end-overflow', ['ArithmeticOverflow', 'closure-validation']],
  ['leaf-extent-u64-max-at-zero', ['MalformedRope', 'closure-validation']],
  ['rope-utf16-length-overflow', ['FactMalformed', 'closure-validation']],
  ['rope-line-break-count-overflow', ['ArithmeticOverflow', 'closure-validation']],
  ['branch-height-u32-max-at-zero', ['MalformedRope', 'closure-validation']],
  ['head-line-count-overflow', ['ArithmeticOverflow', 'closure-validation']],
  ['invalid-utf8-replacement', ['ReplacementNotUtf8', 'replacement']],
  ['branch-missing-right-edge', ['MalformedRope', 'closure-validation']],
  ['branch-duplicate-left-edge', ['MalformedRope', 'closure-validation']],
  ['branch-wrong-type-edge', ['MalformedRope', 'closure-validation']],
  ['branch-height-exceeds-u8', ['FactMalformed', 'closure-validation']],
  ['malformed-closure-masks-no-op', ['MalformedRope', 'closure-validation']],
  ['empty-root-masks-no-op', ['MalformedRope', 'closure-validation']],
  ['new-head-line-count-overflow', ['ArithmeticOverflow', 'counters']],
  ['new-head-extent-overflow', ['ArithmeticOverflow', 'counters']],
  ['branch-extra-edge-type', ['MalformedRope', 'closure-validation']],
  ['leaf-with-edge', ['MalformedRope', 'closure-validation']],
  ['head-sequence-at-limit-no-op', ['NoOp', 'no-op']],
]);

/** Schema-2 additions the register promises; dropping one must fail. */
export const REQUIRED_ADDITIONS = Object.freeze(['shared-head-two-buffers', 'equal-leaf-second-position',
  'equal-content-new-leaves', 'constructor-4097-bytes', 'constructor-8193-bytes', 'constructor-8194-bytes',
  'invalid-utf8-replacement', 'branch-missing-right-edge', 'branch-duplicate-left-edge', 'branch-wrong-type-edge',
  'branch-height-exceeds-u8', 'malformed-closure-masks-no-op', 'empty-root-masks-no-op', 'new-head-line-count-overflow',
  'new-head-extent-overflow', 'branch-extra-edge-type', 'leaf-with-edge', 'head-sequence-at-limit-no-op']);

/** Retained rows whose obligation moves (in part) to another surface, and the surfaces it must name. */
export const MOVED = new Map([
  ['rope-utf16-length-overflow', ['utf16-derived-reading']],
  ...['empty-unicode-insert', 'middle-ascii-insert', 'whole-buffer-delete', 'unicode-replacement', 'cross-leaf-rebalance',
    'replacement-larger-than-leaf'].map((id) => [id, ['rewrite-diff-facts', 'utf16-derived-reading']]),
  ['branch-height-u32-max-at-zero', ['addition:branch-height-exceeds-u8']],
  ['branch-truncated-no-op-mask', ['addition:malformed-closure-masks-no-op']],
  ['empty-root-nonzero-length-no-op-mask', ['addition:empty-root-masks-no-op']],
]);

/** Closed schema-2 records: field names and the bounds a decodable atom must respect. */
export const RECORDS = new Map([
  ['Buffer', ['bufferKey', 'version']], ['Head', ['byteLength', 'lineCount', 'sequence']],
  ['Branch', ['byteLength', 'height', 'lineBreaks']], ['Leaf', ['bytes', 'lineBreaks']],
  ['Import', ['fileCoordinate', 'hostDigest', 'observation']],
  ['HostBasis', ['evidence', 'fileCoordinate', 'generation', 'hostDigest']],
]);

export const EVIDENCE = Object.freeze({
  committed: ['admission receipt with committed posture naming exactly these effects',
    'WAL entry for the Tick carrying the derived patch',
    'restart recovers a reachable state equal to the expected post-state'],
  obstructed: ['receipt naming the typed outcome and deciding check', 'no patch derived and no WAL write',
    'reachable state after equals the basis'],
});

/** Rows that declare later checks their fixture also fails, as the model verifies them. */
export const COMPETING = new Map([
  ['empty-range-inside-codepoint', ['no-op']], ['branch-truncated-no-op-mask', ['character-boundary']],
  ['leaf-range-end-overflow', ['counters']], ['malformed-closure-masks-no-op', ['no-op']],
  ['empty-root-masks-no-op', ['no-op']], ['head-sequence-at-limit-no-op', ['counters']],
]);
