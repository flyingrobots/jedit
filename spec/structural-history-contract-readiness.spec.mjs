import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const REPO_ROOT = process.cwd();
const CONTRACT_PATH = path.join(REPO_ROOT, 'contracts', 'jedit', 'structural-history.graphql');
const DESIGN_NOTE_PATH = path.join(REPO_ROOT, 'docs', 'design', 'structural-history-graphql-authority.md');
const DESIGN_CYCLE_PATH = path.join(
  REPO_ROOT,
  'docs',
  'design',
  '0016-structural-history-replace-text-range-metadata',
  'replace-text-range-wesley-metadata.md',
);
const DATA_MODEL_DOC_PATH = path.join(REPO_ROOT, 'docs', 'data-model.md');
const BACKLOG_DOC_PATH = path.join(
  REPO_ROOT,
  'docs',
  'method',
  'backlog',
  'asap',
  'buffer-truth-and-projection-boundary.md',
);
const STRUCTURAL_HISTORY_CONTRACT_REF = 'contracts/jedit/structural-history.graphql';
const STRUCTURAL_HISTORY_METADATA_CYCLE = '0016-structural-history-replace-text-range-metadata';

const EXPECTED_METADATA_CYCLE_HILLS = Object.freeze([
  /A maintainer can inspect the structural-history SDL and see\s+`replaceTextRange` declared as a Wesley operation/,
  /A developer can run the normal build and test paths from a clean checkout\s+and have the ignored `replaceTextRange` descriptor generated/,
  /A future runtime slice can call the hot-buffer replace boundary and observe\s+generated `replaceTextRange` operation identity/,
]);

const EXPECTED_METADATA_CYCLE_PLAYBACK = Object.freeze([
  /Does the structural-history SDL mark `replaceTextRange` with `@wes_op`\?/,
  /Does the structural-history generator emit the Wesley operation descriptor/,
  /Is the extracted descriptor ignored generated output/,
  /Does the app boundary import generated operation metadata/,
  /Does routing through that boundary preserve replace admission/,
]);

const EXPECTED_TYPES = Object.freeze([
  'TextHistory',
  'TextRevision',
  'TextHistoryEvent',
  'TextEditGroup',
  'TextCheckpoint',
  'TextHistoryEvidence',
  'TextHistoryProvenance',
  'TextHistorySnapshotReading',
]);

const EXPECTED_INPUTS = Object.freeze([
  'CreateTextHistoryInput',
  'ReplaceTextRangeInput',
  'OpenTextEditGroupInput',
  'IncludeTextEventInOpenGroupInput',
  'CloseTextEditGroupInput',
  'CreateTextCheckpointInput',
  'TextHistorySnapshotInput',
]);

const EXPECTED_MUTATIONS = Object.freeze([
  ['createTextHistory', 'CreateTextHistoryInput', 'CreateTextHistoryPayload'],
  ['replaceTextRange', 'ReplaceTextRangeInput', 'ReplaceTextRangePayload'],
  ['openTextEditGroup', 'OpenTextEditGroupInput', 'TextEditGroupPayload'],
  ['includeTextEventInOpenGroup', 'IncludeTextEventInOpenGroupInput', 'TextEditGroupPayload'],
  ['closeTextEditGroup', 'CloseTextEditGroupInput', 'TextEditGroupPayload'],
  ['createTextCheckpoint', 'CreateTextCheckpointInput', 'CreateTextCheckpointPayload'],
]);

const EXPECTED_QUERIES = Object.freeze([
  ['textHistorySnapshot', 'TextHistorySnapshotInput', 'TextHistorySnapshotReading'],
]);

const FORBIDDEN_LEGACY_AUTHORITY_TERMS = Object.freeze([
  'HotTextBufferState',
  'BufferRoot',
  'TextFragment',
  'currentRoot',
  'openEditGroup',
  'Map<',
  'worldlineId',
  'RopeHead',
  'GitWitness',
]);

test('structural history SDL defines canonical domain facts and operations', async () => {
  const contract = await readFile(CONTRACT_PATH, 'utf8');

  assert.match(contract, /\bscalar\s+DateTime\b/);
  assert.match(contract, /\btype\s+Mutation\s+\{/);
  assert.match(contract, /\btype\s+Query\s+\{/);

  for (const typeName of EXPECTED_TYPES) {
    assert.match(contract, declarationPattern('type', typeName));
  }

  for (const inputName of EXPECTED_INPUTS) {
    assert.match(contract, declarationPattern('input', inputName));
  }

  for (const [operationName, inputName, payloadName] of EXPECTED_MUTATIONS) {
    assert.match(contract, operationPattern(operationName, inputName, payloadName));
    assert.match(contract, wesleyOperationPattern(operationName));
  }

  for (const [operationName, inputName, payloadName] of EXPECTED_QUERIES) {
    assert.match(contract, operationPattern(operationName, inputName, payloadName));
    assert.match(contract, wesleyOperationPattern(operationName));
  }
});

test('structural history SDL keeps provenance, status, and errors first-class', async () => {
  const contract = await readFile(CONTRACT_PATH, 'utf8');

  assert.match(contract, declarationPattern('enum', 'TextHistorySourceKind'));
  assert.match(contract, declarationPattern('enum', 'TextHistoryReadingOrigin'));
  assert.match(contract, declarationPattern('enum', 'TextHistoryCommandStatus'));
  assert.match(contract, declarationPattern('enum', 'TextHistoryErrorCode'));
  assert.match(contract, /\bprovenance:\s*TextHistoryProvenance!/);
  assert.match(contract, /\bevidence:\s*TextHistoryEvidence!/);
  assert.match(contract, /\bstatus:\s*TextHistoryCommandStatus!/);
  assert.match(contract, /\berrors:\s*\[TextHistoryError!\]!/);
});

test('structural history SDL does not canonize transitional TypeScript or substrate shapes', async () => {
  const contract = await readFile(CONTRACT_PATH, 'utf8');

  for (const forbiddenTerm of FORBIDDEN_LEGACY_AUTHORITY_TERMS) {
    assert.doesNotMatch(
      contract,
      new RegExp(escapeRegExp(forbiddenTerm)),
      `structural history SDL must not canonize ${forbiddenTerm}`,
    );
  }
});

test('structural history authority note documents extraction and deferred runtime work', async () => {
  const note = await readFile(DESIGN_NOTE_PATH, 'utf8');

  assert.match(note, /Old TS concept -> GraphQL concept -> notes/);
  assert.match(note, /`src\/adapters\/full-snapshot-hot-text-runtime-fixture\.ts`/);
  assert.match(note, new RegExp(escapeRegExp(STRUCTURAL_HISTORY_CONTRACT_REF)));
  assert.match(note, /Wesley generation should consume/);
  assert.match(note, /Runtime storage is out of scope/);
  assert.match(note, /Transitional TypeScript/);
});

test('structural history metadata cycle states the PR hills and playback', async () => {
  const cycle = await readFile(DESIGN_CYCLE_PATH, 'utf8');

  assert.match(cycle, new RegExp(`cycle: "${STRUCTURAL_HISTORY_METADATA_CYCLE}"`));
  assert.match(cycle, /## Hills/);
  assert.match(cycle, /## Playback Questions/);
  assert.match(cycle, new RegExp(escapeRegExp(STRUCTURAL_HISTORY_CONTRACT_REF)));
  assert.match(cycle, /spec\/structural-history-replace-text-range-metadata\.spec\.mjs/);
  assert.match(cycle, /Runtime storage, persistent history, and generated[-\s]+payload-shape cutover stay\s+out of scope/);

  for (const hill of EXPECTED_METADATA_CYCLE_HILLS) {
    assert.match(cycle, hill);
  }

  for (const playbackQuestion of EXPECTED_METADATA_CYCLE_PLAYBACK) {
    assert.match(cycle, playbackQuestion);
  }
});

test('docs point future buffer-truth work at the structural history SDL', async () => {
  const [dataModel, backlog] = await Promise.all([
    readFile(DATA_MODEL_DOC_PATH, 'utf8'),
    readFile(BACKLOG_DOC_PATH, 'utf8'),
  ]);

  assert.match(dataModel, new RegExp(escapeRegExp(STRUCTURAL_HISTORY_CONTRACT_REF)));
  assert.match(backlog, new RegExp(escapeRegExp(STRUCTURAL_HISTORY_CONTRACT_REF)));
});

function declarationPattern(kind, name) {
  return new RegExp(`\\b${kind}\\s+${name}\\b`);
}

function operationPattern(operationName, inputName, payloadName) {
  return new RegExp(
    `\\b${operationName}\\s*\\(\\s*input:\\s*${inputName}!\\s*\\)\\s*:\\s*${payloadName}!`,
  );
}

function wesleyOperationPattern(operationName) {
  return new RegExp(`@wes_op\\(name: "${operationName}"\\)`);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
