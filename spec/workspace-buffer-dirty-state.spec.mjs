import assert from 'node:assert/strict';
import test from 'node:test';
import { importDist } from './workspace-helpers.mjs';

const HEAD_SAVED = 'head:saved';
const HEAD_EDITED = 'head:edited';

test('file dirty state follows admitted head versus saved export basis', async () => {
  const [authority, durability, profile, worldline] = await Promise.all([
    importDist('app', 'workspace', 'workspace-text-authority.js'),
    importDist('app', 'workspace', 'workspace-buffer-durability.js'),
    importDist('app', 'text-runtime-profile.js'),
    importDist('app', 'workspace', 'worldline-types.js'),
  ]);
  const opened = openedAuthority(authority, profile, worldline, HEAD_SAVED);
  assert.equal(opened.dirty, false);
  assert.equal(durability.workspaceBufferFileDirty(opened.durability), false);

  const queued = authority.workspaceTextAuthorityWithPendingEdit(opened, 1);
  assert.equal(queued.dirty, false);
  assert.equal(durability.workspaceBufferFileDirty(queued.durability), false);

  const obstructed = authority.workspaceTextAuthorityWithObstruction(
    queued,
    1,
    { code: 'fixture:obstructed', message: 'not admitted', atMs: 1 },
  );
  assert.equal(obstructed.dirty, false);
  assert.equal(durability.workspaceBufferFileDirty(obstructed.durability), false);

  const admitted = authority.workspaceTextAuthorityWithReceipt(queued, 'receipt:edit', {
    causalTransition: {
      admittedTickId: 'tick:edit',
      nextHeadId: HEAD_EDITED,
    },
  });
  assert.equal(admitted.dirty, true);
  assert.equal(durability.workspaceBufferFileDirty(admitted.durability), true);

  const checkpointed = authority.workspaceTextAuthorityWithCheckpoint(
    admitted,
    'checkpoint:edited',
    HEAD_EDITED,
  );
  assert.equal(checkpointed.dirty, true);
  assert.equal(durability.workspaceBufferFileDirty(checkpointed.durability), true);

  const exported = authority.workspaceTextAuthorityWithExport(
    checkpointed,
    'reading:export',
    HEAD_EDITED,
    fileFingerprint(),
  );
  assert.equal(exported.dirty, false);
  assert.equal(durability.workspaceBufferFileDirty(exported.durability), false);
  assert.deepEqual(exported.durability.lastCheckpoint, {
    checkpointId: 'checkpoint:edited',
    basisHeadId: HEAD_EDITED,
  });
});

test('a missing-file basis becomes dirty only after an admitted edit', async () => {
  const [authority, durability, profile, worldline] = await Promise.all([
    importDist('app', 'workspace', 'workspace-text-authority.js'),
    importDist('app', 'workspace', 'workspace-buffer-durability.js'),
    importDist('app', 'text-runtime-profile.js'),
    importDist('app', 'workspace', 'worldline-types.js'),
  ]);
  const opened = authority.openedWorkspaceTextAuthority({
    profile: profile.TEXT_RUNTIME_PROFILE_ECHO_HOSTED,
    filePath: '/repo/new.txt',
    bufferId: 'buffer:new',
    readOnly: false,
    dirty: false,
    materialization: worldline.WorkspaceWorldlineMaterializationKinds.Unmaterialized,
    hostBasis: authority.WorkspaceTextHostBasisKinds.Missing,
    hostAbsenceBasisHeadId: HEAD_SAVED,
    cache: basisCache(HEAD_SAVED),
  });

  assert.equal(opened.dirty, false);
  assert.equal(durability.workspaceBufferFileDirty(opened.durability), false);
  assert.equal(opened.durability.localGit.kind, durability.WorkspaceBufferLocalGitDurabilityKinds.Unknown);
  assert.equal(opened.durability.remoteGit.kind, durability.WorkspaceBufferRemoteGitDurabilityKinds.Unknown);

  const admitted = authority.workspaceTextAuthorityWithReceipt(opened, 'receipt:new', {
    causalTransition: {
      admittedTickId: 'tick:new',
      nextHeadId: HEAD_EDITED,
    },
  });
  assert.equal(admitted.dirty, true);
  assert.equal(durability.workspaceBufferFileDirty(admitted.durability), true);
});

function openedAuthority(authority, profile, worldline, basisHeadId) {
  return authority.openedWorkspaceTextAuthority({
    profile: profile.TEXT_RUNTIME_PROFILE_ECHO_HOSTED,
    filePath: '/repo/notes.md',
    bufferId: 'buffer:notes',
    readOnly: false,
    dirty: true,
    materialization: worldline.WorkspaceWorldlineMaterializationKinds.Materialized,
    hostBasis: authority.WorkspaceTextHostBasisKinds.File,
    hostFingerprint: fileFingerprint(),
    cache: basisCache(basisHeadId),
  });
}

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

function fileFingerprint() {
  return {
    algorithm: 'sha256',
    digest: 'saved',
    byteLength: 0,
  };
}
