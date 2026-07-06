import assert from 'node:assert/strict';
import test from 'node:test';
import { importDist } from './dist-helpers.mjs';

async function loadGraftDrawer() {
  return importDist('ui', 'graft-drawer.js');
}

async function loadWorkspaceGraftDrawer() {
  return importDist('app', 'workspace', 'graft-drawer.js');
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

test('Graft drawer displays Edict Core and Echo Target IR projection lanes', async () => {
  const { renderGraftDrawerLines } = await loadGraftDrawer();
  const lines = renderGraftDrawerLines(baseDrawerModel({
    path: '/repo/demo.edict',
    relativePath: 'demo.edict',
    projectionSource: 'live-buffer',
    projectionPosture: 'current',
    edictCoreProjection: {
      state: 'available',
      digest: 'sha256:2222222222222222222222222222222222222222222222222222222222222222',
      summaryLines: ['review: apiVersion'],
    },
    echoTargetIrProjection: {
      state: 'available',
      digest: 'sha256:3333333333333333333333333333333333333333333333333333333333333333',
      domain: 'echo.span-ir/v1',
      targetCoordinate: 'echo.dpo@1',
      targetProfileDigest: 'sha256:1111111111111111111111111111111111111111111111111111111111111111',
      summaryLines: ['review: intents'],
    },
    outlineItems: [],
    changeLines: [],
  }), 120, 24);
  const text = linesToText(lines);

  assert.match(text, /edict core/);
  assert.match(text, /state: available/);
  assert.match(text, /core digest: sha256:222222/);
  assert.match(text, /review: apiVersion/);
  assert.match(text, /echo target ir/);
  assert.match(text, /domain: echo\.span-ir\/v1/);
  assert.match(text, /target: echo\.dpo@1/);
  assert.match(text, /target profile: sha256:111111/);
  assert.match(text, /target ir digest: sha256:333333/);
  assert.match(text, /review: intents/);
  assert.doesNotMatch(text, /executed/);
  assert.doesNotMatch(text, /admitted/);
});

test('Graft drawer renders generic projection lanes without runtime claims', async () => {
  const { renderGraftDrawerLines } = await loadGraftDrawer();
  const lines = renderGraftDrawerLines(baseDrawerModel({
    path: '/repo/schema.graphql',
    relativePath: 'schema.graphql',
    projectionSource: 'live-buffer',
    projectionPosture: 'current',
    projectionLanes: [{
      title: 'wesley schema',
      state: 'available',
      digest: {
        label: 'schema digest',
        value: 'sha256:4444444444444444444444444444444444444444444444444444444444444444',
      },
      metadata: [{
        label: 'profile',
        value: 'echo-contract-sdl',
      }, {
        label: 'extension',
        value: 'echo.graphql-contract-descriptors/v1',
      }],
      summaryLines: ['descriptor: echoContractHost'],
    }],
    outlineItems: [],
    changeLines: [],
  }), 120, 24);
  const text = linesToText(lines);

  assert.match(text, /wesley schema/);
  assert.match(text, /state: available/);
  assert.match(text, /schema digest: sha256:444444/);
  assert.match(text, /profile: echo-contract-sdl/);
  assert.match(text, /extension: echo\.graphql-contract-descriptors\/v1/);
  assert.match(text, /descriptor: echoContractHost/);
  assert.doesNotMatch(text, /run/i);
  assert.doesNotMatch(text, /debug/i);
  assert.doesNotMatch(text, /repl/i);
  assert.doesNotMatch(text, /executed/i);
  assert.doesNotMatch(text, /admitted/i);
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
  assert.match(text, /payload: "inputBasisDigest"="sha256:111111/);
  assert.match(text, /payload: "meta"=\{\}/);
  assert.doesNotMatch(text, /meta=\{\{\}\}/);
  assert.match(text, /"observedBasisDigest"="sha256:444444/);
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
  assert.match(visibleText, /payload: "key00"="value00"/);
  assert.doesNotMatch(visibleText, /key19=value19/);
});

test('Graft drawer formats only visible receipt payload entries', async () => {
  const { renderGraftDrawerLines } = await loadGraftDrawer();
  const reasonPayload = {
    key00: 'value00',
    key01: 'value01',
    key02: 'value02',
  };
  Object.defineProperty(reasonPayload, 'key03', {
    enumerable: true,
    get() {
      throw new Error('omitted payload entry should not be formatted');
    },
  });

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
    outlineItems: [],
    changeLines: [],
  }), 120, 24);
  const text = linesToText(lines);

  assert.match(text, /payload: "key00"="value00"/);
  assert.match(text, /payload: "key02"="value02"/);
  assert.match(text, /payload: \.\.\. 1 more/);
  assert.doesNotMatch(text, /key03/);
});

test('Graft drawer bounds nested receipt payload formatting', async () => {
  const { renderGraftDrawerLines } = await loadGraftDrawer();
  const nestedObject = {
    alpha: 'one',
    beta: 'two',
    gamma: 'three',
  };
  Object.defineProperty(nestedObject, 'omega', {
    enumerable: true,
    get() {
      throw new Error('omitted nested object entry should not be formatted');
    },
  });
  const nestedArray = ['one', 'two', 'three'];
  Object.defineProperty(nestedArray, '3', {
    enumerable: true,
    get() {
      throw new Error('omitted nested array entry should not be formatted');
    },
  });

  const lines = renderGraftDrawerLines(baseDrawerModel({
    path: '/repo/demo.edict',
    relativePath: 'demo.edict',
    projectionSource: 'live-buffer',
    projectionPosture: 'current',
    obstructionReceipt: {
      outcomeKind: 'obstructed_strand',
      targetIrDigest: 'sha256:3333333333333333333333333333333333333333333333333333333333333333',
      reasonPayload: {
        nestedArray,
        nestedObject,
      },
      receipt: {
        schema: 'echo.execution.receipt.review/v0',
      },
    },
    outlineItems: [],
    changeLines: [],
  }), 120, 24);
  const text = linesToText(lines);

  assert.match(text, /payload: "nestedArray"=\["one", "two", "three", \.\.\. 1 more\]/);
  assert.match(text, /payload: "nestedObject"=\{"alpha"="one", "beta"="two", "gamma"="three", \.\.\. 1 more\}/);
  assert.doesNotMatch(text, /omega/);
});

test('Graft drawer page movement uses bounded receipt payload rows', async () => {
  const { updateGraftDrawerFromKey } = await loadWorkspaceGraftDrawer();
  const reasonPayload = Object.fromEntries(Array.from({ length: 20 }, (_entry, index) => [
    `key${String(index).padStart(2, '0')}`,
    `value${String(index).padStart(2, '0')}`,
  ]));
  const outlineItems = Array.from({ length: 30 }, (_entry, index) => ({
    kind: 'function',
    name: `item${String(index).padStart(2, '0')}`,
    startLine: index + 1,
  }));
  const [nextModel] = updateGraftDrawerFromKey(
    { key: 'pagedown' },
    {
      rows: 30,
      footerVisible: false,
      graftSelectedIndex: 0,
      graftInfo: {
        path: '/repo/demo.edict',
        relativePath: 'demo.edict',
        projectionSource: 'live-buffer',
        projectionPosture: 'current',
        projectionLanes: [{
          title: 'wesley schema',
          state: 'available',
          digest: {
            label: 'schema digest',
            value: 'sha256:4444444444444444444444444444444444444444444444444444444444444444',
          },
          metadata: [{ label: 'profile', value: 'echo-contract-sdl' }, { label: 'extension', value: 'echo.graphql-contract-descriptors/v1' }],
          summaryLines: ['descriptor: echoContractHost'],
        }],
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
        outlineItems,
        changeLines: [],
      },
    },
    () => {
      throw new Error('refresh should not run for PageDown');
    },
  );

  assert.equal(nextModel.graftSelectedIndex, 1);
});

test('Graft drawer escapes receipt payload strings before row fitting', async () => {
  const { renderGraftDrawerLines } = await loadGraftDrawer();
  const lines = renderGraftDrawerLines(baseDrawerModel({
    path: '/repo/demo.edict',
    relativePath: 'demo.edict',
    projectionSource: 'live-buffer',
    projectionPosture: 'current',
    obstructionReceipt: {
      outcomeKind: 'obstructed_strand',
      targetIrDigest: 'sha256:3333333333333333333333333333333333333333333333333333333333333333',
      reasonPayload: {
        message: 'line one\nline two',
      },
      receipt: {
        schema: 'echo.execution.receipt.review/v0',
      },
    },
    outlineItems: [],
    changeLines: [],
  }), 120, 24);
  const text = linesToText(lines);

  assert.equal(lines.some((line) => line.includes('\n')), false);
  assert.match(text, /payload: "message"="line one\\nline two"/);
});

test('Graft drawer escapes receipt payload keys before row fitting', async () => {
  const { renderGraftDrawerLines } = await loadGraftDrawer();
  const lines = renderGraftDrawerLines(baseDrawerModel({
    path: '/repo/demo.edict',
    relativePath: 'demo.edict',
    projectionSource: 'live-buffer',
    projectionPosture: 'current',
    obstructionReceipt: {
      outcomeKind: 'obstructed_strand',
      targetIrDigest: 'sha256:3333333333333333333333333333333333333333333333333333333333333333',
      reasonPayload: {
        'line one\nline two': 'value',
      },
      receipt: {
        schema: 'echo.execution.receipt.review/v0',
      },
    },
    outlineItems: [],
    changeLines: [],
  }), 120, 24);
  const text = linesToText(lines);

  assert.equal(lines.some((line) => line.includes('\n')), false);
  assert.match(text, /payload: "line one\\nline two"="value"/);
});

test('Graft drawer escapes receipt scalar rows before row fitting', async () => {
  const { renderGraftDrawerLines } = await loadGraftDrawer();
  const lines = renderGraftDrawerLines(baseDrawerModel({
    path: '/repo/demo.edict',
    relativePath: 'demo.edict',
    projectionSource: 'live-buffer',
    projectionPosture: 'current',
    obstructionReceipt: {
      outcomeKind: 'obstructed\nstrand',
      targetIrDigest: 'sha256:3333333333333333333333333333333333333333333333333333333333333333\nmutated',
      targetIrDomain: 'echo.span-ir/v1\nshadow',
      reasonKind: 'jim.EditObstruction.StaleBase\nshadow',
      receipt: {
        schema: 'echo.execution.receipt.review/v0',
      },
    },
    outlineItems: [],
    changeLines: [],
  }), 120, 24);
  const text = linesToText(lines);

  assert.equal(lines.some((line) => line.includes('\n')), false);
  assert.match(text, /outcome: obstructed\\nstrand/);
  assert.match(text, /target: echo\.span-ir\/v1\\nshadow sha256:333333/);
  assert.match(text, /reason: jim\.EditObstruction\.StaleBase\\nshadow/);
});
