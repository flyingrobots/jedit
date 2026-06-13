import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const REPO_ROOT = process.cwd();
const CAUSAL_ROADMAP_PATH = path.join(REPO_ROOT, 'docs', 'design', '0108-causal-command-provenance-surface.md');
const GEORDI_ROADMAP_PATH = path.join(REPO_ROOT, 'docs', 'design', '0107-geordi-raytraced-title-render-pipeline.md');

function readRepoFile(filePath) {
  return readFileSync(filePath, 'utf8');
}

test('title-render follow-up arcs do not reserve active Jim cycle ids', () => {
  const causalRoadmap = readRepoFile(CAUSAL_ROADMAP_PATH);
  const geordiRoadmap = readRepoFile(GEORDI_ROADMAP_PATH);

  assert.match(causalRoadmap, /WF-0108 - Jim Command Provenance And :why/);
  assert.doesNotMatch(geordiRoadmap, /WF-0108 - Bijou UI GraphQL Profile/);
  assert.doesNotMatch(geordiRoadmap, /WF-0109 - Geordi Scene3D Authoring Profile/);
  assert.match(geordiRoadmap, /WF-0112 - Bijou UI GraphQL Profile/);
  assert.match(geordiRoadmap, /WF-0113 - Geordi Scene3D Authoring Profile/);
});

test('WF-0108 current truth cites merge-target evidence links', () => {
  const causalRoadmap = readRepoFile(CAUSAL_ROADMAP_PATH);
  const currentTruth = sectionBetween(causalRoadmap, '## Current Truth', '## Problem');
  const evidenceLinks = currentTruth.match(
    /https:\/\/github\.com\/flyingrobots\/jedit\/blob\/[0-9a-f]{40}\/[^)\s]+#L[0-9]+/g,
  );

  assert.ok(evidenceLinks, 'Current Truth should include fully-qualified GitHub evidence links');
  assert.ok(evidenceLinks.length >= 7, 'Current Truth should cite every strong baseline claim');
});

test('WF-0108 validation commands are runnable shell commands', () => {
  const causalRoadmap = readRepoFile(CAUSAL_ROADMAP_PATH);
  const validationPlan = sectionBetween(causalRoadmap, '## Validation Plan', '## Playback / Witness');

  assert.doesNotMatch(validationPlan, /spec\/<[^>]+>\.spec\.mjs/);
});

test('WF-0108 follow-on debt is issue-backed', () => {
  const causalRoadmap = readRepoFile(CAUSAL_ROADMAP_PATH);
  const followOnDebt = sectionBetween(causalRoadmap, '## Follow-On Debt', '## Retrospective');
  const debtItems = followOnDebt
    .split('\n')
    .filter((line) => line.startsWith('- '));

  assert.ok(debtItems.length >= 10, 'expected issue-backed follow-on items');
  for (const item of debtItems) {
    assert.match(item, /^- \[[^\]]+\]\(https:\/\/github\.com\/flyingrobots\/jedit\/issues\/[0-9]+\)\.?$/);
  }
});

test('WF-0108 playback exits insert mode before :why', () => {
  const causalRoadmap = readRepoFile(CAUSAL_ROADMAP_PATH);
  const playback = sectionBetween(causalRoadmap, '## Playback / Witness', 'Current repo command');

  assert.match(playback, /<replacement>\n<Esc>\n:why/);
});

function sectionBetween(documentText, startHeading, endHeading) {
  const start = documentText.indexOf(startHeading);
  const end = documentText.indexOf(endHeading, start);

  assert.notEqual(start, -1, `${startHeading} missing`);
  assert.notEqual(end, -1, `${endHeading} missing after ${startHeading}`);

  return documentText.slice(start, end);
}
