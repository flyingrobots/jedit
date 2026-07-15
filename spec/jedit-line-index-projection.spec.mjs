import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';
import { REPO_ROOT, ensureDistBuilt } from './dist-helpers.mjs';

const LINE_INDEX_MODULE_PATH = path.join(REPO_ROOT, 'dist', 'app', 'jedit-line-index-projection.js');
const WHY_RANGE_MODULE_PATH = path.join(REPO_ROOT, 'dist', 'app', 'jedit-why-range.js');
const CONTRACT_APP_MODULE_PATH = path.join(REPO_ROOT, 'dist', 'app', 'jedit-contract-runtime.js');
const FIXTURE_MODULE_PATH = path.join(REPO_ROOT, 'dist', 'adapters', 'full-snapshot-hot-text-runtime-fixture.js');
const HASH_MODULE_PATH = path.join(REPO_ROOT, 'dist', 'adapters', 'hash.js');
const UTF8_ENCODER = new TextEncoder();

let modulesPromise;

test('line index rebuild preserves Unicode offsets and treats CRLF as one break', async () => {
  const { lineIndex } = await loadModules();
  const text = 'α\r\n🙂\rZ\n';
  const projection = fullProjection(text, 'head:unicode-crlf');
  const index = lineIndex.buildJeditLineIndexProjection(projection);

  assert.equal(index.kind, lineIndex.JEDIT_LINE_INDEX_PROJECTION_KIND);
  assert.equal(index.basis.lineCount, 4);
  assert.deepEqual(index.lines.map(unwrappedLine), [
    { line: 0, startByte: 0, contentEndByte: 2, nextLineStartByte: 4 },
    { line: 1, startByte: 4, contentEndByte: 8, nextLineStartByte: 9 },
    { line: 2, startByte: 9, contentEndByte: 10, nextLineStartByte: 11 },
    { line: 3, startByte: 11, contentEndByte: 11, nextLineStartByte: 11 },
  ]);
});

test('line index deletion discards only rebuildable projection state', async () => {
  const { lineIndex } = await loadModules();
  const projection = fullProjection('first\r\nsecond 🙂', 'head:rebuild');
  const expected = lineIndex.buildJeditLineIndexProjection(projection);
  const store = lineIndex.createDisposableJeditLineIndexStore();

  store.retain(expected);
  assert.equal(store.find(expected.basis.worldlineId, expected.basis.headId), expected);
  store.delete(expected.basis.worldlineId, expected.basis.headId);
  assert.equal(store.find(expected.basis.worldlineId, expected.basis.headId), null);

  assert.deepEqual(lineIndex.buildJeditLineIndexProjection(projection), expected);
});

test('line index store isolates equal head labels from different worldlines', async () => {
  const { lineIndex } = await loadModules();
  const first = lineIndex.buildJeditLineIndexProjection(fullProjection('first', 'head:1'));
  const secondProjection = fullProjection('second', 'head:1');
  const second = lineIndex.buildJeditLineIndexProjection({
    ...secondProjection,
    basis: {
      ...secondProjection.basis,
      worldlineId: 'wl:other-line-index',
    },
  });
  const store = lineIndex.createDisposableJeditLineIndexStore();

  store.retain(first);
  store.retain(second);

  assert.equal(store.find(first.basis.worldlineId, first.basis.headId), first);
  assert.equal(store.find(second.basis.worldlineId, second.basis.headId), second);
});

test('line index selection budgets complete UTF-8 coverage including line breaks', async () => {
  const { lineIndex } = await loadModules();
  const index = lineIndex.buildJeditLineIndexProjection(fullProjection(
    'α\r\n🙂\rZ\n',
    'head:selection',
  ));

  const selection = lineIndex.selectJeditLineIndexWindow(index, {
    cursorLine: 2,
    viewportLineCount: 1,
    beforeLines: 1,
    afterLines: 1,
    maxBytes: 6,
  });

  assert.equal(selection.startLine.value, 1);
  assert.equal(selection.totalLineCount, 4);
  assert.deepEqual(selection.lines.map((line) => line.line.value), [1, 2]);
  assert.deepEqual({
    startByte: selection.byteRange.startByte.value,
    endByte: selection.byteRange.endByte.value,
  }, { startByte: 4, endByte: 10 });
});

test('line index eviction cannot alter retained range why evidence', async () => {
  const { lineIndex, whyRange, contractApp, fixture, hash } = await loadModules();
  const runtime = fixture.createFullSnapshotHotTextRuntimeFixture();
  const created = contractApp.createBufferWorldline(runtime, {
    bufferKey: 'line-index.txt',
    initialText: '',
    projectionPath: 'line-index.txt',
    createInitialCheckpoint: false,
  }, hash);
  const edited = contractApp.replaceRangeAsTick(runtime, created.nextSession, {
    worldlineId: created.result.worldline.worldlineId,
    baseHeadId: created.result.head.headId,
    startByte: 0,
    endByte: 0,
    insertText: 'retained',
    author: 'line-index-witness',
  }, hash);
  const range = { startByte: 0, endByte: 8 };
  const before = whyRange.explainJeditWhyRange(edited.nextSession, range);
  const store = lineIndex.createDisposableJeditLineIndexStore();
  const index = lineIndex.buildJeditLineIndexProjection(fullProjection(
    'retained',
    edited.result.nextHead.headId,
  ));

  store.retain(index);
  store.clear();

  assert.deepEqual(whyRange.explainJeditWhyRange(edited.nextSession, range), before);
});

async function loadModules() {
  await ensureDistBuilt();
  modulesPromise ??= Promise.all([
    import(pathToFileURL(LINE_INDEX_MODULE_PATH).href),
    import(pathToFileURL(WHY_RANGE_MODULE_PATH).href),
    import(pathToFileURL(CONTRACT_APP_MODULE_PATH).href),
    import(pathToFileURL(FIXTURE_MODULE_PATH).href),
    import(pathToFileURL(HASH_MODULE_PATH).href),
  ]).then(([lineIndex, whyRange, contractApp, fixture, hashAdapter]) => ({
    lineIndex,
    whyRange,
    contractApp,
    fixture,
    hash: hashAdapter.createHashPort(),
  }));
  return modulesPromise;
}

function fullProjection(text, headId) {
  const byteLength = UTF8_ENCODER.encode(text).length;
  return {
    basisHeadId: headId,
    basis: {
      worldlineId: 'wl:line-index',
      headId,
      rootNodeId: `root:${headId}`,
      byteLength,
      lineCount: logicalLineCount(text),
    },
    byteRange: { startByte: 0, endByte: byteLength },
    text,
    support: [],
  };
}

function logicalLineCount(text) {
  return text.split(/\r\n|\r|\n/).length;
}

function unwrappedLine(line) {
  return {
    line: line.line.value,
    startByte: line.startByte.value,
    contentEndByte: line.contentEndByte.value,
    nextLineStartByte: line.nextLineStartByte.value,
  };
}
