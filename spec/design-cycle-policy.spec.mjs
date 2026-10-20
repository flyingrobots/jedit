import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const REPO_ROOT = process.cwd();
const AGENTS_PATH = path.join(REPO_ROOT, 'AGENTS.md');
const PROCESS_PATH = path.join(REPO_ROOT, 'docs', 'method', 'process.md');
const TEMPLATE_PATH = path.join(REPO_ROOT, 'docs', 'design', 'TEMPLATE.md');
const BEARING_PATH = path.join(REPO_ROOT, 'docs', 'BEARING.md');

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

test('BEARING distinguishes the compatibility corridor from Jim.edict', () => {
  const bearing = readRepoFile(BEARING_PATH);
  const currentTruth = sectionBetween(bearing, '## Current Truth', '## Authority Boundary');
  const authorityBoundary = sectionBetween(bearing, '## Authority Boundary', '## Artifact Boundaries');

  assert.match(currentTruth, /Production startup launches `jedit-echo-host`/);
  assert.match(
    currentTruth,
    /Buffer open\/create, insert, replace, delete, checkpoint declaration, and\s+bounded text-window reads are implemented/,
  );
  assert.match(currentTruth, /Multi-range edit, save\/export,\s+range `:why`, causal line-diff, and undo\/redo return typed obstructions/);
  assert.match(currentTruth, /checkpoint declaration and an Echo causal anchor remain separate\s+propositions/);
  assert.match(authorityBoundary, /Wesley-generated EINT and installed package/);
  assert.match(authorityBoundary, /canonical event envelope with stable\s+event, source, ordering, normalized-input, and admission coordinates/);
  assert.match(authorityBoundary, /Echo realm admits and delivers it opaquely under an exact JimRelease/);
  assert.match(authorityBoundary, /Only `jim\.core`[^\n]*interprets editor meaning/);
  assert.match(authorityBoundary, /combined Jim-and-buffer candidate/);
  assert.match(authorityBoundary, /atomically settles Jim, Buffer, result, and evidence/);
  assert.match(authorityBoundary, /CandidateSettlementRejected/);
  assert.match(authorityBoundary, /renders one declared causal view basis/);
  assert.match(authorityBoundary, /syscall stub, not Jim/);
  assert.match(
    authorityBoundary,
    /direct generated-client invocation of `ReplaceRange`\s+is permitted only in an explicitly test-only operation conformance harness/,
  );
  assert.match(bearing, /oracle is never a program/);
  assert.match(
    bearing,
    /Do not put `ReplaceRange`, rope operations, `Buffer`, or `TextWindow`\s+semantics in Echo production code/,
  );
  assert.match(bearing, /Do not reintroduce an in-process text authority/);
  assert.match(bearing, /derive undo\/redo\s+candidates from retained Echo history/i);
  assert.match(bearing, /invoke generated\s+inverse\s+operations/);
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
