import assert from 'node:assert/strict';
import test from 'node:test';
import { importDist } from './workspace-helpers.mjs';

const HEAD_OPENED = 'head:opened';
const HEAD_EDITED = 'head:edited';

test('buffer durability keeps intent, causal, file, and Git evidence independent', async () => {
  const [authority, durability, profile, worldline] = await Promise.all([
    importDist('app', 'workspace', 'workspace-text-authority.js'),
    importDist('app', 'workspace', 'workspace-buffer-durability.js'),
    importDist('app', 'text-runtime-profile.js'),
    importDist('app', 'workspace', 'worldline-types.js'),
  ]);
  const opened = authority.openedWorkspaceTextAuthority({
    profile: profile.TEXT_RUNTIME_PROFILE_ECHO_HOSTED,
    filePath: '/repo/notes.md',
    bufferId: 'buffer:notes',
    readOnly: false,
    dirty: false,
    materialization: worldline.WorkspaceWorldlineMaterializationKinds.Materialized,
    hostBasis: authority.WorkspaceTextHostBasisKinds.File,
    hostFingerprint: fileFingerprint('opened'),
    cache: basisCache(HEAD_OPENED),
  });

  assert.deepEqual(opened.durability.intent, {
    kind: durability.WorkspaceBufferIntentDurabilityKinds.Idle,
  });
  assert.deepEqual(opened.durability.causal, {
    kind: durability.WorkspaceBufferCausalDurabilityKinds.Admitted,
    headId: HEAD_OPENED,
  });
  assert.equal(opened.durability.file.kind, durability.WorkspaceBufferFileDurabilityKinds.Saved);
  assert.equal(opened.durability.file.basisHeadId, HEAD_OPENED);
  assert.equal(opened.durability.localGit.kind, durability.WorkspaceBufferLocalGitDurabilityKinds.Unknown);
  assert.equal(opened.durability.remoteGit.kind, durability.WorkspaceBufferRemoteGitDurabilityKinds.Unknown);

  const queued = authority.workspaceTextAuthorityWithPendingEdit(
    opened,
    7,
    authority.WorkspaceTextPendingCommandKinds.Vim,
  );
  assert.equal(queued.durability.intent.kind, durability.WorkspaceBufferIntentDurabilityKinds.Pending);
  assert.equal(queued.durability.intent.clientSeq, 7);
  assert.equal(queued.durability.causal.headId, HEAD_OPENED);
  assert.equal(queued.durability.file.basisHeadId, HEAD_OPENED);

  const admitted = authority.workspaceTextAuthorityWithReceipt(queued, 'receipt:edit', {
    admittedTickId: 'tick:edit',
    nextHeadId: HEAD_EDITED,
  });
  assert.equal(admitted.durability.intent.kind, durability.WorkspaceBufferIntentDurabilityKinds.Idle);
  assert.deepEqual(admitted.durability.causal, {
    kind: durability.WorkspaceBufferCausalDurabilityKinds.Admitted,
    headId: HEAD_EDITED,
    receiptId: 'receipt:edit',
    admittedTickId: 'tick:edit',
  });
  assert.equal(admitted.durability.file.basisHeadId, HEAD_OPENED);

  const checkpointOnly = authority.workspaceTextAuthorityWithCheckpoint(
    admitted,
    'checkpoint:edited',
    HEAD_EDITED,
  );
  assert.equal(checkpointOnly.durability.file.basisHeadId, HEAD_OPENED);
  assert.equal(checkpointOnly.durability.file.checkpointId, undefined);
  assert.deepEqual(checkpointOnly.durability.lastCheckpoint, {
    checkpointId: 'checkpoint:edited',
    basisHeadId: HEAD_EDITED,
  });

  const exported = authority.workspaceTextAuthorityWithExport(
    checkpointOnly,
    'reading:export',
    HEAD_EDITED,
    fileFingerprint('exported'),
  );
  assert.equal(exported.durability.file.kind, durability.WorkspaceBufferFileDurabilityKinds.Saved);
  assert.equal(exported.durability.file.basisHeadId, HEAD_EDITED);
  assert.equal(exported.durability.file.exportReadingId, 'reading:export');

  const checkpointed = authority.workspaceTextAuthorityWithCheckpoint(
    exported,
    'checkpoint:edited',
    HEAD_EDITED,
  );
  assert.equal(checkpointed.durability.file.checkpointId, 'checkpoint:edited');

  const committed = durability.workspaceBufferDurabilityWithGitEvidence(
    checkpointed.durability,
    {
      localGit: {
        kind: durability.WorkspaceBufferLocalGitDurabilityKinds.Committed,
        commitId: 'commit:local',
      },
      remoteGit: {
        kind: durability.WorkspaceBufferRemoteGitDurabilityKinds.Durable,
        commitId: 'commit:local',
        remoteRef: 'origin/main',
      },
    },
  );
  assert.equal(committed.localGit.commitId, 'commit:local');
  assert.equal(committed.remoteGit.remoteRef, 'origin/main');
});

function basisCache(basisHeadId) {
  return {
    textBasis: {
      basisHeadId,
      byteRange: {
        startByte: 0,
        endByte: 0,
      },
    },
  };
}

function fileFingerprint(digest) {
  return {
    algorithm: 'sha256',
    digest,
    byteLength: 0,
  };
}
