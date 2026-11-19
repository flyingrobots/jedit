// SPDX-License-Identifier: Apache-2.0 OR LicenseRef-MIND-UCAL-1.0
// © James Ross Ω FLYING•ROBOTS <https://github.com/flyingrobots>
// The acceptance rule for one schema-2 row, as an executable predicate over an
// execution observation. Nothing produces such an observation yet (#296); the
// spec feeds it synthetic ones to show what can and cannot satisfy a row. Read sets
// follow the #296 ruling: the row's recorded read set is a lower bound, because
// one closure read must over-read join spines, and the observed reads must stay
// within the declared closure envelope, so over-reading is never unbounded.

import { isDeepStrictEqual } from 'node:util';

const PERSISTENT_ROPE = 'persistent-rope';
const EMPTY_WRITE_SET = Object.freeze({ nodes: [], atoms: [], edges: [], edgeRanges: [] });

// Structural equality: property order never matters, array order always does.
function same(left, right) {
  return isDeepStrictEqual(left, right);
}

const rangeKey = (range) => `${range.from}/${range.type}`;

function readSetReasons(expected, observation, bounds) {
  const reasons = [];
  const nodes = new Set(observation.readSet?.nodes ?? []);
  const ranges = new Set((observation.readSet?.edgeRanges ?? []).map(rangeKey));
  if (!expected.readSet.nodes.every((node) => nodes.has(node))
    || !expected.readSet.edgeRanges.every((range) => ranges.has(rangeKey(range)))) {
    reasons.push('read set omits a recorded read');
  }
  if (nodes.size > bounds.maxReadNodes || (observation.closureDepth ?? 0) > bounds.maxClosureDepth) {
    reasons.push('read set exceeds the closure envelope');
  }
  return reasons;
}

function committedReasons(expected, observation) {
  const reasons = [];
  if (observation.textAfterHex === undefined) reasons.push('no text outcome');
  if (!same(observation.effects, expected.effects)) reasons.push('effects differ from the normalized proposal');
  if (!same(observation.writeSet, expected.writeSet)) reasons.push('write set differs');
  if (observation.headAfterId !== expected.headAfter.id) reasons.push('new head id differs');
  if (!same(observation.reachableFromBuffer, expected.reachability.fromBufferAfter)) reasons.push('reachability differs');
  return reasons;
}

function obstructedReasons(expected, observation) {
  const reasons = [];
  if (observation.typedOutcome === 'ResourceLimitExceeded' && expected.typedOutcome !== 'ResourceLimitExceeded') {
    reasons.push('a resource refusal is a resource-domain gap, not this row\'s outcome');
  }
  if (observation.typedOutcome !== expected.typedOutcome) reasons.push('typed outcome differs');
  if (observation.decidingCheck !== expected.decidingCheck) reasons.push('rejecting boundary differs');
  if (!same(observation.effects ?? [], [])) reasons.push('an obstruction proposed effects');
  // An obstruction must say it wrote nothing; silence about writes is not evidence of none.
  if (!same(observation.writeSet, EMPTY_WRITE_SET) || observation.patch !== 'none' || observation.textAfterHex !== undefined) {
    reasons.push('an obstruction must report an empty write set, no patch and no text');
  }
  return reasons;
}

/**
 * Returns why the observation does not satisfy the row; an empty list means it
 * does. `bounds` is the closure envelope: { maxReadNodes, maxClosureDepth }.
 */
export function unmetReasons(row, observation, bounds) {
  const reasons = [];
  if (observation.target !== PERSISTENT_ROPE) reasons.push(`a ${observation.target} result cannot close a persistent row`);
  if (observation.executed !== true) reasons.push('no execution evidence');
  for (const evidence of row.expected.evidence) {
    if (!(observation.evidence ?? []).includes(evidence)) reasons.push(`missing evidence: ${evidence}`);
  }
  if (observation.posture !== row.expected.posture) {
    reasons.push(`posture ${observation.posture} is not ${row.expected.posture}`);
    return reasons;
  }
  if (row.expected.posture === 'committed' && observation.textAfterHex !== row.text.afterHex) {
    reasons.push('text outcome differs');
  }
  return reasons.concat(readSetReasons(row.expected, observation, bounds), row.expected.posture === 'committed'
    ? committedReasons(row.expected, observation)
    : obstructedReasons(row.expected, observation));
}

/** The observation an execution matching this row exactly would produce. */
export function exactObservation(row) {
  const expected = row.expected;
  const common = { target: PERSISTENT_ROPE, executed: true, evidence: [...expected.evidence], posture: expected.posture,
    closureDepth: 0 };
  if (expected.posture === 'obstructed') {
    return { ...common, typedOutcome: expected.typedOutcome, decidingCheck: expected.decidingCheck, effects: [],
      readSet: expected.readSet, writeSet: { nodes: [], atoms: [], edges: [], edgeRanges: [] }, patch: 'none' };
  }
  return { ...common, textAfterHex: row.text.afterHex, effects: expected.effects, readSet: expected.readSet,
    writeSet: expected.writeSet,
    headAfterId: expected.headAfter.id, reachableFromBuffer: expected.reachability.fromBufferAfter };
}
