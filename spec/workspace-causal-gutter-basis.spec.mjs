import assert from 'node:assert/strict';
import test from 'node:test';
import { fakeProductionTextSession, importDist } from './workspace-helpers.mjs';

test('causal gutter basis cycles through durable and selected Echo evidence', async () => {
  const [basis, durability, refresh] = await Promise.all([
    importDist('app', 'workspace', 'workspace-causal-gutter-basis.js'),
    importDist('app', 'workspace', 'workspace-buffer-durability.js'),
    importDist('app', 'workspace', 'workspace-causal-line-change-refresh.js'),
  ]);
  const opened = durability.openedWorkspaceBufferDurability({
    basisHeadId: 'head:import',
    hostBasis: 'file',
    materialization: 'materialized',
  });
  const edited = durability.workspaceBufferDurabilityWithAdmittedTransition(
    opened,
    {
      receiptId: 'receipt:edit',
      admittedTickId: 'tick:edit',
      nextHeadId: 'head:saved',
    },
    durability.workspaceBufferCausalLineChangesFromReading({
      worldlineId: 'worldline:notes',
      basisHeadId: 'head:import',
      nextHeadId: 'head:saved',
      insertedLineCount: 1,
      deletedLineCount: 0,
      tickReceiptIds: ['tick:edit'],
      rewriteIds: ['rewrite:edit'],
      diffIds: ['diff:edit'],
      markers: [],
      deletions: [],
      observerVersion: 'test',
    }),
  );
  const saved = durability.workspaceBufferDurabilityWithExport(
    edited,
    'reading:save',
    'head:saved',
    { algorithm: 'sha256', digest: 'saved', byteLength: 1 },
  );
  const checkpointEntry = {
    sequence: 1,
    kind: 'checkpoint',
    status: 'checkpointed',
    evidenceId: 'checkpoint:selected',
    causalHeadId: 'head:checkpoint',
    summary: 'checkpoint',
  };
  const tickEntry = {
    sequence: 2,
    kind: 'edit',
    status: 'applied',
    evidenceId: 'receipt:selected',
    causalHeadId: 'head:tick',
    causalTickId: 'tick:selected',
    summary: 'tick',
  };

  const imported = basis.nextWorkspaceCausalGutterBasis(
    { kind: 'last-save' },
    1,
    [checkpointEntry],
    0,
  );
  const checkpoint = basis.nextWorkspaceCausalGutterBasis(
    imported,
    1,
    [checkpointEntry],
    0,
  );
  const tick = basis.nextWorkspaceCausalGutterBasis(
    checkpoint,
    1,
    [tickEntry],
    0,
  );

  assert.deepEqual(imported, { kind: 'import' });
  assert.deepEqual(checkpoint, {
    kind: 'selected-checkpoint',
    availability: 'available',
    evidenceId: 'checkpoint:selected',
    headId: 'head:checkpoint',
  });
  assert.deepEqual(tick, {
    kind: 'selected-tick',
    availability: 'available',
    evidenceId: 'receipt:selected',
    headId: 'head:tick',
    tickId: 'tick:selected',
  });
  assert.deepEqual(
    basis.nextWorkspaceCausalGutterBasis(tick, 1, [tickEntry], 0),
    { kind: 'last-save' },
  );
  assert.equal(basis.workspaceCausalGutterBasisHeadId({ kind: 'last-save' }, saved), 'head:saved');
  assert.equal(basis.workspaceCausalGutterBasisHeadId({ kind: 'import' }, saved), 'head:import');
  assert.equal(basis.workspaceCausalGutterBasisHeadId(checkpoint, saved), 'head:checkpoint');
  assert.equal(basis.workspaceCausalGutterBasisHeadId(tick, saved), 'head:tick');

  const [pendingAfterSave, commands] = refresh.ensureWorkspaceCausalLineChangeRefresh({
    causalGutterBasis: { kind: 'import' },
    textAuthority: {
      kind: 'opened',
      bufferId: 'buffer:notes',
      durability: saved,
    },
    time: 1,
  }, fakeProductionTextSession());
  assert.equal(pendingAfterSave.textAuthority.durability.lineChanges.reason, 'observation-pending');
  assert.equal(pendingAfterSave.textAuthority.durability.lineChanges.basisHeadId, 'head:import');
  assert.equal(pendingAfterSave.textAuthority.durability.lineChanges.nextHeadId, 'head:saved');
  assert.equal(commands.length, 1);
});

test('selected causal gutter bases fail closed when the selected history row lacks matching evidence', async () => {
  const basis = await importDist('app', 'workspace', 'workspace-causal-gutter-basis.js');
  const checkpoint = basis.nextWorkspaceCausalGutterBasis(
    { kind: 'import' },
    1,
    [{
      sequence: 1,
      kind: 'edit',
      status: 'applied',
      evidenceId: 'receipt:not-a-checkpoint',
      causalHeadId: 'head:edit',
      causalTickId: 'tick:edit',
      summary: 'edit',
    }],
    0,
  );

  assert.deepEqual(checkpoint, { kind: 'selected-checkpoint', availability: 'unavailable' });
  assert.equal(basis.workspaceCausalGutterBasisHeadId(checkpoint, {
    importBasisHeadId: 'head:import',
    file: { kind: 'saved', basisHeadId: 'head:saved' },
  }), undefined);

  const tick = basis.nextWorkspaceCausalGutterBasis(
    checkpoint,
    1,
    [{
      sequence: 2,
      kind: 'edit',
      status: 'applied',
      evidenceId: 'receipt:missing-tick',
      causalHeadId: 'head:edit',
      summary: 'edit without admitted tick evidence',
    }],
    0,
  );
  assert.deepEqual(tick, { kind: 'selected-tick', availability: 'unavailable' });
  assert.equal(basis.workspaceCausalGutterBasisHeadId({
    kind: 'selected-tick',
    availability: 'available',
    evidenceId: 'receipt:malformed',
    headId: 'head:malformed',
  }, {
    importBasisHeadId: 'head:import',
    file: { kind: 'saved', basisHeadId: 'head:saved' },
  }), undefined);
});
