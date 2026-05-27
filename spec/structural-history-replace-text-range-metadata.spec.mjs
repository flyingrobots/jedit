import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';

const REPO_ROOT = process.cwd();
const CONTRACT_PATH = path.join(REPO_ROOT, 'contracts', 'jedit', 'structural-history.graphql');
const PACKAGE_JSON_PATH = path.join(REPO_ROOT, 'package.json');
const CACHE_GENERATED_PATH = path.join(REPO_ROOT, '.wesley-cache', 'structural-history.wesley.generated.ts');
const GENERATED_SOURCE_PATH = path.join(
  'src',
  'generated',
  'jedit',
  'structural-history-replace-text-range.wesley.generated.ts',
);
const GENERATED_MODULE_PATH = path.join(
  REPO_ROOT,
  'dist',
  'generated',
  'jedit',
  'structural-history-replace-text-range.wesley.generated.js',
);
const BOUNDARY_MODULE_PATH = path.join(
  REPO_ROOT,
  'dist',
  'app',
  'structural-history-replace-text-range.js',
);
const HOT_BUFFER_SESSION_MODULE_PATH = path.join(REPO_ROOT, 'dist', 'app', 'hot-buffer-session.js');
const HOT_TEXT_RUNTIME_MODULE_PATH = path.join(REPO_ROOT, 'dist', 'adapters', 'in-memory-hot-text-runtime.js');
const TEXT_EDIT_MODULE_PATH = path.join(REPO_ROOT, 'dist', 'domain', 'text-edit-contract.js');
const STRUCTURAL_HISTORY_GENERATION_SCRIPT = 'gen:contract:structural-history:wesley';

let builtModulesPromise;

test('structural history SDL marks replaceTextRange as a Wesley operation', async () => {
  const contract = await readFile(CONTRACT_PATH, 'utf8');

  assert.match(contract, /\breplaceTextRange\s*\(\s*input:\s*ReplaceTextRangeInput!\s*\)\s*:\s*ReplaceTextRangePayload!/);
  assert.match(contract, /@wes_op\(name: "replaceTextRange"\)/);
});

test('structural history generation path emits replaceTextRange metadata', async () => {
  const packageJson = JSON.parse(await readFile(PACKAGE_JSON_PATH, 'utf8'));

  assert.equal(
    packageJson.scripts[STRUCTURAL_HISTORY_GENERATION_SCRIPT],
    'node scripts/gen-structural-history-wesley.mjs',
  );

  const generated = runStructuralHistoryGeneration();

  assert.match(generated, /export const mutationReplaceTextRangeOperation = \{/);
  assert.match(generated, /fieldName: "replaceTextRange"/);
  assert.match(generated, /directives: \{"wes_op":\{"name":"replaceTextRange"\}\}/);
});

test('dev startup generates ignored replaceTextRange descriptor first', async () => {
  const packageJson = JSON.parse(await readFile(PACKAGE_JSON_PATH, 'utf8'));

  assert.equal(
    packageJson.scripts.dev,
    `npm run ${STRUCTURAL_HISTORY_GENERATION_SCRIPT} && tsx src/main.ts`,
  );
});

test('generated replaceTextRange descriptor is ignored and mirrors Wesley metadata', async () => {
  const generated = runStructuralHistoryGeneration();
  const modules = await loadBuiltModules();
  const generatedOperation = readGeneratedOperation(generated, 'mutationReplaceTextRangeOperation');

  assert.equal(sourcePathIsTracked(GENERATED_SOURCE_PATH), false);
  assert.equal(sourcePathIsIgnored(GENERATED_SOURCE_PATH), true);

  assert.deepEqual(
    modules.generatedMetadata.mutationReplaceTextRangeOperation,
    {
      operationType: generatedOperation.operationType,
      fieldName: generatedOperation.fieldName,
      directives: {
        wes_op: {
          name: generatedOperation.wesOpName,
        },
      },
    },
  );
});

test('replace/tick adapter consumes generated replaceTextRange operation identity', async () => {
  const modules = await loadBuiltModules();

  assert.equal(
    modules.boundary.replaceTextRangeOperationName(),
    modules.generatedMetadata.mutationReplaceTextRangeOperation.fieldName,
  );
  assert.equal(
    modules.boundary.replaceTextRangeOperationName(),
    modules.generatedMetadata.mutationReplaceTextRangeOperation.directives.wes_op.name,
  );
});

test('structural history request builder emits generated replaceTextRange intent material', async () => {
  const modules = await loadBuiltModules();

  const request = modules.boundary.createStructuralHistoryReplaceTextRangeRequest({
    historyId: 'text-buffer:0',
    baseRevisionSequence: 0,
    startByte: 1,
    endByte: 2,
    insertText: 'x',
    author: 'test-author',
    sourceLabel: 'test-boundary',
    externalEvidenceId: 'read-basis:0',
    projectionPath: 'notes/example.md',
  });

  assert.equal(
    request.operationName,
    modules.generatedMetadata.mutationReplaceTextRangeOperation.fieldName,
  );
  assert.deepEqual(request.input, {
    historyId: 'text-buffer:0',
    baseRevisionId: 'text-revision:text-buffer:0:0',
    startByte: 1,
    endByte: 2,
    insertText: 'x',
    author: 'test-author',
    provenance: {
      sourceKind: 'BOUNDARY_ADAPTER',
      sourceLabel: 'test-boundary',
      externalEvidenceId: 'read-basis:0',
      projectionPath: 'notes/example.md',
    },
  });
});

test('replaceTextRange metadata route preserves hot buffer tick behavior', async () => {
  const modules = await loadBuiltModules();
  const runtime = modules.hotTextRuntime.createInMemoryHotTextRuntime();
  const opened = modules.hotBufferSession.beginEditGroup(
    runtime,
    modules.hotBufferSession.startHotBufferSession(runtime, 'notes/today.md', 'hello world'),
  );

  const result = modules.hotBufferSession.applyBufferEdit(
    runtime,
    opened,
    modules.textEdit.createTextRange(5, 5),
    ' brave',
  );
  const closed = modules.hotBufferSession.endEditGroup(runtime, result.nextState);

  assert.equal(modules.hotBufferSession.materializeHotBuffer(runtime, result.nextState), 'hello brave world');
  assert.equal(
    result.operationName,
    modules.generatedMetadata.mutationReplaceTextRangeOperation.fieldName,
  );
  assert.equal(result.tickId, 1);
  assert.deepEqual(closed.nextState.editGroups, [
    {
      id: 1,
      tickIds: [1],
    },
  ]);
});

async function loadBuiltModules() {
  if (builtModulesPromise) {
    return builtModulesPromise;
  }

  builtModulesPromise = (async () => {
    const [generatedMetadata, boundary, hotBufferSession, hotTextRuntime, textEdit] = await Promise.all([
      import(pathToFileURL(GENERATED_MODULE_PATH).href),
      import(pathToFileURL(BOUNDARY_MODULE_PATH).href),
      import(pathToFileURL(HOT_BUFFER_SESSION_MODULE_PATH).href),
      import(pathToFileURL(HOT_TEXT_RUNTIME_MODULE_PATH).href),
      import(pathToFileURL(TEXT_EDIT_MODULE_PATH).href),
    ]);

    return {
      generatedMetadata,
      boundary,
      hotBufferSession,
      hotTextRuntime,
      textEdit,
    };
  })();

  return builtModulesPromise;
}

function runStructuralHistoryGeneration() {
  const generation = spawnSync('npm', ['run', '--silent', STRUCTURAL_HISTORY_GENERATION_SCRIPT], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });

  assert.equal(generation.status, 0, generation.stderr || generation.stdout);
  return readGeneratedCache();
}

function readGeneratedCache() {
  return readFileSync(CACHE_GENERATED_PATH, 'utf8');
}

function readGeneratedOperation(generated, operationConstantName) {
  const pattern = new RegExp(
    `export const ${operationConstantName} = \\{\\s*`
      + 'operationType: "([^"]+)",\\s*'
      + 'fieldName: "([^"]+)",\\s*'
      + 'directives: \\{"wes_op":\\{"name":"([^"]+)"\\}\\},\\s*'
      + '\\} as const;',
  );
  const match = generated.match(pattern);

  assert.notEqual(match, null);
  const [, operationType, fieldName, wesOpName] = match;
  return {
    operationType,
    fieldName,
    wesOpName,
  };
}

function sourcePathIsTracked(relativePath) {
  const tracked = spawnSync('git', ['ls-files', '--error-unmatch', relativePath], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });

  return tracked.status === 0;
}

function sourcePathIsIgnored(relativePath) {
  const ignored = spawnSync('git', ['check-ignore', relativePath], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });

  return ignored.status === 0;
}
