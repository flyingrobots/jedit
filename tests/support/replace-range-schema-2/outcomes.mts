// SPDX-License-Identifier: Apache-2.0 OR LicenseRef-MIND-UCAL-1.0
// © James Ross Ω FLYING•ROBOTS <https://github.com/flyingrobots>
// The schema-2 outcome vocabulary, rejecting boundaries and their fixed order.
// Fixture-declared until #296 publishes the authored outcome type.

/** The authored operation's checks, in the order they run. The first failure decides. */
export const CHECK_ORDER = Object.freeze([
  'buffer-presence',
  'buffer-decode',
  'basis',
  'range-order',
  'replacement',
  'envelope',
  'head-decode',
  'range-bounds',
  'closure-validation',
  'character-boundary',
  'no-op',
  'counters',
] as const);

export type Check = (typeof CHECK_ORDER)[number];

/** Echo's generic admission boundary, separate from the authored operation. */
export const ECHO_ADMISSION = 'echo-admission';

export const OUTCOMES = Object.freeze([
  'FactMissing',
  'FactMalformed',
  'BasisNotCanonical',
  'RangeOrderInvalid',
  'ReplacementNotUtf8',
  'ResourceLimitExceeded',
  'RangeOutOfBounds',
  'ContentIdentityMismatch',
  'MalformedRope',
  'ArithmeticOverflow',
  'Utf8BoundaryInvalid',
  'NoOp',
] as const);

export type Outcome = (typeof OUTCOMES)[number];

/** Echo's typed obstruction for an id that is not its ContentAddressV1 address. */
export const IDENTITY_LAW_VIOLATION = 'IdentityLawViolation';

export class Obstruction extends Error {
  readonly outcome: Outcome;
  readonly check: Check;
  constructor(outcome: Outcome, check: Check, detail: string) {
    super(`${outcome} at ${check}: ${detail}`);
    this.outcome = outcome;
    this.check = check;
  }
}

export function checkRank(check: Check): number {
  return CHECK_ORDER.indexOf(check);
}
