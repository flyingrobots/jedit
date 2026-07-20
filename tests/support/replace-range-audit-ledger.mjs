const EVIDENCE_PATHS = {
  basisWitness:
    "native/jedit-echo-host/tests/support/replace_range_basis_witness.rs",
  consequence:
    "native/jedit-echo-host/tests/support/replace_range_consequence.rs",
  contract: "native/jedit-echo-host/tests/support/replace_range_contract.rs",
  corpusConformance:
    "native/jedit-echo-host/tests/replace_range_corpus_conformance.rs",
  fault: "native/jedit-echo-host/src/rope/fault.rs",
  lawCycle: "tests/replace-range-law-cycle.spec.mjs",
  legacy: "native/jedit-echo-host/tests/support/replace_range_legacy.rs",
  oracle: "native/jedit-echo-host/tests/replace_range_oracle.rs",
  oracleSupport: "native/jedit-echo-host/tests/support/replace_range_oracle.rs",
  packageManifest: "package.json",
  replace: "native/jedit-echo-host/src/rope/replace.rs",
  schema: "native/jedit-echo-host/tests/replace_range_schema.rs",
  schemaConformance:
    "native/jedit-echo-host/tests/replace_range_schema_conformance.rs",
  sourceSet: "native/jedit-echo-host/tests/support/replace_range_source_set.rs",
};

const EVIDENCE_COMMITS = {
  arithmetic: "9930d04bed048d69f54ef08d5f25f5c211efa199",
  auditLocations: "a8cabbd8d68c5345cdea5cba0bb59b956ec7be63",
  basisRelationships: "d57e0d239c005898839a15041807580ed2dfe595",
  bufferIdentity: "751ea54360f2633ee04f472bb18ad07c47cef61f",
  canonicalBytes: "8112752b85862d065811fbe133fdfe8f9e8021c1",
  currentPatch: "475b6dcc0eae9edbf228221069ab3aab975be868",
  declaredText: "afd06f652aad7d6e8f389efec49e1ea1469eef88",
  digestLedger: "95f63d2c31847c3a4cc4bbea9152900470843d3a",
  evidenceGrade: "d87e7a1891cbefb6cf478bbc9b6a9ed87121b242",
  invocationLexemes: "c0214b2fe52ef3a3cb2d09e24af9cd4a3258ca0c",
  nodeTyping: "6c20d93ff94a8b0e24e6d3fc05492f99f27a56e8",
  resourceUpdater: "13b16f2e7195458138865460c5948744ea8615ed",
  strictCorpus: "9a309641edd4b809c37f5d055790de311e5d61f9",
  typeDomain: "f5482c4e7797e043c006adf1de293d4dfe85e13a",
  typedCorpus: "9ffc0e4aa9313eba3774be970adbc1b976e5888a",
  typedPlanner: "b4606ce74ab37f8cc54d184a17c8eaeea2dff092",
  unicodeScalar: "79a3b788d102c0b04fb47c1d3ce972dbab32a1cc",
  warpIdentifiers: "edd41a35058fea354d46a38421641b0c173e3faa",
};

export const CHANGED_SECTION = "changed";
export const PROVED_SECTION = "tests-proved";

function evidenceLocations(commit, sourcePath, ...lines) {
  return lines.map((line) => [commit, sourcePath, line]);
}

function auditClaim(section, evidenceClass, locations) {
  return { evidenceClass, locations, section };
}

export const FINAL_AUDIT_EVIDENCE_LOCATIONS = [
  auditClaim(
    CHANGED_SECTION,
    "Native schema corpus",
    evidenceLocations(
      EVIDENCE_COMMITS.typedCorpus,
      EVIDENCE_PATHS.oracle,
      22,
      23,
      24,
      30,
      31,
      35,
    ),
  ),
  auditClaim(
    CHANGED_SECTION,
    "Retained stale-basis relationship",
    evidenceLocations(
      EVIDENCE_COMMITS.basisRelationships,
      EVIDENCE_PATHS.basisWitness,
      59,
    ),
  ),
  auditClaim(
    CHANGED_SECTION,
    "Retained foreign-basis relationship",
    evidenceLocations(
      EVIDENCE_COMMITS.basisRelationships,
      EVIDENCE_PATHS.basisWitness,
      68,
    ),
  ),
  auditClaim(CHANGED_SECTION, "Schema and source-set contract", [
    ...evidenceLocations(
      EVIDENCE_COMMITS.typedCorpus,
      EVIDENCE_PATHS.schemaConformance,
      86,
    ),
    ...evidenceLocations(
      EVIDENCE_COMMITS.typedCorpus,
      EVIDENCE_PATHS.sourceSet,
      5,
      70,
    ),
  ]),
  auditClaim(CHANGED_SECTION, "Obstruction schema", [
    ...evidenceLocations(
      EVIDENCE_COMMITS.typedCorpus,
      EVIDENCE_PATHS.contract,
      3,
      20,
    ),
    ...evidenceLocations(
      EVIDENCE_COMMITS.typedCorpus,
      EVIDENCE_PATHS.schemaConformance,
      336,
      362,
    ),
  ]),
  auditClaim(
    CHANGED_SECTION,
    "Artifact digest ledger",
    evidenceLocations(
      EVIDENCE_COMMITS.digestLedger,
      EVIDENCE_PATHS.lawCycle,
      76,
    ),
  ),
  auditClaim(
    CHANGED_SECTION,
    "Serialized resource updates",
    evidenceLocations(
      EVIDENCE_COMMITS.resourceUpdater,
      EVIDENCE_PATHS.packageManifest,
      10,
    ),
  ),
  auditClaim(
    CHANGED_SECTION,
    "Exact audit locations",
    evidenceLocations(
      EVIDENCE_COMMITS.auditLocations,
      EVIDENCE_PATHS.lawCycle,
      32,
      110,
    ),
  ),
  auditClaim(PROVED_SECTION, "Native serialization", [
    ...evidenceLocations(
      EVIDENCE_COMMITS.typedCorpus,
      EVIDENCE_PATHS.schema,
      89,
    ),
    ...evidenceLocations(
      EVIDENCE_COMMITS.typedCorpus,
      EVIDENCE_PATHS.schemaConformance,
      86,
    ),
  ]),
  auditClaim(
    PROVED_SECTION,
    "Supplementary Unicode scalar",
    evidenceLocations(
      EVIDENCE_COMMITS.unicodeScalar,
      EVIDENCE_PATHS.schemaConformance,
      290,
    ),
  ),
  auditClaim(
    PROVED_SECTION,
    "Type-ID domain binding",
    evidenceLocations(
      EVIDENCE_COMMITS.typeDomain,
      EVIDENCE_PATHS.schemaConformance,
      308,
    ),
  ),
  auditClaim(
    PROVED_SECTION,
    "Strict typed corpus validation",
    evidenceLocations(
      EVIDENCE_COMMITS.strictCorpus,
      EVIDENCE_PATHS.corpusConformance,
      120,
    ),
  ),
  auditClaim(
    PROVED_SECTION,
    "Canonical oracle bytes",
    evidenceLocations(
      EVIDENCE_COMMITS.canonicalBytes,
      EVIDENCE_PATHS.corpusConformance,
      70,
    ),
  ),
  auditClaim(
    PROVED_SECTION,
    "WARP-qualified identifiers",
    evidenceLocations(
      EVIDENCE_COMMITS.warpIdentifiers,
      EVIDENCE_PATHS.oracleSupport,
      393,
    ),
  ),
  auditClaim(
    PROVED_SECTION,
    "Invocation lexical validation",
    evidenceLocations(
      EVIDENCE_COMMITS.invocationLexemes,
      EVIDENCE_PATHS.schemaConformance,
      396,
    ),
  ),
  auditClaim(PROVED_SECTION, "Typed planner obstructions", [
    ...evidenceLocations(
      EVIDENCE_COMMITS.typedPlanner,
      EVIDENCE_PATHS.replace,
      14,
      72,
      99,
      118,
    ),
    ...evidenceLocations(
      EVIDENCE_COMMITS.typedPlanner,
      EVIDENCE_PATHS.legacy,
      15,
    ),
  ]),
  auditClaim(PROVED_SECTION, "Retained arithmetic refusal", [
    ...evidenceLocations(
      EVIDENCE_COMMITS.arithmetic,
      EVIDENCE_PATHS.fault,
      59,
      66,
    ),
    ...evidenceLocations(
      EVIDENCE_COMMITS.arithmetic,
      EVIDENCE_PATHS.oracle,
      310,
      387,
    ),
    ...evidenceLocations(
      EVIDENCE_COMMITS.arithmetic,
      EVIDENCE_PATHS.oracleSupport,
      214,
      223,
      246,
    ),
  ]),
  auditClaim(
    PROVED_SECTION,
    "Declared-text consequence",
    evidenceLocations(
      EVIDENCE_COMMITS.declaredText,
      EVIDENCE_PATHS.oracleSupport,
      316,
    ),
  ),
  auditClaim(
    PROVED_SECTION,
    "Keyed Buffer identity",
    evidenceLocations(
      EVIDENCE_COMMITS.bufferIdentity,
      EVIDENCE_PATHS.consequence,
      42,
    ),
  ),
  auditClaim(
    PROVED_SECTION,
    "Current-patch consequence selection",
    evidenceLocations(
      EVIDENCE_COMMITS.currentPatch,
      EVIDENCE_PATHS.consequence,
      113,
    ),
  ),
  auditClaim(
    PROVED_SECTION,
    "Retained node-record typing",
    evidenceLocations(
      EVIDENCE_COMMITS.nodeTyping,
      EVIDENCE_PATHS.consequence,
      242,
    ),
  ),
  auditClaim(
    PROVED_SECTION,
    "Evidence-grade boundary",
    evidenceLocations(
      EVIDENCE_COMMITS.evidenceGrade,
      EVIDENCE_PATHS.oracleSupport,
      177,
    ),
  ),
];
