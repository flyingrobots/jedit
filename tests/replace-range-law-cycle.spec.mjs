import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const DESIGN_PATH = path.join(
  process.cwd(),
  'docs',
  'design',
  '0158-replace-range-canonical-fact-law.md',
);
const ORACLE_SUPPORT_PATH = path.join(
  process.cwd(),
  'native',
  'jedit-echo-host',
  'tests',
  'support',
);

function readDesign() {
  return fs.readFileSync(DESIGN_PATH, 'utf8');
}

test('DL-0158 distinguishes committable evidence from obstruction evidence', () => {
  const normalized = readDesign().replaceAll(/\s+/g, ' ');
  assert.match(
    normalized,
    /Successful cases name exact basis, input, support, patch, retained facts, and result\. Obstructed cases name exact basis, input, typed obstruction, no-plan posture, and unchanged-parent evidence\./,
  );
});

test('DL-0158 retrospective pins implemented truth to a full commit SHA', () => {
  const retrospective = readDesign().split('## Retrospective')[1];

  assert.match(
    retrospective,
    /https:\/\/github\.com\/flyingrobots\/jedit\/blob\/[0-9a-f]{40}\//,
  );
});

test('ReplaceRange oracle support modules stay within the Rust file budget', () => {
  const oversized = fs
    .readdirSync(ORACLE_SUPPORT_PATH)
    .filter((name) => /^replace_range_.*\.rs$/.test(name))
    .map((name) => {
      const contents = fs.readFileSync(path.join(ORACLE_SUPPORT_PATH, name), 'utf8');
      return [name, contents.trimEnd().split(/\r?\n/).length];
    })
    .filter(([, lines]) => lines > 500);

  assert.deepEqual(oversized, []);
});

test('ReplaceRange updater isolates writers before committed-resource readers', () => {
  const packageJson = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8'),
  );
  const update = packageJson.scripts['lawpack:replace-range:update'];
  const check = packageJson.scripts['lawpack:replace-range:check'];

  assert.match(
    update,
    /JEDIT_UPDATE_REPLACE_RANGE_SCHEMA=1 cargo test --locked .* published_schema_and_codec_vectors_regenerate_byte_for_byte -- --exact --test-threads=1/,
  );
  assert.match(
    update,
    /JEDIT_UPDATE_REPLACE_RANGE_ORACLE=1 cargo test --locked .* replace_range_oracle_matches_the_committed_corpus -- --exact --test-threads=1/,
  );
  assert.match(update, /&& npm run lawpack:replace-range:check$/);
  for (const target of [
    'replace_range_schema',
    'replace_range_oracle',
    'replace_range_schema_conformance',
    'replace_range_corpus_conformance',
  ]) {
    assert.match(check, new RegExp(`cargo test --locked .* --test ${target}`));
  }
});
