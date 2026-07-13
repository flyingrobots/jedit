import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';
import { REPO_ROOT, ensureDistBuilt } from './dist-helpers.mjs';

const FIXTURE_MODULE_PATH = path.join(
  REPO_ROOT,
  'dist',
  'adapters',
  'full-snapshot-hot-text-runtime-fixture.js',
);
const TEXT_MODULE_PATH = path.join(REPO_ROOT, 'dist', 'domain', 'text-edit-contract.js');

async function loadModules() {
  await ensureDistBuilt();

  const fixture = await import(pathToFileURL(FIXTURE_MODULE_PATH).href);
  const text = await import(pathToFileURL(TEXT_MODULE_PATH).href);
  return { fixture, text };
}

function replayScript(runtime, text, bufferPath) {
  const created = runtime.createBuffer(bufferPath, 'hello world');
  const edited = runtime.admitReplaceRangeTick(
    created,
    text.createTextRange(5, 5),
    ' brave new',
  );
  const trimmed = runtime.admitReplaceRangeTick(
    edited.nextState,
    text.createTextRange(0, 5),
    'goodbye',
  );

  return {
    createdRootId: created.currentRoot.id,
    firstReceipt: edited.receipt.replaceReceipt,
    secondReceipt: trimmed.receipt.replaceReceipt,
    finalRootId: trimmed.nextState.currentRoot.id,
    finalText: runtime.materialize(trimmed.nextState),
  };
}

function assertIdenticalIdentities(left, right) {
  assert.equal(left.createdRootId, right.createdRootId);
  assert.deepEqual(left.firstReceipt, right.firstReceipt);
  assert.deepEqual(left.secondReceipt, right.secondReceipt);
  assert.equal(left.finalRootId, right.finalRootId);
  assert.equal(left.finalText, right.finalText);
}

test('Two buffers replaying the same script mint identical root identities.', async () => {
  const { fixture, text } = await loadModules();
  const runtime = fixture.createFullSnapshotHotTextRuntimeFixture();

  const first = replayScript(runtime, text, 'first.txt');
  const second = replayScript(runtime, text, 'second.txt');

  assertIdenticalIdentities(first, second);
});

test('Interleaved buffer creation does not perturb per-buffer root identities.', async () => {
  const { fixture, text } = await loadModules();
  const runtime = fixture.createFullSnapshotHotTextRuntimeFixture();

  const solo = replayScript(runtime, text, 'solo.txt');

  const interleavedA = runtime.createBuffer('a.txt', 'hello world');
  const interleavedB = runtime.createBuffer('b.txt', 'hello world');
  const editedA = runtime.admitReplaceRangeTick(
    interleavedA,
    text.createTextRange(5, 5),
    ' brave new',
  );
  const editedB = runtime.admitReplaceRangeTick(
    interleavedB,
    text.createTextRange(5, 5),
    ' brave new',
  );
  const trimmedA = runtime.admitReplaceRangeTick(
    editedA.nextState,
    text.createTextRange(0, 5),
    'goodbye',
  );

  assert.equal(interleavedA.currentRoot.id, solo.createdRootId);
  assert.equal(interleavedB.currentRoot.id, solo.createdRootId);
  assert.deepEqual(editedA.receipt.replaceReceipt, solo.firstReceipt);
  assert.deepEqual(editedB.receipt.replaceReceipt, solo.firstReceipt);
  assert.deepEqual(trimmedA.receipt.replaceReceipt, solo.secondReceipt);
});

test('Independent runtimes replaying the same script mint identical identities.', async () => {
  const { fixture, text } = await loadModules();

  const first = replayScript(
    fixture.createFullSnapshotHotTextRuntimeFixture(),
    text,
    'shared.txt',
  );
  const second = replayScript(
    fixture.createFullSnapshotHotTextRuntimeFixture(),
    text,
    'shared.txt',
  );

  assertIdenticalIdentities(first, second);
});
