import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const REPO_ROOT = process.cwd();
const APP_CONTRACT_PATH = path.join(REPO_ROOT, 'contracts', 'jedit', 'text-buffer-optic.graphql');
const RUNTIME_CONTRACT_PATH = path.join(REPO_ROOT, 'contracts', 'jedit', 'rope.graphql');
const DATA_MODEL_DOC_PATH = path.join(REPO_ROOT, 'docs', 'data-model.md');
const PACKAGE_JSON_PATH = path.join(REPO_ROOT, 'package.json');

const FORBIDDEN_APP_CONTRACT_TERMS = Object.freeze([
  'worldline',
  'worldlineId',
  'head',
  'headId',
  'baseHead',
  'baseHeadId',
  'canonicalHead',
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
      mutationSignaturePattern(operationName),
      `${operationName} must be present as an app-facing mutation`,
    );
  }

  for (const operationName of EXPECTED_APP_QUERIES) {
    assert.match(
      contract,
      querySignaturePattern(operationName),
      `${operationName} must read through an opaque ReadBasisHandle`,
    );
  }
});

test('text buffer optic signature matchers reject partial declarations', () => {
  assert.doesNotMatch(
    'createBuffer(input: CreateBufferInput!):',
    mutationSignaturePattern('createBuffer'),
  );
  assert.doesNotMatch(
    'createBuffer(input: CreateBufferInput!): CreateBufferPayload',
    mutationSignaturePattern('createBuffer'),
  );
  assert.doesNotMatch(
    'textWindow(readBasis: ReadBasisHandle!): TextWindowReading!',
    querySignaturePattern('textWindow'),
  );
  assert.doesNotMatch(
    'textWindow(readBasis: ReadBasisHandle!, input: TextWindowInput!): TextWindowReading',
    querySignaturePattern('textWindow'),
  );
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
  assert.match(runtimeContract, /\bRopeDiff\b/);
  assert.match(runtimeContract, /@wes_op/);
  assert.match(runtimeContract, /@wes_footprint/);
});

test('data model documentation mirrors the app-facing textWindow contract', async () => {
  const dataModel = await readFile(DATA_MODEL_DOC_PATH, 'utf8');

  assert.doesNotMatch(dataModel, /\btype\s+ReadingEvidence\b/);
  assert.doesNotMatch(dataModel, /\btype\s+ObservedTextWindowReading\b/);
  assert.match(
    dataModel,
    /\btextWindow\(readBasis:\s*ReadBasisHandle!,\s*input:\s*TextWindowInput!\):\s*TextWindowReading!/,
  );
});

test('contract generation scripts keep runtime and app-facing SDL targets explicit', async () => {
  const packageJson = JSON.parse(await readFile(PACKAGE_JSON_PATH, 'utf8'));
  const scripts = packageJson.scripts;

  assert.equal(
    scripts['gen:contract:rope:wesley'],
    'node scripts/run-wesley-tool.mjs cli emit typescript --schema contracts/jedit/rope.graphql --out src/generated/jedit/rope.wesley.generated.ts',
  );
  assert.equal(
    scripts['gen:contract:text-buffer-optic:wesley'],
    'node scripts/run-wesley-tool.mjs cli emit typescript --schema contracts/jedit/text-buffer-optic.graphql --out src/generated/jedit/text-buffer-optic.wesley.generated.ts',
  );
  assert.equal(
    scripts['gen:contract:wesley'],
    'npm run gen:contract:rope:wesley && npm run gen:contract:structural-history:wesley',
  );
  assert.equal(
    scripts['gen:contract:structural-history:wesley'],
    'node scripts/gen-structural-history-wesley.mjs',
  );
  assert.equal(
    scripts['gen:contract'].includes('gen:contract:text-buffer-optic:wesley'),
    false,
  );
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

function mutationSignaturePattern(operationName) {
  return new RegExp(
    `\\b${operationName}\\s*\\(\\s*input:\\s*${toInputName(operationName)}!\\s*\\)\\s*:\\s*\\w+!`,
  );
}

function querySignaturePattern(operationName) {
  if (operationName === 'textWindow') {
    return /\btextWindow\s*\(\s*readBasis:\s*ReadBasisHandle!\s*,\s*input:\s*TextWindowInput!\s*\)\s*:\s*\w+!/;
  }
  throw new Error(`Unhandled app query: ${operationName}`);
}
