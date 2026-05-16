import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';

const REPO_ROOT = process.cwd();
const CONTRACT_PATH = path.join(REPO_ROOT, 'contracts', 'jedit', 'structural-history.graphql');
const PACKAGE_JSON_PATH = path.join(REPO_ROOT, 'package.json');
const CACHE_GENERATED_PATH = path.join(REPO_ROOT, '.wesley-cache', 'structural-history.wesley.generated.ts');
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
const LOCAL_WESLEY_ROOT = path.join(REPO_ROOT, '..', 'wesley');

let builtModulesPromise;

test('structural history SDL marks replaceTextRange as a Wesley operation', async () => {
  const contract = await readFile(CONTRACT_PATH, 'utf8');

  assert.match(contract, /\breplaceTextRange\s*\(\s*input:\s*ReplaceTextRangeInput!\s*\)\s*:\s*ReplaceTextRangePayload!/);
  assert.match(contract, /@wes_op\(name: "replaceTextRange"\)/);
});

test('structural history generation path emits replaceTextRange metadata', async (context) => {
  const wesleyRoot = resolveWesleyRoot();
  if (wesleyRoot == null) {
    context.skip('Set JEDIT_WESLEY_ROOT to run structural-history Wesley generation.');
    return;
  }

  const packageJson = JSON.parse(await readFile(PACKAGE_JSON_PATH, 'utf8'));

  assert.match(
    packageJson.scripts[STRUCTURAL_HISTORY_GENERATION_SCRIPT],
    /contracts\/jedit\/structural-history\.graphql/,
  );

  const generated = runStructuralHistoryGeneration(wesleyRoot);

  assert.match(generated, /export const mutationReplaceTextRangeOperation = \{/);
  assert.match(generated, /fieldName: "replaceTextRange"/);
  assert.match(generated, /directives: \{"wes_op":\{"name":"replaceTextRange"\}\}/);
});

test('checked-in replaceTextRange descriptor mirrors Wesley generated metadata', async (context) => {
  const wesleyRoot = resolveWesleyRoot();
  if (wesleyRoot == null) {
    context.skip('Set JEDIT_WESLEY_ROOT to compare checked-in metadata with Wesley output.');
    return;
  }

  const generated = runStructuralHistoryGeneration(wesleyRoot);
  const modules = await loadBuiltModules();

  assert.equal(
    modules.generatedMetadata.mutationReplaceTextRangeOperation.fieldName,
    generatedField(generated, 'mutationReplaceTextRangeOperation'),
  );
  assert.equal(
    modules.generatedMetadata.mutationReplaceTextRangeOperation.directives.wes_op.name,
    modules.generatedMetadata.mutationReplaceTextRangeOperation.fieldName,
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
    const build = spawnSync(process.execPath, ['node_modules/typescript/bin/tsc', '-p', 'tsconfig.json'], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
    });

    assert.equal(build.status, 0, build.stderr || build.stdout);

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

function resolveWesleyRoot() {
  if (process.env.JEDIT_WESLEY_ROOT != null && process.env.JEDIT_WESLEY_ROOT.length > 0) {
    return process.env.JEDIT_WESLEY_ROOT;
  }
  if (existsSync(LOCAL_WESLEY_ROOT)) {
    return LOCAL_WESLEY_ROOT;
  }
  return null;
}

function runStructuralHistoryGeneration(wesleyRoot) {
  const generation = spawnSync('npm', ['run', '--silent', STRUCTURAL_HISTORY_GENERATION_SCRIPT], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    env: {
      ...process.env,
      JEDIT_WESLEY_ROOT: wesleyRoot,
    },
  });

  assert.equal(generation.status, 0, generation.stderr || generation.stdout);
  return readGeneratedCache();
}

function readGeneratedCache() {
  return readFileSync(CACHE_GENERATED_PATH, 'utf8');
}

function generatedField(generated, operationConstantName) {
  const pattern = new RegExp(`export const ${operationConstantName} = [\\s\\S]*?fieldName: "([^"]+)"`);
  const match = generated.match(pattern);

  assert.notEqual(match, null);
  return match[1];
}
