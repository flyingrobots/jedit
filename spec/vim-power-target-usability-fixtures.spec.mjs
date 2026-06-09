import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const REPO_ROOT = process.cwd();
const FIXTURES_PATH = path.join(REPO_ROOT, 'docs', 'design', '0105-vim-power-target-usability-fixtures.json');
const MATRIX_PATH = path.join(REPO_ROOT, 'docs', 'design', '0105-vim-power-moves-parity-matrix.json');
const DESIGN_PATH = 'docs/design/0105-vim-power-moves-causal-parity.md';
const MATRIX_REPO_PATH = 'docs/design/0105-vim-power-moves-parity-matrix.json';

const REQUIRED_WORKFLOWS = Object.freeze([
  'open-edit-save-reopen',
  'text-object-surgery',
  'search-substitute-confirm',
  'macro-repeat-transform',
  'marks-jumps-causal-anchors',
  'causal-strand-preview',
]);

const REQUIRED_ROW_REFERENCES = Object.freeze({
  'open-edit-save-reopen': ['ex.edit', 'ex.write-quit'],
  'text-object-surgery': ['text-object.quotes', 'text-object.brackets', 'operator.delete-change-yank'],
  'search-substitute-confirm': ['search.pattern-history', 'substitute.file-confirm'],
  'macro-repeat-transform': ['macro.record', 'macro.replay', 'repeat.transformed-replay'],
  'marks-jumps-causal-anchors': ['marks.local-global', 'marks.jump', 'jumps.list'],
  'causal-strand-preview': ['substitute.file-confirm', 'global.vglobal', 'ex.ranges'],
});

test('Vim power target usability fixtures have stable metadata', () => {
  const fixtures = readJson(FIXTURES_PATH);

  assert.equal(fixtures.schemaVersion, 1);
  assert.equal(fixtures.designDoc, DESIGN_PATH);
  assert.equal(fixtures.parityMatrix, MATRIX_REPO_PATH);
  assert.equal(fixtures.owner, 'jedit');
  assert.equal(fixtures.futureCommandName, 'jim');
  assert.equal(fixtures.currentExecutionPosture, 'target-fixtures-not-runtime-proof');
  assert.deepEqual(fixtures.workflows.map(workflow => workflow.id), REQUIRED_WORKFLOWS);
});

test('Vim power target usability fixtures reference real parity matrix rows', () => {
  const fixtures = readJson(FIXTURES_PATH);
  const matrixRows = new Set(readJson(MATRIX_PATH).categories.flatMap(category => category.items.map(item => item.id)));

  for (const workflow of fixtures.workflows) {
    assert.ok(workflow.matrixRows.length > 0, `${workflow.id} must reference matrix rows`);

    for (const rowId of workflow.matrixRows) {
      assert.ok(matrixRows.has(rowId), `${workflow.id} references missing matrix row ${rowId}`);
    }

    for (const requiredRow of REQUIRED_ROW_REFERENCES[workflow.id]) {
      assert.ok(workflow.matrixRows.includes(requiredRow), `${workflow.id} must reference ${requiredRow}`);
    }
  }
});

test('Vim power target usability fixtures separate human task prose from witness data', () => {
  const fixtures = readJson(FIXTURES_PATH);

  for (const workflow of fixtures.workflows) {
    assert.equal(typeof workflow.humanTask, 'string', `${workflow.id} humanTask missing`);
    assert.ok(workflow.humanTask.length > 40, `${workflow.id} humanTask should be descriptive`);
    assert.equal(typeof workflow.witness.command, 'string', `${workflow.id} witness command missing`);
    assert.match(workflow.witness.command, /jedit-vim-power-witness\.mjs --json/);
    assert.equal(typeof workflow.witness.workspace.cwd, 'string', `${workflow.id} workspace cwd missing`);
    assert.ok(workflow.witness.workspace.files.length > 0, `${workflow.id} needs seed files`);
    assert.ok(workflow.witness.steps.length >= 4, `${workflow.id} needs enough witness steps`);
    assert.ok(workflow.witness.requiredFacts.length >= 5, `${workflow.id} needs required facts`);

    for (const step of workflow.witness.steps) {
      assert.equal(typeof step.id, 'string', `${workflow.id} step id missing`);
      assert.equal(typeof step.input, 'string', `${workflow.id}:${step.id} input missing`);
      assert.equal(typeof step.expect, 'string', `${workflow.id}:${step.id} expectation missing`);
    }
  }
});

test('Vim power target usability fixtures stay honest about current execution', () => {
  const fixtures = readJson(FIXTURES_PATH);
  const allowedOutcomes = new Set(['partially-supported', 'not-yet-supported']);

  for (const workflow of fixtures.workflows) {
    assert.ok(allowedOutcomes.has(workflow.expectedCurrentOutcome), `${workflow.id} has unknown outcome`);
    assert.notEqual(workflow.expectedCurrentOutcome, 'passing', `${workflow.id} must not claim runtime proof yet`);
  }
});

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, 'utf8'));
}
