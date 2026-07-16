import assert from 'node:assert/strict';
import test from 'node:test';
import { importDist } from './workspace-helpers.mjs';

test('footer durability posture separates admitted causal and saved file state', async () => {
  const footer = await importDist('app', 'workspace', 'workspace-footer-posture.js');

  assert.equal(
    footer.workspaceBufferDurabilityFooterPosture(cleanDurability()),
    'intent:idle | causal:admitted | file:saved | git:unknown | remote:unknown',
  );
});

test('footer durability posture exposes pending and admitted-unsaved state', async () => {
  const footer = await importDist('app', 'workspace', 'workspace-footer-posture.js');
  const durability = {
    ...cleanDurability(),
    intent: {
      kind: 'pending',
      clientSeq: 7,
      status: 'obstructed',
    },
    causal: {
      kind: 'admitted',
      headId: 'head:edited',
      receiptId: 'receipt:edited',
      admittedTickId: 'tick:edited',
    },
  };

  assert.equal(
    footer.workspaceBufferDurabilityFooterPosture(durability),
    'intent:pending:obstructed | causal:unsaved | file:saved | git:unknown | remote:unknown',
  );
});

test('footer durability posture exposes export and externally observed Git state', async () => {
  const footer = await importDist('app', 'workspace', 'workspace-footer-posture.js');
  const durability = {
    ...cleanDurability(),
    file: {
      kind: 'saved',
      basisHeadId: 'head:saved',
      exportReadingId: 'reading:export',
    },
    localGit: {
      kind: 'committed',
      commitId: 'commit:local',
    },
    remoteGit: {
      kind: 'durable',
      commitId: 'commit:local',
      remoteRef: 'origin/main',
    },
  };

  assert.equal(
    footer.workspaceBufferDurabilityFooterPosture(durability),
    'intent:idle | causal:admitted | file:exported | git:committed | remote:durable',
  );
});

test('worldline debug context explains causal line counts with exact support identities', async () => {
  const [footer, worldline] = await Promise.all([
    importDist('app', 'workspace', 'workspace-footer-posture.js'),
    importDist('app', 'workspace', 'worldline-state.js'),
  ]);
  const context = footer.workspaceHistoryContextLine({
    historyDrawerView: worldline.WorkspaceHistoryDrawerViews.Worldlines,
    worldline: worldline.initialWorkspaceWorldlineState(),
    textAuthority: {
      kind: 'opened',
      durability: {
        lineChanges: {
          kind: 'available',
          source: 'causal-observation',
          basisHeadId: 'head:saved',
          nextHeadId: 'head:edited',
          insertedLineCount: 3,
          deletedLineCount: 2,
          rewriteIds: ['rewrite:1', 'rewrite:2'],
          diffIds: ['diff:1', 'diff:2'],
          markers: [],
          deletions: [],
          observerVersion: 'jedit-causal-line-diff-v3',
        },
      },
    },
  });

  assert.match(context, /Causal lines head:saved->head:edited \+3\/-2/);
  assert.match(context, /rewrites:rewrite:1,rewrite:2/);
  assert.match(context, /diffs:diff:1,diff:2/);
});

function cleanDurability() {
  return {
    intent: { kind: 'idle' },
    causal: {
      kind: 'admitted',
      headId: 'head:saved',
    },
    file: {
      kind: 'saved',
      basisHeadId: 'head:saved',
    },
    localGit: { kind: 'unknown' },
    remoteGit: { kind: 'unknown' },
  };
}
