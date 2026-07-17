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
      atMs: 3,
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
      atMs: 4,
    });
    assert.equal(recovered.kind, 'opened');
    assert.equal(recovered.textBasis.basisHeadId, edited.result.textBasis.basisHeadId);
  } finally {
    await host?.close();
    rmSync(walDirectory, { recursive: true, force: true });
  }
});
