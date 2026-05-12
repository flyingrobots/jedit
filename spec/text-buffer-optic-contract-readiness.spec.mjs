import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const REPO_ROOT = process.cwd();
const APP_CONTRACT_PATH = path.join(REPO_ROOT, 'contracts', 'jedit', 'text-buffer-optic.graphql');
const RUNTIME_CONTRACT_PATH = path.join(REPO_ROOT, 'contracts', 'jedit', 'hot-text-runtime.graphql');

const FORBIDDEN_APP_CONTRACT_TERMS = Object.freeze([
  'worldlineId',
  'headId',
  'baseHeadId',
  'canonicalHeadId',
  'tick',
  'rope',
  'strand',
  'root',
  'scheduler',
]);

const EXPECTED_APP_MUTATIONS = Object.freeze([
  'createBuffer',
  'replaceRange',
]);

const EXPECTED_APP_QUERIES = Object.freeze([
  'textWindow',
]);

test('text buffer optic SDL exposes product nouns and opaque read handles', async () => {
  const contract = await readFile(APP_CONTRACT_PATH, 'utf8');

  assert.match(contract, /\bscalar\s+ReadBasisHandle\b/);
  assert.doesNotMatch(contract, /\btype\s+ReadBasisHandle\b/);
  assert.doesNotMatch(contract, /\binput\s+ReadBasisHandle\b/);
  assert.match(contract, /\btype\s+TextBuffer\b/);
  assert.match(contract, /\btype\s+TextBufferOptic\b/);
  assert.match(contract, /\btype\s+TextWindowReading\b/);
  assert.match(contract, /\btype\s+CreateBufferPayload\b/);
  assert.match(contract, /\btype\s+ReplaceRangePayload\b/);
  assert.match(contract, /\binput\s+CreateBufferInput\b/);
  assert.match(contract, /\binput\s+ReplaceRangeInput\b/);
  assert.match(contract, /\binput\s+TextWindowInput\b/);

  for (const operationName of EXPECTED_APP_MUTATIONS) {
    assert.match(
      contract,
      new RegExp(`\\b${operationName}\\s*\\(\\s*input:\\s*${toInputName(operationName)}!\\s*\\):`),
      `${operationName} must be present as an app-facing mutation`,
    );
  }

  for (const operationName of EXPECTED_APP_QUERIES) {
    assert.match(
      contract,
      new RegExp(`\\b${operationName}\\s*\\(\\s*readBasis:\\s*ReadBasisHandle!`),
      `${operationName} must read through an opaque ReadBasisHandle`,
    );
  }
});

test('text buffer optic SDL does not expose runtime coordinates', async () => {
  const contract = await readFile(APP_CONTRACT_PATH, 'utf8');

  for (const forbiddenTerm of FORBIDDEN_APP_CONTRACT_TERMS) {
    assert.doesNotMatch(
      contract,
      new RegExp(`\\b${forbiddenTerm}\\b`, 'i'),
      `app-facing SDL must not expose ${forbiddenTerm}`,
    );
  }
});

test('runtime-facing SDL remains the separate home for Echo coordinates', async () => {
  const appContract = await readFile(APP_CONTRACT_PATH, 'utf8');
  const runtimeContract = await readFile(RUNTIME_CONTRACT_PATH, 'utf8');

  assert.doesNotMatch(appContract, /@wes_/);
  assert.match(runtimeContract, /\bworldlineId\b/);
  assert.match(runtimeContract, /\bbaseHeadId\b/);
  assert.match(runtimeContract, /\bRopeHead\b/);
  assert.match(runtimeContract, /\bTickReceipt\b/);
  assert.match(runtimeContract, /@wes_op/);
  assert.match(runtimeContract, /@wes_footprint/);
});

function toInputName(operationName) {
  if (operationName === 'createBuffer') {
    return 'CreateBufferInput';
  }
  if (operationName === 'replaceRange') {
    return 'ReplaceRangeInput';
  }
  throw new Error(`Unhandled app mutation: ${operationName}`);
}
