import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const REPO_ROOT = process.cwd();
const AGENTS_PATH = path.join(REPO_ROOT, 'AGENTS.md');
const PROCESS_PATH = path.join(REPO_ROOT, 'docs', 'method', 'process.md');
const TEMPLATE_PATH = path.join(REPO_ROOT, 'docs', 'design', 'TEMPLATE.md');
const POLICY_DESIGN_PATH = path.join(REPO_ROOT, 'docs', 'design', '0034-design-cycle-template-and-lifecycle.md');
const BEARING_PATH = path.join(REPO_ROOT, 'docs', 'BEARING.md');
const WHY_OBSERVATION_ROADMAP_PATH = path.join(
  REPO_ROOT,
  'docs',
  'design',
  '0108a-why-observation-evidence-roadmap.md',
);
const GRAPH_RUNTIME_DISCOVERY_PATH = path.join(
  REPO_ROOT,
  'docs',
  'design',
  '0149-graph-backed-rope-runtime-discovery.md',
);
const GRAPH_RUNTIME_RED_MATRIX_PATH = path.join(REPO_ROOT, 'spec', 'graph-rope-runtime-red-matrix.spec.mjs');

const REQUIRED_TEMPLATE_HEADINGS = Object.freeze([
  '## Linked Issue',
  '## Decision Summary',
  '## Sponsored Human',
  '## Sponsored Agent',
  '## Hill',
  '## Current Truth',
  '## Problem',
  '## Scope',
  '## Non-Goals',
  '## User Experience / Product Shape',
  '## Runtime / API Contract',
  '## Lower Modes',
  '## Accessibility Posture',
  '## Localization / Directionality Posture',
  '## Agent Inspectability / Explainability Posture',
  '## Implementation Slices',
  '## Tests To Write First',
  '## Acceptance Criteria',
  '## Validation Plan',
  '## Playback / Witness',
  '## Retrospective',
]);

const REQUIRED_PROCESS_SECTIONS = Object.freeze([
  '## Cycle Doctrine',
  '## Design Classes',
  '## Starting A Full Cycle',
  '## During A Cycle',
  '## Ready For Review',
  '## Landing A Cycle',
]);

const GRAPH_RUNTIME_RED_WITNESSES = Object.freeze([
  'RED: graph-backed runtime retention is not O(buffer size * edit count)',
  'RED: narrow replacement preserves untouched subtree identity recursively',
  'RED: no-op replacement emits no new text head rewrite diff or worldline advance',
  'RED: save and export read from a named head or checkpoint without mutating text authority',
  'RED: range why cites head leaf blob rewrite diff tick checkpoint and basis evidence',
]);

function readRepoFile(filePath) {
  return readFileSync(filePath, 'utf8');
}

test('full cycle design template includes the required proof-oriented sections', () => {
  const template = readRepoFile(TEMPLATE_PATH);

  for (const heading of REQUIRED_TEMPLATE_HEADINGS) {
    assert.match(template, new RegExp(`^${escapeRegExp(heading)}$`, 'm'), `${heading} missing from template`);
  }

  assert.match(template, /documentation tests cannot be the only proof for implementation work/);
  assert.match(template, /Echo authority boundary/);
  assert.match(template, /Graft API boundary/);
  assert.match(template, /terminal size constraints/);
  assert.match(template, /Agent Inspectability/);
});

test('WF-0108A roadmap preserves required full-cycle design headings', () => {
  const roadmap = readRepoFile(WHY_OBSERVATION_ROADMAP_PATH);

  for (const heading of REQUIRED_TEMPLATE_HEADINGS) {
    assert.match(roadmap, new RegExp(`^${escapeRegExp(heading)}$`, 'm'), `${heading} missing from WF-0108A`);
  }
});

test('HT-0149 runtime discovery pins Current Truth evidence to git SHAs', () => {
  const discovery = readRepoFile(GRAPH_RUNTIME_DISCOVERY_PATH);
  const sha = '[0-9a-f]{40}';

  for (const repoPath of [
    'src/domain/text-edit-contract.ts',
    'src/ports/hot-text-runtime.ts',
    'src/adapters/in-memory-hot-text-runtime.ts',
    'src/adapters/installed-jedit-contract-echo-transport.ts',
    'docs/design/jedit-echo-graph-model.md',
  ]) {
    assert.match(
      discovery,
      new RegExp(`https://github\\.com/flyingrobots/jedit/blob/${sha}/${escapeRegExp(repoPath)}#L\\d+`),
      `${repoPath} needs a pinned Current Truth evidence link`,
    );
  }
});

test('HT-0149 rope fact validation receives admission context', () => {
  const discovery = readRepoFile(GRAPH_RUNTIME_DISCOVERY_PATH);

  assert.match(discovery, /^interface RopeFactValidationContext \{$/m);
  assert.match(discovery, /readonly writeSet: readonly RopeAdmittedFact\[\];/);
  assert.match(discovery, /readonly admittedBasis:/);
  assert.match(discovery, /readonly blobStore:/);
  assert.match(discovery, /readonly hash: TextBlobHashPort;/);
  assert.match(
    discovery,
    /declare function validateRopeFact\(\n  payload: RopeAdmittedFact,\n  context: RopeFactValidationContext,\n\): FactValidationResult</,
  );
});

test('HT-0149 defines rewrite diff and tick receipt facts', () => {
  const discovery = readRepoFile(GRAPH_RUNTIME_DISCOVERY_PATH);

  for (const factName of ['RopeRewriteFact', 'RopeDiffFact', 'TickReceiptFact']) {
    assert.match(discovery, new RegExp(`^interface ${factName} \\{$`, 'm'));
  }

  assert.match(discovery, /^interface TextByteRange \{$/m);
  assert.match(discovery, /readonly range: TextByteRange;/);
  assert.match(discovery, /readonly diffId: RopeDiffId;/);
  assert.match(discovery, /readonly spans: readonly RopeDiffSpan\[\];/);
  assert.match(discovery, /readonly admittedAtSequence: number;/);
});

test('HT-0149 checkpoint fact carries schema version', () => {
  const discovery = readRepoFile(GRAPH_RUNTIME_DISCOVERY_PATH);

  assert.match(discovery, /interface RopeCheckpointFact \{[\s\S]*readonly schemaVersion: 1;/);
});

test('HT-0149 checkpoint facts are validated rather than deferred', () => {
  const discovery = readRepoFile(GRAPH_RUNTIME_DISCOVERY_PATH);
  const deferredFacts = sectionBetween(discovery, 'The full design must also define facts for:', 'Echo remains generic.');
  const admittedFacts = sectionBetween(discovery, 'type RopeAdmittedFact =', 'interface RopeFactReadModel');

  assert.match(admittedFacts, /\| TickReceiptFact/);
  assert.match(admittedFacts, /\| RopeCheckpointFact;/);
  assert.match(discovery, /\): FactValidationResult<RopeAdmittedFact>;/);
  assert.doesNotMatch(deferredFacts, /`RopeCheckpoint`/);
});

test('HT-0149 validation exposes typed admitted facts', () => {
  const discovery = readRepoFile(GRAPH_RUNTIME_DISCOVERY_PATH);

  assert.match(discovery, /^type RopeAdmittedFact =$/m);
  assert.match(discovery, /getFact\(id: string\): RopeAdmittedFact \| null;/);
  assert.match(discovery, /\): FactValidationResult<RopeAdmittedFact>;/);
  assert.doesNotMatch(discovery, /hasFact\(id: string\): boolean;/);
  assert.match(discovery, /reference validation must retrieve typed facts/);
});

test('HT-0149 diff spans are kind-specific', () => {
  const discovery = readRepoFile(GRAPH_RUNTIME_DISCOVERY_PATH);

  for (const spanName of ['RopeEqualDiffSpan', 'RopeDeleteDiffSpan', 'RopeInsertDiffSpan']) {
    assert.match(discovery, new RegExp(`^interface ${spanName} \\{$`, 'm'));
  }

  assert.match(discovery, /^type RopeDiffSpan = RopeEqualDiffSpan \| RopeDeleteDiffSpan \| RopeInsertDiffSpan;$/m);
  assert.doesNotMatch(discovery, /readonly kind: "equal" \| "delete" \| "insert";/);
  assert.doesNotMatch(discovery, /readonly basisRange\?: TextByteRange;/);
  assert.match(discovery, /diff spans are kind-specific/);
});

test('HT-0149 tick receipt facts carry content hash', () => {
  const discovery = readRepoFile(GRAPH_RUNTIME_DISCOVERY_PATH);

  assert.match(discovery, /interface TickReceiptFact \{[\s\S]*readonly contentHash: Hash;/);
});

test('HT-0149 defines structural maintenance facts for rebalance exceptions', () => {
  const discovery = readRepoFile(GRAPH_RUNTIME_DISCOVERY_PATH);
  const admittedFacts = sectionBetween(discovery, 'type RopeAdmittedFact =', 'interface RopeFactReadModel');

  assert.match(discovery, /^type RopeStructuralMaintenanceId =/m);
  assert.match(discovery, /^type RopeStructuralMaintenanceOperation =$/m);
  assert.match(discovery, /^interface RopeStructuralMaintenanceFact \{$/m);
  assert.match(discovery, /readonly operation: RopeStructuralMaintenanceOperation;/);
  assert.match(discovery, /readonly replacedNodeIds: readonly RopeNodeId\[\];/);
  assert.match(discovery, /readonly replacementNodeIds: readonly RopeNodeId\[\];/);
  assert.match(discovery, /readonly affectedRange: TextByteRange;/);
  assert.match(admittedFacts, /\| RopeStructuralMaintenanceFact/);
  assert.match(discovery, /structural maintenance facts must reference the semantic rewrite/);
});

test('HT-0149 specifies concrete rope balance invariants', () => {
  const discovery = readRepoFile(GRAPH_RUNTIME_DISCOVERY_PATH);

  assert.match(discovery, /target leaf byte length is 4096 bytes/);
  assert.match(discovery, /minimum non-edge leaf byte length is 1024 bytes/);
  assert.match(discovery, /maximum leaf byte length is 8192 bytes/);
  assert.match(discovery, /branch height difference must be no greater than 1/);
});

test('HT-0149 follow-on debt is issue-backed', () => {
  const discovery = readRepoFile(GRAPH_RUNTIME_DISCOVERY_PATH);
  const followOnDebt = sectionBetween(discovery, '## Follow-On Debt', '## Retrospective');
  const issueLinks = followOnDebt.match(/https:\/\/github\.com\/flyingrobots\/jedit\/issues\/\d+/g) ?? [];

  assert.ok(issueLinks.length >= 6, 'follow-on debt should link tracker issues for every deferred item');
  assert.doesNotMatch(followOnDebt, /should create narrower issues/);
});

test('HT-0149 graph runtime RED matrix declares all Slice 4 witnesses', () => {
  const discovery = readRepoFile(GRAPH_RUNTIME_DISCOVERY_PATH);
  const redMatrix = readRepoFile(GRAPH_RUNTIME_RED_MATRIX_PATH);

  assert.match(discovery, /\[x\] Slice 4: Add failing retention/);

  for (const witnessName of GRAPH_RUNTIME_RED_WITNESSES) {
    assert.match(redMatrix, new RegExp(escapeRegExp(`test.skip('${witnessName}`)));
  }
});

test('BEARING blocks why work on graph runtime proof', () => {
  const bearing = readRepoFile(BEARING_PATH);

  assert.match(bearing, /Do not resume the `:why` evidence gap sequence until/);
  assert.match(bearing, /graph-backed\s+create\/read\/replace\/checkpoint path and witnesses land/);
});

test('process doc defines the official cycle lifecycle and proof boundary', () => {
  const processDoc = readRepoFile(PROCESS_PATH);

  for (const heading of REQUIRED_PROCESS_SECTIONS) {
    assert.match(processDoc, new RegExp(`^${escapeRegExp(heading)}$`, 'm'), `${heading} missing from process doc`);
  }

  assert.match(processDoc, /A design doc defines intent\. It does not prove implementation\./);
  assert.match(processDoc, /Every implementation cycle must name at least one executable witness/);
  assert.match(processDoc, /Create a new branch from the merge target/);
  assert.match(processDoc, /Apply `work-in-progress` to the GitHub issue and PR/);
  assert.match(processDoc, /Draft PRs are allowed only for cycle kickoff and active cycle work/);
  assert.match(processDoc, /Never rebase a cycle branch/);
});

test('agent contract points future agents at the process and template', () => {
  const agents = readRepoFile(AGENTS_PATH);

  assert.match(agents, /`docs\/method\/process\.md` is the canonical cycle workflow/);
  assert.match(agents, /`docs\/design\/TEMPLATE\.md` is the required template for full cycle designs/);
  assert.match(agents, /Design docs define intent\. They do not prove implementation\./);
  assert.match(agents, /Fill in the design doc retrospective before marking the PR ready/);
});

test('policy design links the GitHub issue and records the retrospective', () => {
  const policy = readRepoFile(POLICY_DESIGN_PATH);

  assert.match(policy, /issue: "https:\/\/github\.com\/flyingrobots\/jedit\/issues\/51"/);
  assert.match(policy, /## Retrospective/);
  assert.match(policy, /What the tests proved:/);
  assert.match(policy, /Other repositories still need their own adapted templates/);
});

function sectionBetween(documentText, startHeading, endHeading) {
  const start = documentText.indexOf(startHeading);
  const end = documentText.indexOf(endHeading, start + startHeading.length);

  assert.notEqual(start, -1, `${startHeading} missing`);
  assert.notEqual(end, -1, `${endHeading} missing`);

  return documentText.slice(start, end);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
