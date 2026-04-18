import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';

const REPO_ROOT = process.cwd();
const OPTIC_CLIENT_MODULE_PATH = path.join(REPO_ROOT, 'dist', 'app', 'jedit-optic-client.js');
const ADAPTER_MODULE_PATH = path.join(REPO_ROOT, 'dist', 'adapters', 'in-memory-hot-text-runtime.js');

async function loadModules() {
  const build = spawnSync(process.execPath, ['node_modules/typescript/bin/tsc', '-p', 'tsconfig.json'], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });

  assert.equal(build.status, 0, build.stderr || build.stdout);

  const [opticClientModule, adapter] = await Promise.all([
    import(pathToFileURL(OPTIC_CLIENT_MODULE_PATH).href),
    import(pathToFileURL(ADAPTER_MODULE_PATH).href),
  ]);

  return { opticClientModule, adapter };
}

test('in-memory optic client exposes GraphQL-shaped mutation and observer operations', async () => {
  const { opticClientModule, adapter } = await loadModules();
  const runtime = adapter.createInMemoryHotTextRuntime();
  const client = opticClientModule.createInMemoryJeditOpticClient(runtime);

  const created = client.createBufferWorldline({
    bufferKey: 'notes/today.md',
    initialText: 'hello world',
    projectionPath: '/tmp/notes/today.md',
    createInitialCheckpoint: true,
  });

  assert.equal(created.result.worldline.bufferKey, 'notes/today.md');
  assert.equal(created.result.checkpoint?.kind, 'INITIAL');

  const edited = client.replaceRangeAsTick(created.nextSession, {
    worldlineId: created.nextSession.worldline.worldlineId,
    baseHeadId: created.nextSession.worldline.canonicalHeadId,
    startByte: 5,
    endByte: 5,
    insertText: ' brave new',
    author: 'tester',
  });

  assert.ok(edited.result);
  assert.equal(edited.result.receipt.rewriteKind, 'REPLACE_RANGE_AS_TICK');

  const saved = client.createCheckpoint(edited.nextSession, {
    worldlineId: edited.nextSession.worldline.worldlineId,
    kind: 'MANUAL_SAVE',
    label: 'after edit',
  });

  assert.ok(saved.result);
  assert.equal(saved.result.checkpoint.kind, 'MANUAL_SAVE');

  const reading = client.worldlineSnapshot(
    saved.nextSession,
    'frontier:wl:notes-today-md:2',
    {
      worldlineId: saved.nextSession.worldline.worldlineId,
    },
  );

  assert.equal(reading.operationName, 'worldlineSnapshot');
  assert.equal(reading.frontierRef, 'frontier:wl:notes-today-md:2');
  assert.equal(reading.reading.text, 'hello brave new world');
  assert.equal(reading.reading.checkpoints.length, 2);
});
