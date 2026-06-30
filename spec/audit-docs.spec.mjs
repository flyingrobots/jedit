import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const READY_AUDIT = 'docs/audits/ready-to-ship-assessment-2026-06-28.md';
const TWO_PHASE_AUDIT = 'docs/audits/two-phase-assessment-2026-06-28.md';
const DOC_AUDIT = 'docs/audits/documentation-readme-audit-2026-06-28.md';
const JIM_LOGO = 'JimLogo.svg';

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

test('Jim logo is original project artwork with explicit metadata', () => {
  const logo = readRepoText(JIM_LOGO);

  assert.doesNotMatch(logo, /Vimlogo|VimLogo|Vim logo|sodipodi|inkscape/i);
  assert.match(logo, /Original Jim project logo/);
  assert.match(logo, /Apache-2\.0/);
});
