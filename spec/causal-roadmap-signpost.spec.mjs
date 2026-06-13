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
