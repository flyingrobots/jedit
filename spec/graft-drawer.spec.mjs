import assert from 'node:assert/strict';
import test from 'node:test';
import { importDist } from './dist-helpers.mjs';

async function loadGraftDrawer() {
  return importDist('ui', 'graft-drawer.js');
}

function linesToText(lines) {
  return lines.join('\n');
}

function baseDrawerModel(graftInfo) {
  return {
    editor: {},
    graftInfo,
    graftLoading: false,
    graftSelectedIndex: 0,
  };
}

test('Graft drawer labels dirty saved-file projection as stale', async () => {
  const { renderGraftDrawerLines } = await loadGraftDrawer();
  const lines = renderGraftDrawerLines(baseDrawerModel({
    path: '/repo/example.txt',
    relativePath: 'example.txt',
    projectionSource: 'saved-file',
    projectionPosture: 'stale',
    outlineItems: [],
    changeLines: [],
    notice: 'saved file only; unsaved buffer edits not included',
  }), 100, 18);
  const text = linesToText(lines);

  assert.match(text, /source: saved-file/);
  assert.match(text, /posture: stale/);
  assert.match(text, /saved file only; unsaved buffer edits not included/);
});

test('Graft drawer explains Colorful prose without pretending it has outline structure', async () => {
  const { renderGraftDrawerLines } = await loadGraftDrawer();
  const lines = renderGraftDrawerLines({
    ...baseDrawerModel({
      path: '/repo/notes.txt',
      relativePath: 'notes.txt',
      projectionSource: 'saved-file',
      projectionPosture: 'current',
      outlineItems: [],
      changeLines: [],
    }),
    graftDiagnostics: {
      title: 'Graft diagnostics',
      summary: 'Colorful prose projection is active.',
      rows: [],
    },
  }, 100, 18);
  const text = linesToText(lines);

  assert.match(text, /prose projection active/);
  assert.match(text, /structural outline unavailable for this file type/);
  assert.doesNotMatch(text, /no structural outline/);
});

test('Graft drawer renders failure as enrichment-only obstruction', async () => {
  const { renderGraftDrawerLines } = await loadGraftDrawer();
  const lines = renderGraftDrawerLines(baseDrawerModel({
    path: '/repo/example.ts',
    relativePath: 'example.ts',
    projectionSource: 'unavailable',
    projectionPosture: 'obstructed',
    outlineItems: [],
    changeLines: [],
    error: 'graft request failed: unavailable',
  }), 100, 18);
  const text = linesToText(lines);

  assert.match(text, /source: unavailable/);
  assert.match(text, /posture: obstructed/);
  assert.match(text, /error: graft request failed: unavailable/);
  assert.doesNotMatch(text, /open a file to inspect it/);
});

test('Graft drawer uses text labels for projection state rows', async () => {
  const { renderGraftDrawerLines } = await loadGraftDrawer();
  const lines = renderGraftDrawerLines(baseDrawerModel({
    path: '/repo/example.ts',
    relativePath: 'example.ts',
    projectionSource: 'saved-file',
    projectionPosture: 'current',
    outlineItems: [{
      kind: 'function',
      name: 'render',
      startLine: 7,
    }],
    changeLines: [],
  }), 100, 18);

  assert.ok(lines.some((line) => line.startsWith('source: saved-file')));
  assert.ok(lines.some((line) => line.startsWith('posture: current')));
});

test('Graft drawer displays opaque obstruction receipt projection facts', async () => {
  const { renderGraftDrawerLines } = await loadGraftDrawer();
  const lines = renderGraftDrawerLines(baseDrawerModel({
    path: '/repo/demo.edict',
    relativePath: 'demo.edict',
    projectionSource: 'live-buffer',
    projectionPosture: 'current',
    obstructionReceipt: {
      outcomeKind: 'obstructed_strand',
      targetIrDigest: 'sha256:3333333333333333333333333333333333333333333333333333333333333333',
      targetIrDomain: 'echo.span-ir/v1',
      reasonKind: 'jim.EditObstruction.StaleBase',
      reasonPayload: {
        inputBasisDigest: 'sha256:1111111111111111111111111111111111111111111111111111111111111111',
        meta: {},
        observedBasisDigest: 'sha256:4444444444444444444444444444444444444444444444444444444444444444',
      },
      receipt: {
        receiptDigest: 'sha256:9999999999999999999999999999999999999999999999999999999999999999',
      },
    },
    outlineItems: [],
    changeLines: [],
  }), 120, 24);
  const text = linesToText(lines);

  assert.match(text, /receipt/);
  assert.match(text, /outcome: obstructed_strand/);
  assert.match(text, /target: echo\.span-ir\/v1 sha256:333333/);
  assert.match(text, /reason: jim\.EditObstruction\.StaleBase/);
  assert.match(text, /payload: inputBasisDigest=sha256:111111/);
  assert.match(text, /payload: meta=\{\}/);
  assert.doesNotMatch(text, /meta=\{\{\}\}/);
  assert.match(text, /observedBasisDigest=sha256:444444/);
  assert.doesNotMatch(text, /receiptDigest/);
  assert.doesNotMatch(text, /hard rejection/);
  assert.doesNotMatch(text, /counterfactual/);
});

test('Graft drawer bounds receipt payload rows before outline content', async () => {
  const { renderGraftDrawerLines } = await loadGraftDrawer();
  const reasonPayload = Object.fromEntries(Array.from({ length: 20 }, (_entry, index) => [
    `key${String(index).padStart(2, '0')}`,
    `value${String(index).padStart(2, '0')}`,
  ]));
  const drawerHeight = 18;
  const lines = renderGraftDrawerLines(baseDrawerModel({
    path: '/repo/demo.edict',
    relativePath: 'demo.edict',
    projectionSource: 'live-buffer',
    projectionPosture: 'current',
    obstructionReceipt: {
      outcomeKind: 'obstructed_strand',
      targetIrDigest: 'sha256:3333333333333333333333333333333333333333333333333333333333333333',
      targetIrDomain: 'echo.span-ir/v1',
      reasonKind: 'jim.EditObstruction.StaleBase',
      reasonPayload,
      receipt: {
        schema: 'echo.execution.receipt.review/v0',
      },
    },
    outlineItems: [{
      kind: 'function',
      name: 'render',
      startLine: 7,
    }],
    changeLines: [],
  }), 120, drawerHeight);
  const visibleText = lines.slice(0, drawerHeight).join('\n');

  assert.match(visibleText, /outline/);
  assert.match(visibleText, /function render/);
  assert.match(visibleText, /payload: key00=value00/);
  assert.doesNotMatch(visibleText, /key19=value19/);
});
