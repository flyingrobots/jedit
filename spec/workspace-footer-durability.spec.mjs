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
