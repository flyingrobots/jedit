import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const DESIGN_PATH = path.join(
  process.cwd(),
  'docs',
  'design',
  '0158-replace-range-canonical-fact-law.md',
);

function readDesign() {
  return fs.readFileSync(DESIGN_PATH, 'utf8');
}

test('DL-0158 distinguishes committable evidence from obstruction evidence', () => {
  const normalized = readDesign().replaceAll(/\s+/g, ' ');
  assert.match(
    normalized,
    /Successful cases name exact basis, input, support, patch, retained facts, and result\. Obstructed cases name exact basis, input, typed obstruction, no-plan posture, and unchanged-parent evidence\./,
  );
});
