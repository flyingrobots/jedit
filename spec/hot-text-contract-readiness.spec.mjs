import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';

const REPO_ROOT = process.cwd();
const CONTRACT_PATH = path.join(REPO_ROOT, 'contracts', 'jedit', 'rope.graphql');
const GENERATED_MODULE_PATH = path.join(
  REPO_ROOT,
  'dist',
  'generated',
  'jedit',
  'rope.wesley.generated.js',
);

const EXPECTED_MUTATION_NAMES = [
  'createBufferWorldline',
  'replaceRangeAsTick',
  'createCheckpoint',
];

const EXPECTED_QUERY_NAMES = [
  'worldlineSnapshot',
  'textWindow',
];

let generatedContractPromise;

async function loadGeneratedContract() {
  if (generatedContractPromise) {
    return generatedContractPromise;
  }

  generatedContractPromise = (async () => {
    const build = spawnSync(process.execPath, ['node_modules/typescript/bin/tsc', '-p', 'tsconfig.json'], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
    });

    assert.equal(build.status, 0, build.stderr || build.stdout);

    return import(pathToFileURL(GENERATED_MODULE_PATH).href);
  })();

  return generatedContractPromise;
}

test('hot text SDL is the canonical jedit contract surface for later Echo binding generation', async () => {
  const contract = await readFile(CONTRACT_PATH, 'utf8');

  assert.match(contract, /type Mutation \{/);
  assert.match(contract, /type Query \{/);
  assert.match(contract, /type TextWindowReading \{/);
  assert.match(contract, /input ReplaceRangeAsTickInput \{/);

  for (const operationName of [...EXPECTED_MUTATION_NAMES, ...EXPECTED_QUERY_NAMES]) {
    assert.match(
      contract,
      new RegExp(`@wes_op\\(name: "${operationName}"\\)`),
      `${operationName} must be explicitly named for Wesley operation extraction`,
    );
  }
});

test('generated Wesley metadata preserves the jedit mutation footprint boundary', async () => {
  const generated = await loadGeneratedContract();
  const operations = [
    generated.mutationCreateBufferWorldlineOperation,
    generated.mutationReplaceRangeAsTickOperation,
    generated.mutationCreateCheckpointOperation,
  ];

  assert.deepEqual(
    operations.map((operation) => operation.fieldName),
    EXPECTED_MUTATION_NAMES,
  );

  for (const operation of operations) {
    assert.equal(operation.operationType, 'MUTATION');
    assert.equal(operation.directives.wes_op.name, operation.fieldName);
    assert.ok(operation.directives.wes_footprint, `${operation.fieldName} must carry @wes_footprint`);
    assert.ok(
      operation.directives.wes_footprint.forbids.includes('AstState'),
      `${operation.fieldName} must keep AST state outside the text contract footprint`,
    );
    assert.ok(
      operation.directives.wes_footprint.forbids.includes('Diagnostics'),
      `${operation.fieldName} must keep diagnostics outside the text contract footprint`,
    );
    assert.ok(
      operation.directives.wes_footprint.forbids.includes('GitWitness'),
      `${operation.fieldName} must keep git witness state outside the text contract footprint`,
    );
    assert.ok(
      operation.directives.wes_footprint.forbids.includes('UiState'),
      `${operation.fieldName} must keep UI state outside the text contract footprint`,
    );
  }

  const replaceFootprint = generated.mutationReplaceRangeAsTickOperation.directives.wes_footprint;
  assert.deepEqual(replaceFootprint.writes, ['BufferWorldline']);
  assert.ok(replaceFootprint.reads.includes('RopeHead'));
  assert.ok(replaceFootprint.reads.includes('TextBlob'));
  assert.ok(replaceFootprint.reads.includes('Anchor'));
  assert.ok(replaceFootprint.creates.includes('RopeRewrite'));
  assert.ok(replaceFootprint.creates.includes('RopeDiff'));
  assert.ok(replaceFootprint.creates.includes('RopeHead'));
  // Cutover is full, not half: legacy footprint type names must be gone.
  assert.ok(
    !replaceFootprint.creates.includes('Tick'),
    'legacy footprint name "Tick" must be removed after rope rename',
  );
  assert.ok(
    !replaceFootprint.creates.includes('TickReceipt'),
    'legacy footprint name "TickReceipt" must be removed after rope rename',
  );
  assert.deepEqual(
    replaceFootprint.closures.map((closure) => closure.operator),
    ['ropeRangeClosure', 'anchorsIntersectingEditWindow'],
  );
});

test('generated Wesley metadata preserves the bounded read surface for source painting', async () => {
  const generated = await loadGeneratedContract();
  const operations = [
    generated.queryWorldlineSnapshotOperation,
    generated.queryTextWindowOperation,
  ];

  assert.deepEqual(
    operations.map((operation) => operation.fieldName),
    EXPECTED_QUERY_NAMES,
  );

  for (const operation of operations) {
    assert.equal(operation.operationType, 'QUERY');
    assert.equal(operation.directives.wes_op.name, operation.fieldName);
  }

  assert.equal(generated.queryTextWindowOperation.fieldName, 'textWindow');
  assert.equal(
    generated.queryTextWindowOperation.directives.wes_footprint,
    undefined,
    'bounded reads stay query metadata today; Echo footprint certificates are deferred to the Rust binding pass',
  );
});
