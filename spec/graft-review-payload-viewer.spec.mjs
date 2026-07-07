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

function baseDrawerModel(graftInfo, expandedProjectionLaneIndex) {
  return {
    editor: {},
    graftInfo,
    graftLoading: false,
    graftSelectedIndex: 0,
    ...(expandedProjectionLaneIndex === undefined ? {} : { expandedProjectionLaneIndex }),
  };
}

function reviewPayloadLane(payload) {
  return {
    title: 'wesley schema',
    state: 'available',
    digest: {
      label: 'schema digest',
      value: 'sha256:4444444444444444444444444444444444444444444444444444444444444444',
    },
    metadata: [{ label: 'profile', value: 'echo-contract-sdl' }],
    summaryLines: ['review: schemaModel'],
    reviewPayload: payload,
  };
}

test('Graft drawer expands generic projection review payloads without semantic claims', async () => {
  const { renderGraftDrawerLines } = await loadGraftDrawer();
  const collapsed = renderGraftDrawerLines(baseDrawerModel({
    path: '/repo/schema.graphql',
    relativePath: 'schema.graphql',
    projectionSource: 'live-buffer',
    projectionPosture: 'current',
    projectionLanes: [reviewPayloadLane({
      apiVersion: 'wesley.schema.review/v1',
      descriptors: [{ kind: 'echoContractHost' }],
    })],
    outlineItems: [],
    changeLines: [],
  }), 120, 24);
  const expanded = renderGraftDrawerLines(baseDrawerModel({
    path: '/repo/schema.graphql',
    relativePath: 'schema.graphql',
    projectionSource: 'live-buffer',
    projectionPosture: 'current',
    projectionLanes: [reviewPayloadLane({
      apiVersion: 'wesley.schema.review/v1',
      descriptors: [{ kind: 'echoContractHost' }],
    })],
    outlineItems: [],
    changeLines: [],
  }, 0), 120, 24);
  const collapsedText = linesToText(collapsed);
  const expandedText = linesToText(expanded);

  assert.doesNotMatch(collapsedText, /review payload:/);
  assert.match(expandedText, /review payload:/);
  assert.match(expandedText, /"apiVersion": "wesley\.schema\.review\/v1"/);
  assert.match(expandedText, /"descriptors": \[/);
  assert.match(expandedText, /"kind": "echoContractHost"/);
  assert.doesNotMatch(expandedText, /run/i);
  assert.doesNotMatch(expandedText, /debug/i);
  assert.doesNotMatch(expandedText, /repl/i);
  assert.doesNotMatch(expandedText, /executed/i);
  assert.doesNotMatch(expandedText, /admitted/i);
});

test('Graft drawer explicitly truncates oversized review payloads', async () => {
  const { renderGraftDrawerLines } = await loadGraftDrawer();
  const payload = {
    items: Array.from({ length: 20 }, (_entry, index) => ({ name: `item${String(index).padStart(2, '0')}` })),
  };
  const lines = renderGraftDrawerLines(baseDrawerModel({
    path: '/repo/schema.graphql',
    relativePath: 'schema.graphql',
    projectionSource: 'live-buffer',
    projectionPosture: 'current',
    projectionLanes: [reviewPayloadLane(payload)],
    outlineItems: [],
    changeLines: [],
  }, 0), 120, 40);
  const text = linesToText(lines);

  assert.match(text, /"items": \[/);
  assert.match(text, /review payload truncated at 12 rows/);
  assert.doesNotMatch(text, /item19/);
});

test('Graft drawer marks omitted review payload collection entries', async () => {
  const { renderGraftDrawerLines } = await loadGraftDrawer();
  const lines = renderGraftDrawerLines(baseDrawerModel({
    path: '/repo/schema.graphql',
    relativePath: 'schema.graphql',
    projectionSource: 'live-buffer',
    projectionPosture: 'current',
    projectionLanes: [reviewPayloadLane({
      labels: ['alpha', 'beta', 'gamma', 'delta', 'epsilon', 'zeta'],
    })],
    outlineItems: [],
    changeLines: [],
  }, 0), 120, 32);
  const text = linesToText(lines);

  assert.match(text, /\.\.\. 2 more items/);
  assert.doesNotMatch(text, /epsilon/);
});

test('Graft drawer caps root object review payload entries', async () => {
  const { renderGraftDrawerLines } = await loadGraftDrawer();
  const payload = Object.fromEntries(Array.from({ length: 7 }, (_entry, index) => [
    `key${String(index).padStart(2, '0')}`,
    `value${String(index).padStart(2, '0')}`,
  ]));
  const lines = renderGraftDrawerLines(baseDrawerModel({
    path: '/repo/schema.graphql',
    relativePath: 'schema.graphql',
    projectionSource: 'live-buffer',
    projectionPosture: 'current',
    projectionLanes: [reviewPayloadLane(payload)],
    outlineItems: [],
    changeLines: [],
  }, 0), 120, 32);
  const text = linesToText(lines);

  assert.match(text, /"key00": "value00"/);
  assert.match(text, /"key03": "value03"/);
  assert.match(text, /\.\.\. 3 more entries/);
  assert.doesNotMatch(text, /key04/);
});

test('Graft drawer bounds nested object review payload depth', async () => {
  const { renderGraftDrawerLines } = await loadGraftDrawer();
  const payload = {
    level1: {
      level2: {
        level3: {
          level4: {
            level5: {
              leaked: 'too deep',
            },
          },
        },
      },
    },
  };
  const lines = renderGraftDrawerLines(baseDrawerModel({
    path: '/repo/schema.graphql',
    relativePath: 'schema.graphql',
    projectionSource: 'live-buffer',
    projectionPosture: 'current',
    projectionLanes: [reviewPayloadLane(payload)],
    outlineItems: [],
    changeLines: [],
  }, 0), 120, 40);
  const text = linesToText(lines);

  assert.match(text, /"level4": \{\.\.\.\}/);
  assert.doesNotMatch(text, /level5/);
  assert.doesNotMatch(text, /too deep/);
});

test('Graft drawer bounds review payload object key scanning', async () => {
  const { renderGraftDrawerLines } = await loadGraftDrawer();
  const payload = Object.fromEntries(Array.from({ length: 80 }, (_entry, index) => [
    `key${String(index).padStart(2, '0')}`,
    `value${String(index).padStart(2, '0')}`,
  ]));
  const lines = renderGraftDrawerLines(baseDrawerModel({
    path: '/repo/schema.graphql',
    relativePath: 'schema.graphql',
    projectionSource: 'live-buffer',
    projectionPosture: 'current',
    projectionLanes: [reviewPayloadLane(payload)],
    outlineItems: [],
    changeLines: [],
  }, 0), 120, 32);
  const text = linesToText(lines);

  assert.match(text, /\.\.\. at least 61 more entries/);
  assert.doesNotMatch(text, /key64/);
});

test('Graft drawer toggles generic review payload visibility from key input', async () => {
  const { renderGraftDrawerLines } = await loadGraftDrawer();
  const { updateGraftDrawerFromKey } = await loadWorkspaceGraftDrawer();
  const model = {
    ...baseDrawerModel({
      path: '/repo/schema.graphql',
      relativePath: 'schema.graphql',
      projectionSource: 'live-buffer',
      projectionPosture: 'current',
      projectionLanes: [reviewPayloadLane({
        apiVersion: 'wesley.schema.review/v1',
      })],
      outlineItems: [],
      changeLines: [],
    }),
    rows: 24,
    footerVisible: false,
  };
  const [expandedModel] = updateGraftDrawerFromKey(
    { key: 'space' },
    model,
    () => {
      throw new Error('refresh should not run for expansion');
    },
  );
  const expandedText = linesToText(renderGraftDrawerLines(expandedModel, 120, 24));

  assert.equal(expandedModel.expandedProjectionLaneIndex, 0);
  assert.match(expandedText, /review payload:/);
  assert.match(expandedText, /"apiVersion": "wesley\.schema\.review\/v1"/);

  const [collapsedModel] = updateGraftDrawerFromKey(
    { key: 'space' },
    expandedModel,
    () => {
      throw new Error('refresh should not run for collapse');
    },
  );
  const collapsedText = linesToText(renderGraftDrawerLines(collapsedModel, 120, 24));

  assert.equal(collapsedModel.expandedProjectionLaneIndex, undefined);
  assert.doesNotMatch(collapsedText, /review payload:/);
});

test('Graft drawer treats stale expanded review payload state as collapsed', async () => {
  const { updateGraftDrawerFromKey } = await loadWorkspaceGraftDrawer();
  const model = {
    ...baseDrawerModel({
      path: '/repo/schema.graphql',
      relativePath: 'schema.graphql',
      projectionSource: 'live-buffer',
      projectionPosture: 'current',
      projectionLanes: [reviewPayloadLane({
        apiVersion: 'wesley.schema.review/v1',
      })],
      outlineItems: [],
      changeLines: [],
    }, 99),
    rows: 24,
    footerVisible: false,
  };

  const [expandedModel] = updateGraftDrawerFromKey(
    { key: 'space' },
    model,
    () => {
      throw new Error('refresh should not run for expansion');
    },
  );

  assert.equal(expandedModel.expandedProjectionLaneIndex, 0);
});

test('Graft drawer page movement accounts for expanded review payload rows', async () => {
  const { updateGraftDrawerFromKey } = await loadWorkspaceGraftDrawer();
  const outlineItems = Array.from({ length: 30 }, (_entry, index) => ({
    kind: 'function',
    name: `item${String(index).padStart(2, '0')}`,
    startLine: index + 1,
  }));
  const [nextModel] = updateGraftDrawerFromKey(
    { key: 'pagedown' },
    {
      rows: 36,
      footerVisible: false,
      graftSelectedIndex: 0,
      expandedProjectionLaneIndex: 0,
      graftInfo: {
        path: '/repo/schema.graphql',
        relativePath: 'schema.graphql',
        projectionSource: 'live-buffer',
        projectionPosture: 'current',
        projectionLanes: [reviewPayloadLane({
          apiVersion: 'wesley.schema.review/v1',
          descriptors: Array.from({ length: 12 }, (_entry, index) => ({ kind: `kind${String(index)}` })),
        })],
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
