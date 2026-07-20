import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  CHANGED_SECTION,
  FINAL_AUDIT_EVIDENCE_LOCATIONS,
  PROVED_SECTION,
} from "./support/replace-range-audit-ledger.mjs";

const DESIGN_PATH = path.join(
  process.cwd(),
  "docs",
  "design",
  "0158-replace-range-canonical-fact-law.md",
);
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

function readDesign() {
  return fs.readFileSync(DESIGN_PATH, "utf8");
}

function artifactDigestClaim(design) {
  const retrospective = design.split("## Retrospective")[1];
  const marker = "- **Artifact digest ledger.** ";
  const parts = retrospective.split(marker);
  assert.equal(parts.length, 2, "expected one artifact digest ledger claim");
  return parts[1].split("\n- **")[0].replaceAll(/\s+/g, " ").trim();
}

function assertArtifactDigestLedger(design = readDesign()) {
  const actualDigests = [];
  let oracleBytes;

  for (const fileName of PUBLISHED_ARTIFACTS) {
    const artifactPath = path.join(LAWPACK_PATH, fileName);
    const artifactBytes = fs.readFileSync(artifactPath);
    const actualDigest = crypto
      .createHash("sha256")
      .update(artifactBytes)
      .digest("hex");
    const sidecarPath = artifactPath.replace(/\.json$/, ".sha256");
    const publishedDigest = fs.readFileSync(sidecarPath, "utf8").trim();

    assert.equal(publishedDigest, actualDigest, `${fileName} sidecar drifted`);
    actualDigests.push(actualDigest);
    if (fileName === "replace-range-v1.oracle.json") {
      oracleBytes = artifactBytes;
    }
  }

  assert.ok(
    oracleBytes,
    "oracle artifact must be present in the published set",
  );
  const sourceSetDigest = JSON.parse(oracleBytes).sourceSet.digestHex;
  const mapping =
    /^The published SHA-256 digests are `(?<schema>[a-f0-9]{64})` for the schema, `(?<codec>[a-f0-9]{64})` for codec vectors, and `(?<oracle>[a-f0-9]{64})` for the oracle\. The oracle source-set digest is `(?<sourceSet>[a-f0-9]{64})`\./.exec(
      artifactDigestClaim(design),
    );
  assert.ok(mapping, "artifact digest ledger drift");
  assert.deepEqual(
    [
      mapping.groups.schema,
      mapping.groups.codec,
      mapping.groups.oracle,
      mapping.groups.sourceSet,
    ],
    [...actualDigests, sourceSetDigest],
    "artifact digest ledger drift",
  );
}

function retrospectiveClaims(design = readDesign()) {
  const retrospectiveParts = design.split("## Retrospective");
  assert.equal(retrospectiveParts.length, 2, "expected one Retrospective");
  const changedParts = retrospectiveParts[1].split(
    "What changed from the design:",
  );
  assert.equal(changedParts.length, 2, "expected one changed-design marker");
  const openParts = changedParts[1].split("What remains open:");
  assert.equal(openParts.length, 2, "expected one remaining-work marker");

  const claims = [];
  let currentClaim;
  let currentSection = CHANGED_SECTION;
  let testsProvedMarkers = 0;
  for (const line of openParts[0].split(/\r?\n/)) {
    if (line === "") {
      currentClaim = undefined;
      continue;
    }
    if (line === "What the tests proved:") {
      testsProvedMarkers += 1;
      currentSection = PROVED_SECTION;
      currentClaim = undefined;
      continue;
    }
    if (line.startsWith("- ")) {
      const match =
        /^- \*\*(?<evidenceClass>[^*]+)\.\*\* (?<claimText>\S.*)$/.exec(line);
      assert.ok(match, `unlabeled retrospective claim: ${line}`);
      assertPlainEvidenceProse(match.groups.claimText);
      currentClaim = {
        citations: [],
        evidenceClass: match.groups.evidenceClass,
        section: currentSection,
      };
      claims.push(currentClaim);
      continue;
    }

    assert.ok(currentClaim, `unsupported retrospective syntax: ${line}`);
    assert.doesNotMatch(
      line,
      /^\s*(?:#{1,6}\s|[-+*]\s|\d+[.)]\s|>|```|~~~|\||=+\s*$|(?:(?:\*\s*){3,}|(?:_\s*){3,}|(?:-\s*){3,})$)/,
      `unsupported retrospective syntax: ${line}`,
    );
    assert.match(line, /^  \S/, `unsupported retrospective syntax: ${line}`);
    const citation = parseEvidenceCitation(line);
    if (citation) {
      currentClaim.citations.push(citation);
    }
  }
  assert.equal(testsProvedMarkers, 1, "expected one tests-proved marker");
  return claims;
}

function evidenceCitation([commit, sourcePath, line]) {
  return {
    label: `${sourcePath}#L${line}@${commit}`,
    url: `https://github.com/flyingrobots/jedit/blob/${commit}/${sourcePath}#L${line}`,
  };
}

function parseEvidenceCitation(line) {
  const match =
    /^  \[`(?<label>[^`]+)`\]\((?<url>https:\/\/github\.com\/[^/\s)]+\/[^/\s)]+\/blob\/[^)\s]+)\)$/.exec(
      line,
    );
  if (match) {
    return { label: match.groups.label, url: match.groups.url };
  }
  assertPlainEvidenceProse(line);
  return undefined;
}

function assertPlainEvidenceProse(text) {
  assert.doesNotMatch(
    text,
    /[<>\[\]|@]|[a-z][a-z0-9+.-]*:\/\/|\bwww\./i,
    `unsupported retrospective evidence syntax: ${text}`,
  );
}

function assertRetrospectiveEvidence(design = readDesign()) {
  const claims = retrospectiveClaims(design);
  const evidenceClasses = claims.map(({ evidenceClass }) => evidenceClass);

  assert.deepEqual(
    claims.map(({ evidenceClass, section }) => [section, evidenceClass]),
    FINAL_AUDIT_EVIDENCE_LOCATIONS.map(({ evidenceClass, section }) => [
      section,
      evidenceClass,
    ]),
  );
  assert.equal(
    new Set(evidenceClasses).size,
    evidenceClasses.length,
    "retrospective evidence classes must be unique",
  );
  for (const [index, { citations }] of claims.entries()) {
    const { evidenceClass, locations } = FINAL_AUDIT_EVIDENCE_LOCATIONS[index];
    assert.deepEqual(
      citations,
      locations.map(evidenceCitation),
      `${evidenceClass} evidence drift`,
    );
  }
}

test("DL-0158 distinguishes committable evidence from obstruction evidence", () => {
  const normalized = readDesign().replaceAll(/\s+/g, " ");
  assert.match(
    normalized,
    /Successful cases name exact basis, input, support, patch, retained facts, and result\. Obstructed cases name exact basis, input, typed obstruction, no-plan posture, and unchanged-parent evidence\./,
  );
});

test("DL-0158 distinguishes separate decoding from independent verification", () => {
  const design = readDesign().replaceAll(/\s+/g, " ");
  const expected = [
    "Before a committable case is serialized, the oracle separately decodes the",
    "post-patch Buffer, Head, Rewrite, and Diff facts through a structurally separate",
    "gate using Jedit's production codec.",
  ].join(" ");
  assert.doesNotMatch(design, /oracle independently decodes/);
  assert.ok(design.includes(expected));
});

test("DL-0158 names maximum-scalar golden-vector coverage", () => {
  const design = readDesign().replaceAll(/\s+/g, " ");
  assert.match(
    design,
    /The schema's golden vector covers[^.]*the maximum scalar U\+10FFFF\./,
  );
});

test("DL-0158 records the closed native formatter gate", () => {
  const design = readDesign().replaceAll(/\s+/g, " ");
  assert.doesNotMatch(design, /baseline difference remains|does not mix/);
  assert.match(
    design,
    /The complete native crate passes `cargo fmt [^`]+ --all -- --check`\./,
  );
});

test("DL-0158 labels and pins every strong retrospective claim", () => {
  assertRetrospectiveEvidence();
});

test("DL-0158 rejects hidden retrospective claim syntax", () => {
  for (const hiddenClaim of [
    "Unlabeled inherited claim.",
    "  - Nested inherited claim.",
    "  ### Hidden inherited subsection.",
    "  <h3>Hidden inherited claim</h3>",
    "  -----",
  ]) {
    const design = readDesign().replace(
      "What the tests proved:\n",
      `What the tests proved:\n${hiddenClaim}\n`,
    );

    assert.throws(
      () => assertRetrospectiveEvidence(design),
      /unsupported retrospective syntax/,
    );
  }

  const firstCitation =
    "  [`native/jedit-echo-host/tests/replace_range_oracle.rs#L22@9ffc0e4aa9313eba3774be970adbc1b976e5888a`](https://github.com/flyingrobots/jedit/blob/9ffc0e4aa9313eba3774be970adbc1b976e5888a/native/jedit-echo-host/tests/replace_range_oracle.rs#L22)";
  const blankSeparated = readDesign().replace(
    firstCitation,
    `${firstCitation}\n\n  Blank-separated inherited claim.`,
  );
  assert.throws(
    () => assertRetrospectiveEvidence(blankSeparated),
    /unsupported retrospective syntax/,
  );
});

test("DL-0158 rejects hidden and noncanonical evidence links", () => {
  const citation =
    "  [`native/jedit-echo-host/tests/replace_range_oracle.rs#L22@9ffc0e4aa9313eba3774be970adbc1b976e5888a`](https://github.com/flyingrobots/jedit/blob/9ffc0e4aa9313eba3774be970adbc1b976e5888a/native/jedit-echo-host/tests/replace_range_oracle.rs#L22)";
  for (const replacement of [
    `  <!-- ${citation.trim()} -->`,
    `${citation}\n  [misleading](https://example.com/evidence)`,
    `${citation}\n  <h3>Hidden inherited claim</h3>`,
    `${citation}\n  <?hidden claim?>`,
    `${citation}\n  <!DOCTYPE hidden>`,
    `${citation}\n  <![CDATA[hidden]]>`,
    `${citation}\n  -----`,
    `${citation}\n  ***`,
    `${citation}\n  ___`,
    `${citation}\n  [](/flyingrobots/jedit/blob/hidden)`,
    `${citation}\n  ![](/evidence)`,
    `${citation}\n  [][existing-reference]`,
    `${citation}\n  www.github.com/flyingrobots/jedit/blob/main/hidden`,
    `${citation}\n  HTTPS://github.com/flyingrobots/jedit/blob/main/hidden`,
    `${citation}\n  Hidden claim | Undeclared evidence\n  --- | ---\n  value | www.github.com/flyingrobots/jedit/blob/main/hidden`,
  ]) {
    const design = readDesign().replace(citation, replacement);
    assert.throws(() => assertRetrospectiveEvidence(design));
  }

  const firstLine = "- **Native schema corpus.** Native oracle generation";
  const linkedFirstLine = `${firstLine} [misleading](https://example.com)`;
  const design = readDesign().replace(firstLine, linkedFirstLine);
  assert.throws(() => assertRetrospectiveEvidence(design));
});

test("DL-0158 binds claims to their retrospective section", () => {
  const design = readDesign()
    .replace("What the tests proved:\n\n", "")
    .replace(
      "What changed from the design:\n\n",
      "What changed from the design:\n\nWhat the tests proved:\n\n",
    );

  assert.throws(() => assertRetrospectiveEvidence(design));
});

test("DL-0158 rejects a missing secondary claim citation", () => {
  const citation =
    "  [`native/jedit-echo-host/tests/support/replace_range_source_set.rs#L5@9ffc0e4aa9313eba3774be970adbc1b976e5888a`](https://github.com/flyingrobots/jedit/blob/9ffc0e4aa9313eba3774be970adbc1b976e5888a/native/jedit-echo-host/tests/support/replace_range_source_set.rs#L5)\n";
  const design = readDesign().replace(citation, "");
  assert.notEqual(design, readDesign(), "secondary citation fixture drifted");

  assert.throws(
    () => assertRetrospectiveEvidence(design),
    /Schema and source-set contract evidence drift/,
  );
});

test("DL-0158 rejects a citation label that disagrees with its URL", () => {
  const canonical =
    "native/jedit-echo-host/tests/replace_range_oracle.rs#L22@9ffc0e4aa9313eba3774be970adbc1b976e5888a";
  const design = readDesign().replace(canonical, canonical.replace("@", ":"));
  assert.notEqual(design, readDesign(), "citation-label fixture drifted");

  assert.throws(
    () => assertRetrospectiveEvidence(design),
    /Native schema corpus evidence drift/,
  );
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
  assert.doesNotMatch(readDesign(), /semanticBaselineCommit/);
  assert.match(readDesign(), /historical provenance only/);
});

test("DL-0158 retrospective binds every published artifact digest", () => {
  assertArtifactDigestLedger();
});

test("DL-0158 rejects artifact digests under the wrong labels", () => {
  const schemaDigest = fs
    .readFileSync(path.join(LAWPACK_PATH, "text-schema-v1.sha256"), "utf8")
    .trim();
  const codecDigest = fs
    .readFileSync(path.join(LAWPACK_PATH, "codec-vectors-v1.sha256"), "utf8")
    .trim();
  const sentinel = "digest-swap-sentinel";
  const swapped = readDesign()
    .replace(schemaDigest, sentinel)
    .replace(codecDigest, schemaDigest)
    .replace(sentinel, codecDigest);

  assert.throws(
    () => assertArtifactDigestLedger(swapped),
    /artifact digest ledger drift/,
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

test("native fact byte decoding has one shared implementation", () => {
  const records = fs.readFileSync(RECORDS_PATH, "utf8");
  const facade = fs.readFileSync(ROPE_FACADE_PATH, "utf8");
  const reader = fs.readFileSync(RETAINED_FACT_READER_PATH, "utf8");
  const rawDecoderCount = [records, facade, reader].reduce(
    (count, source) =>
      count + (source.match(/serde_json::from_slice/g) ?? []).length,
    0,
  );

  assert.equal(rawDecoderCount, 1);
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
