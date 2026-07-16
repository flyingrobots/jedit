import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { REPO_ROOT } from './dist-helpers.mjs';

const DESIGN_PATH = path.join(
  REPO_ROOT,
  'docs',
  'design',
  '0157-rope-fact-inspector-and-range-why.md',
);
const MOCKUP_PATHS = [
  '0157-rope-fact-inspector-wide.svg',
  '0157-rope-fact-inspector-narrow.svg',
  '0157-rope-fact-inspector-xs.svg',
].map(fileName => path.join(REPO_ROOT, 'docs', 'design', fileName));

test('rope fact inspector design pins the runtime evidence chain', () => {
  const design = fs.readFileSync(DESIGN_PATH, 'utf8');

  assert.match(design, /issues\/209/);
  assert.match(design, /0149-graph-backed-rope-runtime-discovery/);
  assert.match(design, /pull\/205/);
  for (const evidenceKind of [
    'RopeHead',
    'leaf',
    'blob',
    'rewrite',
    'diff',
    'text-tick',
    'checkpoint',
    'anchor',
  ]) {
    assert.match(design, new RegExp(evidenceKind, 'i'));
  }
});

test('range why contract is basis-pinned bounded and fragmented', () => {
  const design = fs.readFileSync(DESIGN_PATH, 'utf8');

  for (const field of [
    'basisHeadId',
    'queriedRange',
    'maxFacts',
    'maxDepth',
    'maxHistoricalTextBytes',
    'coverage',
    'fragments',
    'continuation',
  ]) {
    assert.match(design, new RegExp(`\\b${field}\\b`));
  }
  assert.match(design, /checkpoint declaration does not imply/i);
  assert.match(design, /multiple fragments/i);
  assert.match(design, /stale evidence fails closed/i);
});

test('responsive inspector mockups use named semantic token roles', () => {
  const design = fs.readFileSync(DESIGN_PATH, 'utf8');

  for (const mockupPath of MOCKUP_PATHS) {
    const fileName = path.basename(mockupPath);
    const svg = fs.readFileSync(mockupPath, 'utf8');
    assert.match(design, new RegExp(fileName.replaceAll('.', '\\.')));
    assert.match(svg, /<svg[^>]+role="img"/);
    assert.match(svg, /surface\.workspace/);
    assert.match(svg, /evidence\.identity/);
    assert.match(svg, /class="workspace"/);
    assert.match(svg, /class="identity/);
    assert.doesNotMatch(svg, /\b(?:fill|stroke)="#[0-9a-fA-F]+"/);
  }
});

test('deferred deleted-text and semantic-scope work is issue-backed', () => {
  const design = fs.readFileSync(DESIGN_PATH, 'utf8');

  assert.match(design, /issues\/278/);
  assert.match(design, /issues\/279/);
});
