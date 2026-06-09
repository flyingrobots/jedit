import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const REPO_ROOT = process.cwd();
const MATRIX_PATH = path.join(REPO_ROOT, 'docs', 'design', '0105-vim-power-moves-parity-matrix.json');
const DESIGN_PATH = 'docs/design/0105-vim-power-moves-causal-parity.md';

const REQUIRED_CATEGORIES = Object.freeze([
  'motions',
  'operators',
  'transactionSemantics',
  'textObjects',
  'visualModes',
  'registers',
  'repeat',
  'macros',
  'marksJumps',
  'searchSubstitute',
  'exCommands',
]);

const REQUIRED_KEYS = Object.freeze({
  motions: ['h', 'j', 'k', 'l', '0', '^', '$', 'gg', 'G', 'w', 'b', 'e', 'W', 'B', 'E', '/', '?', 'n', 'N', '%', '{', '}', '[[', ']]'],
  operators: ['d', 'c', 'y', 'p', 'P', 'r', 'R', '>', '<', '=', 'gq', 'gu', 'gU', 'g~', 'J', 'gJ', '!', ':'],
  transactionSemantics: ['di"', 'ci"', 'daw', 'gqap', 'd', 'c', 'y', 'p', '"', '_', 'q{register}', '@{register}', '@@', 'u', 'Ctrl-r'],
  textObjects: ['iw', 'aw', 'iW', 'aW', 'is', 'as', 'ip', 'ap', 'i"', 'a"', "i'", "a'", 'i`', 'a`', 'i(', 'a(', 'i[', 'a[', 'i{', 'a{'],
  visualModes: ['v', 'V', 'Ctrl-v', 'o'],
  registers: ['"', '0', '1', '9', '-', 'a-z', 'A-Z', '_', '+', '*', '='],
  repeat: ['.'],
  macros: ['q{register}', 'q', '@{register}', '@@'],
  marksJumps: ['m{mark}', '`{mark}', "'{mark}", "''", 'Ctrl-o', 'Ctrl-i', 'g;', 'g,'],
  searchSubstitute: ['/', '?', 'n', 'N', '*', '#', 'g*', 'g#', ':s', ':%s', 'c', ':g', ':v'],
  exCommands: [':edit', ':e', ':write', ':w', ':quit', ':q', ':wq', ':x', ':1,10', ':%', ':s', ':%s', ':g', ':v', ':help'],
});

const STATUS_VOCABULARY = Object.freeze([
  'supported',
  'partial',
  'unsupported',
  'causally-enhanced',
]);

test('Vim power-moves parity matrix has stable metadata and categories', () => {
  const matrix = readMatrix();
  const categoryIds = matrix.categories.map(category => category.id);

  assert.equal(matrix.schemaVersion, 1);
  assert.equal(matrix.designDoc, DESIGN_PATH);
  assert.equal(matrix.owner, 'jedit');
  assert.equal(matrix.futureCommandName, 'jim');
  assert.deepEqual(matrix.statusVocabulary, STATUS_VOCABULARY);
  assert.match(matrix.echoBoundary, /Echo remains generic/);
  assert.match(matrix.graftBoundary, /not editable text authority/);
  assert.deepEqual(categoryIds, REQUIRED_CATEGORIES);
});

test('Vim power-moves parity matrix items carry proof, boundaries, and slice targets', () => {
  const matrix = readMatrix();
  const statusSet = new Set(matrix.statusVocabulary);

  for (const item of allItems(matrix)) {
    assert.equal(typeof item.id, 'string', `${item.id} id must be a string`);
    assert.ok(item.id.length > 0, 'item id must not be empty');
    assert.ok(Array.isArray(item.keys), `${item.id} keys must be an array`);
    assert.ok(item.keys.length > 0, `${item.id} must declare key coverage`);
    assert.ok(statusSet.has(item.status), `${item.id} uses unknown status ${item.status}`);
    assertTargetSlices(item);
    assert.equal(typeof item.targetParity, 'string', `${item.id} targetParity missing`);
    assert.equal(typeof item.currentJedit, 'string', `${item.id} currentJedit missing`);
    assert.equal(typeof item.proofGap, 'string', `${item.id} proofGap missing`);
    assert.equal(typeof item.causalOpportunity, 'string', `${item.id} causalOpportunity missing`);
    assert.equal(typeof item.echoBoundary, 'string', `${item.id} echoBoundary missing`);
    assert.ok(Array.isArray(item.currentProof), `${item.id} currentProof must be an array`);
  }
});

test('Vim power-moves parity matrix covers the required surface from WF-0105', () => {
  const matrix = readMatrix();

  for (const category of matrix.categories) {
    const coveredKeys = new Set(category.items.flatMap(item => item.keys));
    const missing = REQUIRED_KEYS[category.id].filter(key => !coveredKeys.has(key));

    assert.deepEqual(missing, [], `${category.id} is missing required keys`);
  }
});

test('Vim power-moves parity matrix keeps current support honest', () => {
  const matrix = readMatrix();
  const items = allItems(matrix);
  const statuses = new Set(items.map(item => item.status));

  assert.ok(statuses.has('supported'), 'matrix should name already supported behavior');
  assert.ok(statuses.has('partial'), 'matrix should name partial behavior');
  assert.ok(statuses.has('unsupported'), 'matrix should name unsupported behavior');
  assert.ok(statuses.has('causally-enhanced'), 'matrix should name causal extension targets');

  for (const item of items) {
    if (item.status === 'supported') {
      assert.ok(item.currentProof.length > 0, `${item.id} supported rows need current proof`);
      assert.equal(item.proofGap, '', `${item.id} supported rows should not carry a proof gap`);
    }

    if (item.status === 'unsupported' || item.status === 'causally-enhanced') {
      assert.deepEqual(item.currentProof, [], `${item.id} must not pretend unsupported work is proven`);
      assert.ok(item.proofGap.length > 0, `${item.id} needs an explicit proof gap`);
    }

    if (item.status === 'causally-enhanced') {
      assert.doesNotMatch(item.causalOpportunity, /^none$/i, `${item.id} needs a real causal opportunity`);
    }
  }
});

function readMatrix() {
  return JSON.parse(readFileSync(MATRIX_PATH, 'utf8'));
}

function allItems(matrix) {
  return matrix.categories.flatMap(category => category.items);
}

function assertTargetSlices(item) {
  assert.ok(Array.isArray(item.targetSlices), `${item.id} targetSlices must be an array`);
  assert.ok(item.targetSlices.length > 0, `${item.id} targetSlices must not be empty`);

  for (const slice of item.targetSlices) {
    assert.equal(Number.isInteger(slice), true, `${item.id} target slice must be an integer`);
    assert.ok(slice >= 2 && slice <= 30, `${item.id} target slice must fit WF-0105`);
  }
}
