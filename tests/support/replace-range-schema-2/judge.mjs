// SPDX-License-Identifier: Apache-2.0 OR LicenseRef-MIND-UCAL-1.0
// © James Ross Ω FLYING•ROBOTS <https://github.com/flyingrobots>
// The acceptance rule for one schema-2 row, as an executable predicate over an
// execution observation. Nothing produces such an observation yet (#296); the
// spec feeds it synthetic ones to show what can and cannot satisfy a row.

const PERSISTENT_ROPE = 'persistent-rope';

function same(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function committedReasons(expected, observation) {
  const reasons = [];
  if (observation.textAfterHex === undefined) reasons.push('no text outcome');
  if (!same(observation.effects, expected.effects)) reasons.push('effects differ from the normalized proposal');
  if (!same(observation.footprint, expected.footprint)) reasons.push('footprint differs');
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
  return reasons;
}

/** Returns why the observation does not satisfy the row; an empty list means it does. */
export function unmetReasons(row, observation) {
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
  return reasons.concat(row.expected.posture === 'committed'
    ? committedReasons(row.expected, observation)
    : obstructedReasons(row.expected, observation));
}

/** The observation an execution matching this row exactly would produce. */
export function exactObservation(row) {
  const expected = row.expected;
  const common = { target: PERSISTENT_ROPE, executed: true, evidence: [...expected.evidence], posture: expected.posture };
  if (expected.posture === 'obstructed') {
    return { ...common, typedOutcome: expected.typedOutcome, decidingCheck: expected.decidingCheck, effects: [] };
  }
  return { ...common, textAfterHex: row.text.afterHex, effects: expected.effects, footprint: expected.footprint,
    headAfterId: expected.headAfter.id, reachableFromBuffer: expected.reachability.fromBufferAfter };
}
