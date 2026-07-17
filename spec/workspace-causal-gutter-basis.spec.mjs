import assert from 'node:assert/strict';
import test from 'node:test';
import { fakeProductionTextSession, importDist } from './workspace-helpers.mjs';

test('causal gutter basis cycles only through save and import evidence', async () => {
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
  const imported = basis.nextWorkspaceCausalGutterBasis(
    { kind: 'last-save' },
    1,
  );

  assert.deepEqual(imported, { kind: 'import' });
  assert.deepEqual(
    basis.nextWorkspaceCausalGutterBasis(imported, 1),
    { kind: 'last-save' },
  );
  assert.deepEqual(
    basis.nextWorkspaceCausalGutterBasis({ kind: 'last-save' }, -1),
    { kind: 'import' },
  );
  assert.equal(basis.workspaceCausalGutterBasisHeadId({ kind: 'last-save' }, saved), 'head:saved');
  assert.equal(basis.workspaceCausalGutterBasisHeadId({ kind: 'import' }, saved), 'head:import');

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

test('causal gutter bases fail closed when durability evidence is unavailable', async () => {
  const basis = await importDist('app', 'workspace', 'workspace-causal-gutter-basis.js');
  const unavailable = {
    importBasisHeadId: undefined,
    file: { kind: 'unmaterialized' },
  };

  assert.equal(basis.workspaceCausalGutterBasisHeadId({ kind: 'last-save' }, unavailable), undefined);
  assert.equal(basis.workspaceCausalGutterBasisHeadId({ kind: 'import' }, unavailable), undefined);
});
