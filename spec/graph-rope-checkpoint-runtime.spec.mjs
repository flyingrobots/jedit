import assert from 'node:assert/strict';
import test from 'node:test';
import { createTestEchoCausalAnchorAdmissionPort } from './support/test-echo-causal-anchor-admission.mjs';
import { UTF8_ENCODER, assertOk, byteRange, createHashPort, loadModules } from './support/graph-rope-runtime-test-kit.mjs';

const OBSTRUCTION_INVALID_FACT = 'invalid-fact';
const OBSTRUCTION_MISSING_CHECKPOINT = 'missing-checkpoint';
const OBSTRUCTION_CAUSAL_ANCHOR_UNAVAILABLE = 'causal-anchor-unavailable';
const OBSTRUCTION_CAUSAL_ANCHOR_ADMISSION_FAILED = 'causal-anchor-admission-failed';

test('graph runtime declares a checkpoint without requiring Echo admission', async () => {
  const { runtime, contract } = await loadModules();
  const graph = runtime.createGraphRopeRuntime({ hash: createHashPort() });
  const created = assertOk(graph.createBufferWorldline({
    worldlineId: 'worldline:checkpoint',
    initialText: 'alpha beta',
  }));
  const replaced = assertOk(graph.replaceRangeAsTick({
    basisHeadId: created.head.headId,
    range: byteRange(contract, 6, 10),
    replacementText: 'BETA',
  }));
  const before = assertOk(graph.debugRopeShape(replaced.nextHead.headId));

  const checkpointed = assertOk(graph.createCheckpoint({
    worldlineId: 'worldline:checkpoint',
    headId: replaced.nextHead.headId,
    reason: 'manual-save',
  }));
  const after = assertOk(graph.debugRopeShape(replaced.nextHead.headId));
  const reading = assertOk(graph.textWindow({
    basisHeadId: replaced.nextHead.headId,
    byteRange: byteRange(contract, 0, UTF8_ENCODER.encode('alpha BETA').length),
  }));

  assert.equal(checkpointed.head.headId, replaced.nextHead.headId);
  assert.equal(checkpointed.checkpoint.headId, replaced.nextHead.headId);
  assert.equal(checkpointed.checkpoint.reason, 'manual-save');
  assert.equal('causalAnchorId' in checkpointed.checkpoint, false);
  assert.equal('causalAnchor' in checkpointed, false);
  assert.equal('causalAnchorReceipt' in checkpointed, false);
  assert.equal('rewrite' in checkpointed, false);
  assert.equal('diff' in checkpointed, false);
  assert.equal('receipt' in checkpointed, false);
  assert.deepEqual(after, before);
  assert.equal(reading.text, 'alpha BETA');
});

test('graph runtime fails closed when checkpoint anchoring has no Echo adapter', async () => {
  const { runtime } = await loadModules();
  const graph = runtime.createGraphRopeRuntime({ hash: createHashPort() });
  const created = assertOk(graph.createBufferWorldline({
    worldlineId: 'worldline:checkpoint-no-echo',
    initialText: 'alpha',
  }));
  const checkpointed = assertOk(graph.createCheckpoint({
    worldlineId: 'worldline:checkpoint-no-echo',
    headId: created.head.headId,
    reason: 'manual-save',
  }));

  assert.deepEqual(graph.anchorCheckpoint({
    checkpointId: checkpointed.checkpoint.checkpointId,
  }), {
    ok: false,
    code: OBSTRUCTION_CAUSAL_ANCHOR_UNAVAILABLE,
  });
});

test('graph runtime associates explicitly injected opaque Echo evidence with a checkpoint', async () => {
  const { runtime } = await loadModules();
  const requests = [];
  const graph = runtime.createGraphRopeRuntime({
    hash: createHashPort(),
    causalAnchorAdmission: createTestEchoCausalAnchorAdmissionPort({ requests }),
  });
  const materializationRoot = {
    id: 'cas:checkpoint-flat-text',
    role: 'materialization',
  };
  const created = assertOk(graph.createBufferWorldline({
    worldlineId: 'worldline:checkpoint-materialization',
    initialText: 'alpha',
  }));
  const before = assertOk(graph.debugRopeShape(created.head.headId));

  const checkpointed = assertOk(graph.createCheckpoint({
    worldlineId: 'worldline:checkpoint-materialization',
    headId: created.head.headId,
    reason: 'export',
  }));
  const anchored = assertOk(graph.anchorCheckpoint({
    checkpointId: checkpointed.checkpoint.checkpointId,
    materializationRoots: [materializationRoot],
  }));
  const after = assertOk(graph.debugRopeShape(created.head.headId));

  assert.deepEqual(requests, [{
    checkpointId: checkpointed.checkpoint.checkpointId,
    worldlineId: 'worldline:checkpoint-materialization',
    headId: created.head.headId,
    reason: 'export',
    materializationRoots: [materializationRoot],
  }]);
  assert.deepEqual(anchored.echoEvidence, {
    anchorId: 'test-only-anchor:1',
    anchorFactId: 'test-only-anchor-fact:1',
    receiptId: 'test-only-anchor-receipt:1',
  });
  assert.equal(anchored.association.checkpointId, checkpointed.checkpoint.checkpointId);
  assert.equal(anchored.association.causalAnchorId, anchored.echoEvidence.anchorId);
  assert.equal(anchored.association.causalAnchorFactId, anchored.echoEvidence.anchorFactId);
  assert.equal(anchored.association.causalAnchorReceiptId, anchored.echoEvidence.receiptId);
  assert.equal('authority' in anchored.echoEvidence, false);
  assert.deepEqual(after, before);
});

test('graph runtime validates materialization roots before invoking Echo', async () => {
  const { runtime } = await loadModules();
  const requests = [];
  const graph = runtime.createGraphRopeRuntime({
    hash: createHashPort(),
    causalAnchorAdmission: createTestEchoCausalAnchorAdmissionPort({ requests }),
  });
  const created = assertOk(graph.createBufferWorldline({
    worldlineId: 'worldline:checkpoint-invalid-materialization',
    initialText: 'alpha',
  }));
  const checkpointed = assertOk(graph.createCheckpoint({
    worldlineId: 'worldline:checkpoint-invalid-materialization',
    headId: created.head.headId,
    reason: 'export',
  }));

  const invalidRootSets = [
    null,
    {},
    { map() { return null; } },
    [null],
    [{ id: '', role: 'materialization' }],
    [{ id: 'cas:authority', role: 'authority' }],
    [
      { id: 'cas:duplicate', role: 'materialization' },
      { id: 'cas:duplicate', role: 'materialization' },
    ],
  ];

  for (const materializationRoots of invalidRootSets) {
    assert.deepEqual(graph.anchorCheckpoint({
      checkpointId: checkpointed.checkpoint.checkpointId,
      materializationRoots,
    }), {
      ok: false,
      code: OBSTRUCTION_INVALID_FACT,
    });
  }
  assert.equal(requests.length, 0);
});

test('graph runtime snapshots materialization roots before validation and Echo invocation', async () => {
  const { runtime } = await loadModules();
  const requests = [];
  const reads = { id: 0, role: 0 };
  const materializationRoot = Object.defineProperties({}, {
    id: {
      get() {
        reads.id += 1;
        return 'cas:stable';
      },
    },
    role: {
      get() {
        reads.role += 1;
        return 'materialization';
      },
    },
  });
  const graph = runtime.createGraphRopeRuntime({
    hash: createHashPort(),
    causalAnchorAdmission: createTestEchoCausalAnchorAdmissionPort({ requests }),
  });
  const created = assertOk(graph.createBufferWorldline({
    worldlineId: 'worldline:checkpoint-request-snapshot',
    initialText: 'alpha',
  }));
  const checkpointed = assertOk(graph.createCheckpoint({
    worldlineId: 'worldline:checkpoint-request-snapshot',
    headId: created.head.headId,
    reason: 'export',
  }));

  assertOk(graph.anchorCheckpoint({
    checkpointId: checkpointed.checkpoint.checkpointId,
    materializationRoots: [materializationRoot],
  }));

  assert.deepEqual(reads, { id: 1, role: 1 });
  assert.deepEqual(requests[0].materializationRoots, [{
    id: 'cas:stable',
    role: 'materialization',
  }]);
});

test('graph runtime turns Echo adapter failures into typed obstructions', async () => {
  const { runtime } = await loadModules();
  const graph = runtime.createGraphRopeRuntime({
    hash: createHashPort(),
    causalAnchorAdmission: createTestEchoCausalAnchorAdmissionPort({
      admit() {
        return { ok: false, obstructionId: 'test-only-echo-offline' };
      },
    }),
  });
  const created = assertOk(graph.createBufferWorldline({
    worldlineId: 'worldline:checkpoint-echo-obstructed',
    initialText: 'alpha',
  }));
  const checkpointed = assertOk(graph.createCheckpoint({
    worldlineId: 'worldline:checkpoint-echo-obstructed',
    headId: created.head.headId,
    reason: 'manual-save',
  }));

  assert.deepEqual(graph.anchorCheckpoint({
    checkpointId: checkpointed.checkpoint.checkpointId,
  }), {
    ok: false,
    code: OBSTRUCTION_CAUSAL_ANCHOR_ADMISSION_FAILED,
  });
});

test('graph runtime fails closed on malformed Echo evidence', async () => {
  const { runtime } = await loadModules();
  const graph = runtime.createGraphRopeRuntime({
    hash: createHashPort(),
    causalAnchorAdmission: createTestEchoCausalAnchorAdmissionPort({
      admit() {
        return {
          ok: true,
          evidence: {
            anchorId: 'test-only-anchor:malformed',
            anchorFactId: '',
            receiptId: 'test-only-anchor-receipt:malformed',
          },
        };
      },
    }),
  });
  const created = assertOk(graph.createBufferWorldline({
    worldlineId: 'worldline:checkpoint-malformed-evidence',
    initialText: 'alpha',
  }));
  const checkpointed = assertOk(graph.createCheckpoint({
    worldlineId: 'worldline:checkpoint-malformed-evidence',
    headId: created.head.headId,
    reason: 'manual-save',
  }));

  assert.deepEqual(graph.anchorCheckpoint({
    checkpointId: checkpointed.checkpoint.checkpointId,
  }), {
    ok: false,
    code: OBSTRUCTION_CAUSAL_ANCHOR_ADMISSION_FAILED,
  });
});

test('graph runtime snapshots opaque Echo evidence before admitting its association', async () => {
  const { runtime } = await loadModules();
  const reads = { anchorId: 0, anchorFactId: 0, receiptId: 0 };
  const evidence = Object.defineProperties({}, {
    anchorId: {
      get() {
        reads.anchorId += 1;
        return 'test-only-anchor:stable';
      },
    },
    anchorFactId: {
      get() {
        reads.anchorFactId += 1;
        return 'test-only-anchor-fact:stable';
      },
    },
    receiptId: {
      get() {
        reads.receiptId += 1;
        return 'test-only-anchor-receipt:stable';
      },
    },
  });
  evidence.authority = 'echo';
  evidence.nonCloneable = () => 'adapter-owned';
  const graph = runtime.createGraphRopeRuntime({
    hash: createHashPort(),
    causalAnchorAdmission: createTestEchoCausalAnchorAdmissionPort({
      admit() {
        return { ok: true, evidence };
      },
    }),
  });
  const created = assertOk(graph.createBufferWorldline({
    worldlineId: 'worldline:checkpoint-evidence-snapshot',
    initialText: 'alpha',
  }));
  const checkpointed = assertOk(graph.createCheckpoint({
    worldlineId: 'worldline:checkpoint-evidence-snapshot',
    headId: created.head.headId,
    reason: 'manual-save',
  }));

  const anchored = assertOk(graph.anchorCheckpoint({
    checkpointId: checkpointed.checkpoint.checkpointId,
  }));

  assert.deepEqual(reads, { anchorId: 1, anchorFactId: 1, receiptId: 1 });
  assert.equal('authority' in anchored.echoEvidence, false);
  assert.equal('nonCloneable' in anchored.echoEvidence, false);
  assert.equal(anchored.association.causalAnchorId, anchored.echoEvidence.anchorId);
  assert.equal(anchored.association.causalAnchorFactId, anchored.echoEvidence.anchorFactId);
  assert.equal(anchored.association.causalAnchorReceiptId, anchored.echoEvidence.receiptId);
});

test('graph runtime requires a boolean success tag from the Echo adapter', async () => {
  const { runtime } = await loadModules();
  const graph = runtime.createGraphRopeRuntime({
    hash: createHashPort(),
    causalAnchorAdmission: createTestEchoCausalAnchorAdmissionPort({
      admit() {
        return {
          ok: 'false',
          evidence: {
            anchorId: 'test-only-anchor:invalid-tag',
            anchorFactId: 'test-only-anchor-fact:invalid-tag',
            receiptId: 'test-only-anchor-receipt:invalid-tag',
          },
        };
      },
    }),
  });
  const created = assertOk(graph.createBufferWorldline({
    worldlineId: 'worldline:checkpoint-invalid-success-tag',
    initialText: 'alpha',
  }));
  const checkpointed = assertOk(graph.createCheckpoint({
    worldlineId: 'worldline:checkpoint-invalid-success-tag',
    headId: created.head.headId,
    reason: 'manual-save',
  }));

  assert.deepEqual(graph.anchorCheckpoint({
    checkpointId: checkpointed.checkpoint.checkpointId,
  }), {
    ok: false,
    code: OBSTRUCTION_CAUSAL_ANCHOR_ADMISSION_FAILED,
  });
});

test('graph runtime fails closed when the Echo adapter throws', async () => {
  const { runtime } = await loadModules();
  const graph = runtime.createGraphRopeRuntime({
    hash: createHashPort(),
    causalAnchorAdmission: createTestEchoCausalAnchorAdmissionPort({
      admit() {
        throw new Error('test-only Echo adapter failure');
      },
    }),
  });
  const created = assertOk(graph.createBufferWorldline({
    worldlineId: 'worldline:checkpoint-echo-throws',
    initialText: 'alpha',
  }));
  const checkpointed = assertOk(graph.createCheckpoint({
    worldlineId: 'worldline:checkpoint-echo-throws',
    headId: created.head.headId,
    reason: 'manual-save',
  }));

  assert.deepEqual(graph.anchorCheckpoint({
    checkpointId: checkpointed.checkpoint.checkpointId,
  }), {
    ok: false,
    code: OBSTRUCTION_CAUSAL_ANCHOR_ADMISSION_FAILED,
  });
});

test('graph runtime treats repeated checkpoint declarations as idempotent', async () => {
  const { runtime } = await loadModules();
  const graph = runtime.createGraphRopeRuntime({ hash: createHashPort() });
  const created = assertOk(graph.createBufferWorldline({
    worldlineId: 'worldline:checkpoint-repeat',
    initialText: 'alpha beta',
  }));
  const before = assertOk(graph.debugRopeShape(created.head.headId));

  const first = assertOk(graph.createCheckpoint({
    worldlineId: 'worldline:checkpoint-repeat',
    headId: created.head.headId,
    reason: 'manual-save',
  }));
  const second = assertOk(graph.createCheckpoint({
    worldlineId: 'worldline:checkpoint-repeat',
    headId: created.head.headId,
    reason: 'manual-save',
  }));
  const after = assertOk(graph.debugRopeShape(created.head.headId));

  assert.equal(first.head.headId, created.head.headId);
  assert.equal(second.head.headId, created.head.headId);
  assert.equal(first.checkpoint.checkpointId, second.checkpoint.checkpointId);
  assert.equal('rewrite' in first, false);
  assert.equal('diff' in first, false);
  assert.equal('receipt' in first, false);
  assert.deepEqual(after, before);
});

test('checkpoint declarations do not perturb later text tick identity', async () => {
  const { runtime, contract } = await loadModules();
  const hash = createHashPort();
  const checkpointedGraph = runtime.createGraphRopeRuntime({ hash });
  const controlGraph = runtime.createGraphRopeRuntime({ hash });
  const checkpointedCreated = assertOk(checkpointedGraph.createBufferWorldline({
    worldlineId: 'worldline:checkpoint-text-sequence',
    initialText: 'alpha',
  }));
  const controlCreated = assertOk(controlGraph.createBufferWorldline({
    worldlineId: 'worldline:checkpoint-text-sequence',
    initialText: 'alpha',
  }));
  assertOk(checkpointedGraph.createCheckpoint({
    worldlineId: 'worldline:checkpoint-text-sequence',
    headId: checkpointedCreated.head.headId,
    reason: 'manual-save',
  }));

  const checkpointedEdit = assertOk(checkpointedGraph.replaceRangeAsTick({
    basisHeadId: checkpointedCreated.head.headId,
    range: byteRange(contract, 0, 1),
    replacementText: 'A',
  }));
  const controlEdit = assertOk(controlGraph.replaceRangeAsTick({
    basisHeadId: controlCreated.head.headId,
    range: byteRange(contract, 0, 1),
    replacementText: 'A',
  }));

  assert.deepEqual(checkpointedEdit.receipt, controlEdit.receipt);
  assert.deepEqual(checkpointedEdit.nextHead, controlEdit.nextHead);
});

test('graph runtime rejects anchoring an unknown checkpoint', async () => {
  const { runtime } = await loadModules();
  const graph = runtime.createGraphRopeRuntime({
    hash: createHashPort(),
    causalAnchorAdmission: createTestEchoCausalAnchorAdmissionPort(),
  });

  assert.deepEqual(graph.anchorCheckpoint({ checkpointId: 'rope-checkpoint:missing' }), {
    ok: false,
    code: OBSTRUCTION_MISSING_CHECKPOINT,
  });
});

test('graph runtime rejects checkpoints for a different worldline', async () => {
  const { runtime } = await loadModules();
  const graph = runtime.createGraphRopeRuntime({ hash: createHashPort() });
  const created = assertOk(graph.createBufferWorldline({
    worldlineId: 'worldline:checkpoint-mismatch',
    initialText: 'alpha',
  }));

  assert.deepEqual(graph.createCheckpoint({
    worldlineId: 'worldline:other',
    headId: created.head.headId,
    reason: 'manual-save',
  }), {
    ok: false,
    code: OBSTRUCTION_INVALID_FACT,
  });
});

test('graph runtime rejects invalid checkpoint reasons before deriving identity', async () => {
  const { runtime } = await loadModules();
  const graph = runtime.createGraphRopeRuntime({ hash: createHashPort() });
  const created = assertOk(graph.createBufferWorldline({
    worldlineId: 'worldline:checkpoint-reason',
    initialText: 'alpha',
  }));

  for (const reason of ['pretend-save', 1n]) {
    assert.deepEqual(graph.createCheckpoint({
      worldlineId: 'worldline:checkpoint-reason',
      headId: created.head.headId,
      reason,
    }), {
      ok: false,
      code: OBSTRUCTION_INVALID_FACT,
    });
  }
});
