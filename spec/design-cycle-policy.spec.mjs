import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const REPO_ROOT = process.cwd();
const AGENTS_PATH = path.join(REPO_ROOT, 'AGENTS.md');
const PROCESS_PATH = path.join(REPO_ROOT, 'docs', 'method', 'process.md');
const TEMPLATE_PATH = path.join(REPO_ROOT, 'docs', 'design', 'TEMPLATE.md');
const POLICY_DESIGN_PATH = path.join(REPO_ROOT, 'docs', 'design', '0034-design-cycle-template-and-lifecycle.md');
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
  assert.match(discovery, /readonly writeSet:/);
  assert.match(discovery, /readonly admittedBasis:/);
  assert.match(discovery, /readonly blobStore:/);
  assert.match(
    discovery,
    /declare function validateRopeFact\(\n  payload: object,\n  context: RopeFactValidationContext,\n\): FactValidationResult</,
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

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
