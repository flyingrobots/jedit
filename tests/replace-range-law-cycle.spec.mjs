import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const ORACLE_SUPPORT_PATH = path.join(
  process.cwd(),
  "native",
  "jedit-echo-host",
  "tests",
  "support",
);
const RECORDS_PATH = path.join(
  process.cwd(),
  "native",
  "jedit-echo-host",
  "src",
  "records.rs",
);
const ROPE_FACADE_PATH = path.join(
  process.cwd(),
  "native",
  "jedit-echo-host",
  "src",
  "rope.rs",
);
const RETAINED_FACT_READER_PATH = path.join(
  process.cwd(),
  "native",
  "jedit-echo-host",
  "src",
  "rope",
  "fact_read.rs",
);
const LAWPACK_PATH = path.join(
  process.cwd(),
  "contracts",
  "jedit",
  "lawpacks",
  "replace-range-v1",
);
const PUBLISHED_ARTIFACTS = [
  "text-schema-v1.json",
  "codec-vectors-v1.json",
  "replace-range-v1.oracle.json",
];

test("ReplaceRange published lawpack artifacts match their digest sidecars", () => {
  for (const fileName of PUBLISHED_ARTIFACTS) {
    const artifactPath = path.join(LAWPACK_PATH, fileName);
    const actualDigest = crypto
      .createHash("sha256")
      .update(fs.readFileSync(artifactPath))
      .digest("hex");
    const sidecarPath = artifactPath.replace(/\.json$/, ".sha256");
    const publishedDigest = fs.readFileSync(sidecarPath, "utf8").trim();

    assert.equal(publishedDigest, actualDigest, `${fileName} sidecar drifted`);
  }
});

test("ReplaceRange scopes its historical planner checkpoint as provenance", () => {
  const schema = JSON.parse(
    fs.readFileSync(path.join(LAWPACK_PATH, "text-schema-v1.json"), "utf8"),
  );
  const corpus = JSON.parse(
    fs.readFileSync(
      path.join(LAWPACK_PATH, "replace-range-v1.oracle.json"),
      "utf8",
    ),
  );
  const expectedCommit = "c70e12d73b4b00bc92412bab67e1761f7dd22f82";

  assert.equal(corpus.semanticBaselineCommit, undefined);
  assert.equal(corpus.historicalPlannerCheckpointCommit, expectedCommit);
  assert.equal(
    schema.oracleCorpus.objectMemberOrder[4],
    "historicalPlannerCheckpointCommit",
  );
  assert.ok(
    !schema.oracleCorpus.objectMemberOrder.includes("semanticBaselineCommit"),
  );
  assert.equal(
    schema.oracleCorpus.historicalPlannerCheckpointRole,
    "provenance-only",
  );
});

test("ReplaceRange oracle support modules stay within the Rust file budget", () => {
  const oversized = fs
    .readdirSync(ORACLE_SUPPORT_PATH)
    .filter((name) => /^replace_range_.*\.rs$/.test(name))
    .map((name) => {
      const contents = fs.readFileSync(
        path.join(ORACLE_SUPPORT_PATH, name),
        "utf8",
      );
      return [name, contents.trimEnd().split(/\r?\n/).length];
    })
    .filter(([, lines]) => lines > 500);

  assert.deepEqual(oversized, []);
});

test("strict retained fact reading stays outside the rope facade", () => {
  const facade = fs.readFileSync(ROPE_FACADE_PATH, "utf8");
  assert.match(facade, /^mod fact_read;$/m);
  assert.doesNotMatch(facade, /fn read_content_fact</);

  const reader = fs.readFileSync(RETAINED_FACT_READER_PATH, "utf8");
  assert.match(reader, /pub\(super\) fn read_content_fact</);
  assert.match(reader, /content_node_id\(F::ID_DOMAIN, &bytes\)/);
});

test("fact decoding invariant names its selected reader scope", () => {
  const source = fs.readFileSync(new URL(import.meta.url), "utf8");
  const decoderTestNames = [
    ...source.matchAll(/^test\("([^"\n]*fact byte decoding[^"\n]*)"/gm),
  ].map((match) => match[1]);

  assert.deepEqual(decoderTestNames, [
    "attached, pending, and strict retained fact byte decoding is shared",
  ]);
});

test("attached, pending, and strict retained fact byte decoding is shared", () => {
  const records = fs.readFileSync(RECORDS_PATH, "utf8");
  const facade = fs.readFileSync(ROPE_FACADE_PATH, "utf8");
  const reader = fs.readFileSync(RETAINED_FACT_READER_PATH, "utf8");
  const recordsRawDecoderCount =
    records.match(/serde_json::from_slice/g)?.length ?? 0;

  assert.equal(recordsRawDecoderCount, 1);
  assert.match(records, /pub\(crate\) fn decode_fact_bytes</);
  assert.match(records, /decode_fact_bytes\(payload\.bytes\.as_ref\(\)\)/);
  assert.match(facade, /decode_fact_bytes::<F>\(&pending\.bytes\)/);
  assert.doesNotMatch(facade, /fn decode_pending|serde_json::from_slice/);
  assert.match(reader, /decode_fact_bytes::<F>\(&bytes\)/);
  assert.doesNotMatch(reader, /fn decode_fact_bytes|serde_json::from_slice/);
});

test("ReplaceRange updater isolates writers before committed-resource readers", () => {
  const packageJson = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), "package.json"), "utf8"),
  );
  const update = packageJson.scripts["lawpack:replace-range:update"];
  const check = packageJson.scripts["lawpack:replace-range:check"];

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
    "replace_range_schema",
    "replace_range_oracle",
    "replace_range_schema_conformance",
    "replace_range_corpus_conformance",
  ]) {
    assert.match(check, new RegExp(`cargo test --locked .* --test ${target}`));
  }
});
