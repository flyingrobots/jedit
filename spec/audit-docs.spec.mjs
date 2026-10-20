import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

function readRepoText(path) {
  return readFileSync(path, 'utf8');
}

const AGENTS = 'AGENTS.md';
const DURABLE_DECISIONS = 'docs/method/durable-decisions.md';
const ARCHITECTURE = 'ARCHITECTURE.md';
const OWNERSHIP = 'docs/jim-component-ownership.md';
const POLICY_RULE = /Identify one canonical owner before completing the change/;
const OWNERSHIP_RULE = /is Jim's mind/;

test('the durable decision policy states its rules in exactly one document', () => {
  const owner = readRepoText(DURABLE_DECISIONS);
  const agents = readRepoText(AGENTS);

  assert.match(owner, POLICY_RULE);
  assert.doesNotMatch(agents, POLICY_RULE);
  assert.match(agents, /docs\/method\/durable-decisions\.md/);
});

test('the documentation router lists the durable decision owner', () => {
  assert.match(
    readRepoText(AGENTS),
    /- `docs\/method\/durable-decisions\.md` owns the durable decision policy/,
  );
});

test('target ownership rules are stated only by their canonical owner', () => {
  const owner = readRepoText(OWNERSHIP);
  const architecture = readRepoText(ARCHITECTURE);

  assert.match(owner, OWNERSHIP_RULE);
  assert.doesNotMatch(architecture, OWNERSHIP_RULE);
  assert.match(architecture, /docs\/jim-component-ownership\.md/);
});
