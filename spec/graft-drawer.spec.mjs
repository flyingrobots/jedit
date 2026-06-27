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
