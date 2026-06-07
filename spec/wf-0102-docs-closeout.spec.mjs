import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const REPO_ROOT = process.cwd();
const DESIGN_PATH = path.join(
  REPO_ROOT,
  'docs',
  'design',
  '0102-vim-command-line-completion-surface.md',
);
const TEARDOWN_PATH = path.join(REPO_ROOT, 'docs', 'technical-teardown.md');

test('WF-0102 closeout documents Vim command completion truth', () => {
  const design = readRepoFile(DESIGN_PATH);
  const teardown = readRepoFile(TEARDOWN_PATH);

  assert.match(teardown, /### Vim Command-Line And Completion Surface/);
  assert.match(teardown, /Pressing `:`[\s\S]*opens `WorkspaceModel\.commandLine`/);
  assert.match(teardown, /`:edit <path>` opens through `createWorkspaceTextOpenCmd`/);
  assert.match(teardown, /`:write` and `:w` call the existing save path/);
  assert.match(teardown, /`:quit` and `:q` route through normal quit confirmation/);
  assert.match(teardown, /`:wq` and `:x` write first and then request the same quit posture/);
  assert.match(teardown, /Vim command mode is the primary type-to-open surface/);
  assert.match(teardown, /`ctrl\+b` remains the standard browsable file drawer/);
  assert.match(teardown, /no longer owns printable type-to-search input/);
  assert.match(teardown, /Graft-backed symbol suggestions can use the same/);

  assert.match(design, /- \[x\] Slice 20: Update technical teardown, retrospective, and playback witness\./);
  assert.match(design, /Automated closeout playback:/);
  assert.match(design, /What changed from the design:/);
  assert.match(design, /The startup file selector remains available/);
  assert.match(design, /What remains open:/);
  assert.match(design, /PR #111: https:\/\/github\.com\/flyingrobots\/jedit\/pull\/111/);
});

function readRepoFile(filePath) {
  return readFileSync(filePath, 'utf8');
}
