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
  assert.deepEqual(opened.durability.lineChanges, {
    kind: durability.WorkspaceBufferCausalLineChangeKinds.Available,
    source: durability.WorkspaceBufferCausalLineChangeSources.Identity,
    basisHeadId: HEAD_OPENED,
    nextHeadId: HEAD_OPENED,
    insertedLineCount: 0,
    deletedLineCount: 0,
    rewriteIds: [],
    diffIds: [],
    markers: [],
    observerVersion: 'jedit-causal-line-diff-identity-v1',
  });

  const queued = authority.workspaceTextAuthorityWithPendingEdit(
    opened,
    7,
    authority.WorkspaceTextPendingCommandKinds.Vim,
  );
  assert.equal(queued.durability.intent.kind, durability.WorkspaceBufferIntentDurabilityKinds.Pending);
  assert.equal(queued.durability.intent.clientSeq, 7);
  assert.equal(queued.durability.causal.headId, HEAD_OPENED);
  assert.equal(queued.durability.file.basisHeadId, HEAD_OPENED);
  assert.deepEqual(queued.durability.lineChanges, opened.durability.lineChanges);

  const admitted = authority.workspaceTextAuthorityWithReceipt(queued, 'receipt:edit', {
    causalTransition: {
      admittedTickId: 'tick:edit',
      nextHeadId: HEAD_EDITED,
    },
    lineChanges: durability.workspaceBufferCausalLineChangesFromReading({
      worldlineId: 'worldline:notes',
      basisHeadId: HEAD_OPENED,
      nextHeadId: HEAD_EDITED,
      insertedLineCount: 3,
      deletedLineCount: 2,
      rewriteIds: ['rewrite:edit'],
      diffIds: ['diff:edit'],
      markers: [],
      observerVersion: 'jedit-causal-line-diff-v2',
    }),
  });
  assert.equal(admitted.durability.intent.kind, durability.WorkspaceBufferIntentDurabilityKinds.Idle);
  assert.deepEqual(admitted.durability.causal, {
    kind: durability.WorkspaceBufferCausalDurabilityKinds.Admitted,
    headId: HEAD_EDITED,
    receiptId: 'receipt:edit',
    admittedTickId: 'tick:edit',
  });
  assert.equal(admitted.durability.file.basisHeadId, HEAD_OPENED);
  assert.equal(admitted.durability.lineChanges.insertedLineCount, 3);
  assert.equal(admitted.durability.lineChanges.deletedLineCount, 2);
  assert.deepEqual(admitted.durability.lineChanges.rewriteIds, ['rewrite:edit']);
  assert.deepEqual(admitted.durability.lineChanges.diffIds, ['diff:edit']);

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

  const staleExport = authority.workspaceTextAuthorityWithExport(
    checkpointOnly,
    'reading:stale-export',
    HEAD_OPENED,
    fileFingerprint('stale-export'),
  );
  assert.deepEqual(staleExport.durability.lineChanges, {
    kind: durability.WorkspaceBufferCausalLineChangeKinds.Unavailable,
    reason: durability.WorkspaceBufferCausalLineChangeUnavailableReasons.BasisUnavailable,
    basisHeadId: HEAD_OPENED,
    nextHeadId: HEAD_EDITED,
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
  assert.deepEqual(exported.durability.lineChanges, {
    kind: durability.WorkspaceBufferCausalLineChangeKinds.Available,
    source: durability.WorkspaceBufferCausalLineChangeSources.Identity,
    basisHeadId: HEAD_EDITED,
    nextHeadId: HEAD_EDITED,
    insertedLineCount: 0,
    deletedLineCount: 0,
    rewriteIds: [],
    diffIds: [],
    markers: [],
    observerVersion: 'jedit-causal-line-diff-identity-v1',
  });

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

test('buffer durability refuses causal line evidence for the wrong basis', async () => {
  const durability = await importDist('app', 'workspace', 'workspace-buffer-durability.js');
  const opened = durability.openedWorkspaceBufferDurability({
    basisHeadId: HEAD_OPENED,
    hostBasis: 'file',
    materialization: 'materialized',
  });
  const admitted = durability.workspaceBufferDurabilityWithAdmittedTransition(
    opened,
    {
      receiptId: 'receipt:edit',
      admittedTickId: 'tick:edit',
      nextHeadId: HEAD_EDITED,
    },
    durability.workspaceBufferCausalLineChangesFromReading({
      worldlineId: 'worldline:notes',
      basisHeadId: 'head:wrong',
      nextHeadId: HEAD_EDITED,
      insertedLineCount: 1,
      deletedLineCount: 0,
      rewriteIds: ['rewrite:wrong'],
      diffIds: ['diff:wrong'],
      markers: [],
      observerVersion: 'jedit-causal-line-diff-v2',
    }),
  );

  assert.deepEqual(admitted.lineChanges, {
    kind: durability.WorkspaceBufferCausalLineChangeKinds.Unavailable,
    reason: durability.WorkspaceBufferCausalLineChangeUnavailableReasons.EvidenceMismatch,
    basisHeadId: HEAD_OPENED,
    nextHeadId: HEAD_EDITED,
  });
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
