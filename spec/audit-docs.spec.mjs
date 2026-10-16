import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const READY_AUDIT = 'docs/audits/ready-to-ship-assessment-2026-06-28.md';
const TWO_PHASE_AUDIT = 'docs/audits/two-phase-assessment-2026-06-28.md';
const DOC_AUDIT = 'docs/audits/documentation-readme-audit-2026-06-28.md';

function readRepoText(path) {
  return readFileSync(path, 'utf8');
}

test('ready-to-ship audit does not prescribe forbidden unknown annotations', () => {
  const audit = readRepoText(READY_AUDIT);

  assert.doesNotMatch(audit, /nodeErrorCode\(cause: unknown\)/);
  assert.doesNotMatch(audit, /loadErrorResult\(filePath: string, cause: unknown\)/);
  assert.match(audit, /nodeErrorCode\(cause: Error\): string \| undefined/);
});

test('ready-to-ship audit includes parent directory fsync in atomic save guidance', () => {
  const audit = readRepoText(READY_AUDIT);

  assert.match(audit, /fsync the parent directory after rename/);
});

test('ready-to-ship audit separates production export preflight from legacy save risk', () => {
  const audit = readRepoText(READY_AUDIT);

  assert.match(audit, /Ctrl-S and `:write`.*saveProductionText/s);
  assert.match(audit, /materializationPreflightIssue/);
  assert.match(audit, /legacy.*saveEditor/s);
  assert.doesNotMatch(audit, /Two Jim instances, or Jim plus any external tool, silently clobber each other/);
});

test('ready-to-ship audit reflects the current CI quality gate', () => {
  const audit = readRepoText(READY_AUDIT);

  assert.match(audit, /\.github\/workflows\/ci\.yml.*quality job/s);
  assert.match(audit, /scripts\/quality-gate\.mjs/);
  assert.match(audit, /npm run quality/);
  assert.match(audit, /aggregate `check` job.*quality/s);
  assert.doesNotMatch(audit, /no lint job in CI/);
  assert.doesNotMatch(audit, /CI `\.github\/workflows\/ci\.yml` = build \+ sharded tests, no lint\/audit gate/);
});

test('two-phase audit names exact and ranged first-party dependencies correctly', () => {
  const audit = readRepoText(TWO_PHASE_AUDIT);

  assert.match(audit, /`@flyingrobots\/graft` is exact-pinned to `0\.10\.1`/);
  assert.match(audit, /`@flyingrobots\/bijou-i18n` and its tools use `\^7\.0\.0`/);
  assert.doesNotMatch(audit, /Pin @flyingrobots\/graft to an exact version/);
});

test('documentation audit prompt covers all stale Advanced Guide runtime references', () => {
  const audit = readRepoText(DOC_AUDIT);

  assert.match(audit, /`src\/app\/workspace\/editor\/model\.ts`/);
  assert.match(audit, /`src\/app\/workspace\/editor-editing-core\.ts`/);
  assert.match(audit, /`src\/app\/workspace\/runtime\.ts`/);
  assert.match(audit, /`src\/ui\/workspace-render\.ts`/);
  assert.match(audit, /`src\/main-workspace\.ts`/);
  assert.match(audit, /`src\/main\.ts` only remains the process entrypoint/);
});
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
