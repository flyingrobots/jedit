import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { importDist, REPO_ROOT } from './workspace-helpers.mjs';

test('workspace production text session invokes the Echo-owned generated operation corridor', async () => {
  const adapter = await importDist('adapters', 'workspace-production-text-session.js');
  const calls = [];
  const session = adapter.createWorkspaceProductionTextSession({
    async openBuffer(request) {
      calls.push({ kind: 'open', request });
      return {
        kind: 'opened',
        bufferId: 'buffer:echo',
        headId: 'head:initial',
        byteLength: 0,
      };
    },
    async replaceRange(request) {
      calls.push({ kind: 'replace', request });
      return {
        kind: 'applied',
        bufferId: request.bufferId,
        bufferKey: 'witness.txt',
        projectionPath: null,
        headId: 'head:next',
        byteLength: 1,
        lineCount: 1,
        bufferVersion: 1,
        receiptId: 'echo-receipt:1',
        admittedTickId: 'echo-tick:1',
      };
    },
    async observeWindow(request) {
      calls.push({ kind: 'observe', request });
      return {
        kind: 'observed',
        readingId: 'echo-reading:1',
        bufferId: request.bufferId,
        basisHeadId: request.basisHeadId,
        rootNodeId: 'node:root',
        byteLength: 1,
        lineCount: 1,
        startByte: 0,
        endByte: 1,
        text: 'a',
        support: [],
        resolvedWorldlineTick: 1,
        commitHash: 'echo-commit:1',
      };
    },
  });

  const outcome = await session.openBuffer({
    bufferKey: 'witness.txt',
    initialText: '',
    atMs: 7,
  });

  assert.deepEqual(outcome, {
    kind: 'opened',
    bufferId: 'buffer:echo',
    textBasis: {
      basisHeadId: 'head:initial',
      byteRange: {
        startByte: { kind: 'utf8-byte-offset', value: 0 },
        endByte: { kind: 'utf8-byte-offset', value: 0 },
      },
    },
  });
  assert.deepEqual(calls, [{
    kind: 'open',
    request: {
      bufferKey: 'witness.txt',
      initialText: '',
      projectionPath: null,
    },
  }]);
});

test('workspace production text session delegates checkpoint declaration without local authority', async () => {
  const adapter = await importDist('adapters', 'workspace-production-text-session.js');
  const calls = [];
  const testOnlyHost = {
    async openBuffer() {
      throw new Error('openBuffer should not be called');
    },
    async replaceRange() {
      throw new Error('replaceRange should not be called');
    },
    async declareCheckpoint(request) {
      calls.push(request);
      return {
        kind: 'checkpoint-declared',
        bufferId: request.bufferId,
        bufferKey: 'test-only.txt',
        projectionPath: null,
        headId: 'test-only-head:canonical',
        rootNodeId: 'test-only-root:canonical',
        byteLength: 12,
        lineCount: 1,
        bufferVersion: 4,
        checkpointId: 'test-only-checkpoint:opaque',
        basisHeadId: request.basisHeadId,
        basisByteLength: 5,
        reason: request.reason,
        receiptId: 'test-only-receipt:opaque',
        admittedTickId: 'test-only-tick:opaque',
      };
    },
    async observeWindow() {
      throw new Error('observeWindow should not be called');
    },
  };
  const session = adapter.createWorkspaceProductionTextSession(testOnlyHost);

  const outcome = await session.checkpointBuffer({
    bufferId: 'test-only-buffer:opaque',
    basisHeadId: 'test-only-head:retained',
    checkpointKind: 'MANUAL_SAVE',
    atMs: 9,
  });

  assert.deepEqual(calls, [{
    bufferId: 'test-only-buffer:opaque',
    basisHeadId: 'test-only-head:retained',
    reason: 'manual-save',
  }]);
  assert.deepEqual(outcome, {
    kind: 'checkpointed',
    result: {
      textBasis: {
        basisHeadId: 'test-only-head:retained',
        byteRange: {
          startByte: { kind: 'utf8-byte-offset', value: 0 },
          endByte: { kind: 'utf8-byte-offset', value: 5 },
        },
      },
      bufferVersion: 4,
      checkpointId: 'test-only-checkpoint:opaque',
      checkpointKind: 'MANUAL_SAVE',
      receiptId: 'test-only-receipt:opaque',
      admittedTickId: 'test-only-tick:opaque',
    },
  });
});

test('workspace production text session rejects invalid checkpoint kinds before Echo admission', async () => {
  const [adapter, checkpointEvidence] = await Promise.all([
    importDist('adapters', 'workspace-production-text-session.js'),
    importDist('ports', 'text-authority-evidence.js'),
  ]);
  let checkpointCalls = 0;
  const session = adapter.createWorkspaceProductionTextSession({
    async declareCheckpoint(request) {
      checkpointCalls += 1;
      return {
        kind: 'checkpoint-declared',
        reason: request.reason,
      };
    },
  });
  const invalidKinds = [checkpointEvidence.CheckpointKinds.Initial, 'NOT_A_CHECKPOINT_KIND'];

  for (const checkpointKind of invalidKinds) {
    await assert.rejects(
      session.checkpointBuffer({
        bufferId: 'test-only-buffer:opaque',
        basisHeadId: 'test-only-head:opaque',
        checkpointKind,
        atMs: 10,
      }),
      {
        name: 'TypeError',
        message: `Unsupported checkpoint kind: ${checkpointKind}`,
      },
    );
  }
  assert.equal(checkpointCalls, 0);
});

test('workspace production text session fails closed when checkpoint operation is unavailable', async () => {
  const adapter = await importDist('adapters', 'workspace-production-text-session.js');
  let fallbackCalls = 0;
  const testOnlyUnavailableHost = {
    async openBuffer() {
      fallbackCalls += 1;
      throw new Error('openBuffer fallback must not be called');
    },
    async replaceRange() {
      fallbackCalls += 1;
      throw new Error('replaceRange fallback must not be called');
    },
    async declareCheckpoint() {
      return {
        kind: 'obstructed',
        code: 'generated-operation-unavailable',
        message: 'test-only installed operation is unavailable',
      };
    },
    async observeWindow() {
      fallbackCalls += 1;
      throw new Error('observeWindow fallback must not be called');
    },
  };
  const session = adapter.createWorkspaceProductionTextSession(testOnlyUnavailableHost);

  const outcome = await session.checkpointBuffer({
    bufferId: 'test-only-buffer:opaque',
    basisHeadId: 'test-only-head:opaque',
    checkpointKind: 'MANUAL_SAVE',
    atMs: 11,
  });

  assert.equal(outcome.kind, 'obstructed');
  assert.equal(outcome.obstruction.code, 'text-buffer-checkpoint-obstructed');
  assert.match(outcome.obstruction.issue.message, /installed operation is unavailable/u);
  assert.equal(fallbackCalls, 0);
});

test('workspace production text session bounds Echo observations to the requested aperture', async () => {
  const adapter = await importDist('adapters', 'workspace-production-text-session.js');
  const calls = [];
  const session = adapter.createWorkspaceProductionTextSession({
    async openBuffer() {
      throw new Error('openBuffer should not be called');
    },
    async replaceRange() {
      throw new Error('replaceRange should not be called');
    },
    async observeWindow(request) {
      calls.push(request);
      return {
        kind: 'observed',
        worldlineId: 'worldline:bounded',
        readingId: 'reading:bounded',
        observerPlanId: 'observer:bounded',
        packageArtifactHash: 'package:bounded',
        bufferId: request.bufferId,
        basisHeadId: request.basisHeadId,
        rootNodeId: 'node:bounded',
        byteLength: 2_000_000,
        lineCount: 1,
        startByte: request.startByte,
        endByte: request.endByte,
        text: 'x'.repeat(request.endByte - request.startByte),
        lines: [{
          lineNumber: 0,
          startByte: request.startByte,
          endByte: request.endByte,
          text: 'x'.repeat(request.endByte - request.startByte),
        }],
        support: [],
        resolvedWorldlineTick: 1,
        commitHash: 'commit:bounded',
      };
    },
  });

  const observed = await session.observeWindow({
    bufferId: 'buffer:bounded',
    basisHeadId: 'head:bounded',
    byteRange: {
      startByte: { kind: 'utf8-byte-offset', value: 0 },
      endByte: { kind: 'utf8-byte-offset', value: 2_000_000 },
    },
    aperture: {
      cursorLine: 0,
      viewportLineCount: 24,
      beforeLines: 0,
      afterLines: 0,
      maxBytes: 1024,
    },
    atMs: 1,
  });

  assert.equal(observed.kind, 'observed');
  assert.equal(observed.observed.value.truncated, true);
  assert.deepEqual(calls, [{
    bufferId: 'buffer:bounded',
    basisHeadId: 'head:bounded',
    startByte: 0,
    endByte: 1024,
    maxBytes: 1024,
  }]);
});

test('the production process adapter executes generated operations in Echo and recovers them', async () => {
  const processAdapter = await importDist('adapters', 'echo-text-contract-host-process.js');
  const sessionAdapter = await importDist('adapters', 'workspace-production-text-session.js');
  const walDirectory = mkdtempSync(path.join(tmpdir(), 'jedit-echo-host-'));
  let host;
  try {
    host = processAdapter.createEchoTextContractHostProcess({ cwd: REPO_ROOT, walDirectory });
    const session = sessionAdapter.createWorkspaceProductionTextSession(host);
    const opened = await session.openBuffer({
      bufferKey: 'real-echo.txt',
      initialText: 'hello',
      projectionPath: '/tmp/real-echo.txt',
      atMs: 1,
    });
    assert.equal(opened.kind, 'opened');
    const edited = await session.insertText({
      bufferId: opened.bufferId,
      startByte: { kind: 'utf8-byte-offset', value: 5 },
      insertText: ' world',
      atMs: 2,
    });
    assert.equal(edited.kind, 'applied');
    assert.match(edited.result.receiptId, /^[0-9a-f]{64}$/u);
    const checkpointed = await session.checkpointBuffer({
      bufferId: opened.bufferId,
      basisHeadId: edited.result.textBasis.basisHeadId,
      checkpointKind: 'MANUAL_SAVE',
      atMs: 3,
    });
    assert.equal(checkpointed.kind, 'checkpointed');
    assert.equal(
      checkpointed.result.textBasis.basisHeadId,
      edited.result.textBasis.basisHeadId,
    );
    assert.equal(
      checkpointed.result.textBasis.byteRange.endByte.value,
      edited.result.textBasis.byteRange.endByte.value,
    );
    assert.ok(checkpointed.result.checkpointId.length > 0);
    assert.ok(checkpointed.result.receiptId.length > 0);
    assert.ok(checkpointed.result.admittedTickId.length > 0);
    const observed = await session.observeWindow({
      bufferId: opened.bufferId,
      basisHeadId: edited.result.textBasis.basisHeadId,
      byteRange: edited.result.textBasis.byteRange,
      aperture: {
        cursorLine: 0,
        viewportLineCount: 24,
        beforeLines: 0,
        afterLines: 0,
        maxBytes: 1024,
      },
      atMs: 4,
    });
    assert.equal(observed.kind, 'observed');
    assert.equal(observed.observed.value.projection.text, 'hello world');
    assert.match(observed.observed.value.readingId, /^[0-9a-f]{64}$/u);
    await host.close();

    host = processAdapter.createEchoTextContractHostProcess({ cwd: REPO_ROOT, walDirectory });
    const recoveredSession = sessionAdapter.createWorkspaceProductionTextSession(host);
    const recovered = await recoveredSession.openBuffer({
      bufferKey: 'real-echo.txt',
      initialText: 'must not replace recovered authority',
      projectionPath: '/tmp/real-echo.txt',
      atMs: 5,
    });
    assert.equal(recovered.kind, 'opened');
    assert.equal(recovered.textBasis.basisHeadId, edited.result.textBasis.basisHeadId);
    const recoveredCheckpoint = await recoveredSession.checkpointBuffer({
      bufferId: recovered.bufferId,
      basisHeadId: recovered.textBasis.basisHeadId,
      checkpointKind: 'MANUAL_SAVE',
      atMs: 6,
    });
    assert.equal(recoveredCheckpoint.kind, 'checkpointed');
    assert.equal(recoveredCheckpoint.result.checkpointId, checkpointed.result.checkpointId);
  } finally {
    await host?.close();
    rmSync(walDirectory, { recursive: true, force: true });
  }
});
