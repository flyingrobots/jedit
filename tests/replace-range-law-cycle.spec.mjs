import assert from 'node:assert/strict';
import crypto from 'node:crypto';
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
const LAWPACK_PATH = path.join(
  process.cwd(),
  'contracts',
  'jedit',
  'lawpacks',
  'replace-range-v1',
);
const PUBLISHED_ARTIFACTS = [
  'text-schema-v1.json',
  'codec-vectors-v1.json',
  'replace-range-v1.oracle.json',
];
const FINAL_AUDIT_EVIDENCE_COMMITS = [
  ['WARP-qualified identifiers', 'edd41a35058fea354d46a38421641b0c173e3faa'],
  ['invocation lexical validation', 'c0214b2fe52ef3a3cb2d09e24af9cd4a3258ca0c'],
  ['strict typed corpus validation', '9a309641edd4b809c37f5d055790de311e5d61f9'],
  ['current-patch consequence selection', '475b6dcc0eae9edbf228221069ab3aab975be868'],
  ['retained node-record typing', '6c20d93ff94a8b0e24e6d3fc05492f99f27a56e8'],
  ['canonical oracle bytes', '8112752b85862d065811fbe133fdfe8f9e8021c1'],
  ['serialized resource updates', '13b16f2e7195458138865460c5948744ea8615ed'],
  ['retained basis relationships', 'd57e0d239c005898839a15041807580ed2dfe595'],
];

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

test('DL-0158 retrospective pins every final audit evidence class', () => {
  const retrospective = readDesign().split('## Retrospective')[1];

  for (const [evidenceClass, commit] of FINAL_AUDIT_EVIDENCE_COMMITS) {
    assert.match(
      retrospective,
      new RegExp(`https://github\\.com/flyingrobots/jedit/blob/${commit}/`),
      `${evidenceClass} must cite its immutable implementation evidence`,
    );
  }
});

test('DL-0158 retrospective binds every published artifact digest', () => {
  const retrospective = readDesign().split('## Retrospective')[1];
  let oracleBytes;

  for (const fileName of PUBLISHED_ARTIFACTS) {
    const artifactPath = path.join(LAWPACK_PATH, fileName);
    const artifactBytes = fs.readFileSync(artifactPath);
    const actualDigest = crypto.createHash('sha256').update(artifactBytes).digest('hex');
    const sidecarPath = artifactPath.replace(/\.json$/, '.sha256');
    const publishedDigest = fs.readFileSync(sidecarPath, 'utf8').trim();

    assert.equal(publishedDigest, actualDigest, `${fileName} sidecar drifted`);
    assert.match(retrospective, new RegExp(`\\b${actualDigest}\\b`));
    if (fileName === 'replace-range-v1.oracle.json') {
      oracleBytes = artifactBytes;
    }
  }

  assert.ok(oracleBytes, 'oracle artifact must be present in the published set');
  const sourceSetDigest = JSON.parse(oracleBytes).sourceSet.digestHex;
  assert.match(retrospective, new RegExp(`\\b${sourceSetDigest}\\b`));
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
