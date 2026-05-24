import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';

const REPO_ROOT = process.cwd();
const LOOKUP_MODULE_PATH = path.join(REPO_ROOT, 'dist', 'app', 'jedit-echo-retention-lookup.js');
const EVIDENCE_MODULE_PATH = path.join(REPO_ROOT, 'dist', 'app', 'jedit-retained-evidence.js');
const PACKAGE_ID = 'jedit.hot-text-runtime';
const MUTATION_OPERATION = 'replaceRangeAsTick';
const QUERY_OPERATION = 'textWindow';
const RECEIPT_ID = 'receipt:1';
const READING_ID = 'reading:1';
const PAYLOAD_BYTES_HEX = '68656c6c6f';

let modulesPromise;

test('retention lookup succeeds through Echo-shaped lookup port', async () => {
  const modules = await loadModules();
  const inventory = modules.evidence.createJeditRetainedEvidenceInventory({
    packageId: PACKAGE_ID,
    mutationOperationName: MUTATION_OPERATION,
    queryOperationName: QUERY_OPERATION,
    receiptId: RECEIPT_ID,
    readingId: READING_ID,
  });
  const payloadRef = inventory.refs.find((ref) => ref.role === modules.evidence.JEDIT_EVIDENCE_ROLE_READING_PAYLOAD);
  const lookup = modules.lookup.createInMemoryJeditEchoRetentionLookupPort([
    {
      byteHash: payloadRef.byteIdentity.byteHash,
      semanticCoordinate: payloadRef.semanticCoordinate,
      materialBytesHex: PAYLOAD_BYTES_HEX,
    },
  ]);

  const result = modules.lookup.lookupJeditRetainedEvidenceMaterial(lookup, payloadRef);

  assert.equal(result.status, modules.lookup.JEDIT_ECHO_RETENTION_LOOKUP_HIT);
  assert.equal(result.materialBytesHex, PAYLOAD_BYTES_HEX);
});

test('retention lookup loads local receipt envelope and payload materials', async () => {
  const modules = await loadModules();
  const inventory = modules.evidence.createJeditRetainedEvidenceInventory({
    packageId: PACKAGE_ID,
    mutationOperationName: MUTATION_OPERATION,
    queryOperationName: QUERY_OPERATION,
    receiptId: RECEIPT_ID,
    readingId: READING_ID,
  });
  const lookup = modules.lookup.createInMemoryJeditEchoRetentionLookupPort(
    modules.lookup.createJeditEchoRetainedMaterialRecords(inventory),
  );

  for (const ref of inventory.refs) {
    const result = modules.lookup.lookupJeditRetainedEvidenceMaterial(lookup, ref);
    assert.equal(result.status, modules.lookup.JEDIT_ECHO_RETENTION_LOOKUP_HIT);
    assert.equal(typeof result.materialBytesHex, 'string');
  }
});

test('semantic coordinate mismatch does not become a retained evidence hit', async () => {
  const modules = await loadModules();
  const inventory = modules.evidence.createJeditRetainedEvidenceInventory({
    packageId: PACKAGE_ID,
    mutationOperationName: MUTATION_OPERATION,
    queryOperationName: QUERY_OPERATION,
    receiptId: RECEIPT_ID,
    readingId: READING_ID,
  });
  const payloadRef = inventory.refs.find((ref) => ref.role === modules.evidence.JEDIT_EVIDENCE_ROLE_READING_PAYLOAD);
  const records = modules.lookup.createJeditEchoRetainedMaterialRecords(inventory);
  const rewrittenPayloadRef = {
    ...payloadRef,
    byteIdentity: {
      ...payloadRef.byteIdentity,
      byteHash: records[0].byteHash,
    },
  };
  const lookup = modules.lookup.createInMemoryJeditEchoRetentionLookupPort(records);
  const result = modules.lookup.lookupJeditRetainedEvidenceMaterial(lookup, rewrittenPayloadRef);

  assert.notEqual(rewrittenPayloadRef.semanticCoordinate.coordinate, inventory.refs[0].semanticCoordinate.coordinate);
  assert.equal(result.status, modules.lookup.JEDIT_ECHO_RETENTION_LOOKUP_MISSING);
});

test('byte identity without semantic coordinate is not retained evidence', async () => {
  const modules = await loadModules();
  const inventory = modules.evidence.createJeditRetainedEvidenceInventory({
    packageId: PACKAGE_ID,
    mutationOperationName: MUTATION_OPERATION,
    queryOperationName: QUERY_OPERATION,
    receiptId: RECEIPT_ID,
    readingId: READING_ID,
  });
  const payloadRef = inventory.refs.find((ref) => ref.role === modules.evidence.JEDIT_EVIDENCE_ROLE_READING_PAYLOAD);
  const lookup = modules.lookup.createInMemoryJeditEchoRetentionLookupPort([
    {
      byteHash: payloadRef.byteIdentity.byteHash,
      materialBytesHex: PAYLOAD_BYTES_HEX,
    },
  ]);
  const result = modules.lookup.lookupJeditRetainedEvidenceMaterial(lookup, payloadRef);

  assert.equal(result.status, modules.lookup.JEDIT_ECHO_RETENTION_LOOKUP_MISSING);
});

test('retention lookup supports same byte identity under multiple semantic coordinates', async () => {
  const modules = await loadModules();
  const inventory = modules.evidence.createJeditRetainedEvidenceInventory({
    packageId: PACKAGE_ID,
    mutationOperationName: MUTATION_OPERATION,
    queryOperationName: QUERY_OPERATION,
    receiptId: RECEIPT_ID,
    readingId: READING_ID,
  });
  const [firstRef, secondRef] = inventory.refs;
  const sharedByteHash = 'shared-byte-hash';
  const firstMaterial = '6669727374';
  const secondMaterial = '7365636f6e64';
  const lookup = modules.lookup.createInMemoryJeditEchoRetentionLookupPort([
    {
      byteHash: sharedByteHash,
      semanticCoordinate: firstRef.semanticCoordinate,
      materialBytesHex: firstMaterial,
    },
    {
      byteHash: sharedByteHash,
      semanticCoordinate: secondRef.semanticCoordinate,
      materialBytesHex: secondMaterial,
    },
  ]);
  const firstResult = modules.lookup.lookupJeditRetainedEvidenceMaterial(lookup, {
    ...firstRef,
    byteIdentity: {
      ...firstRef.byteIdentity,
      byteHash: sharedByteHash,
    },
  });
  const secondResult = modules.lookup.lookupJeditRetainedEvidenceMaterial(lookup, {
    ...secondRef,
    byteIdentity: {
      ...secondRef.byteIdentity,
      byteHash: sharedByteHash,
    },
  });

  assert.equal(firstResult.status, modules.lookup.JEDIT_ECHO_RETENTION_LOOKUP_HIT);
  assert.equal(firstResult.materialBytesHex, firstMaterial);
  assert.equal(secondResult.status, modules.lookup.JEDIT_ECHO_RETENTION_LOOKUP_HIT);
  assert.equal(secondResult.materialBytesHex, secondMaterial);
});

test('missing retained material returns typed obstruction', async () => {
  const modules = await loadModules();
  const inventory = modules.evidence.createJeditRetainedEvidenceInventory({
    packageId: PACKAGE_ID,
    mutationOperationName: MUTATION_OPERATION,
    queryOperationName: QUERY_OPERATION,
    receiptId: RECEIPT_ID,
    readingId: READING_ID,
  });
  const payloadRef = inventory.refs.find((ref) => ref.role === modules.evidence.JEDIT_EVIDENCE_ROLE_READING_PAYLOAD);
  const lookup = modules.lookup.createInMemoryJeditEchoRetentionLookupPort([]);
  const result = modules.lookup.lookupJeditRetainedEvidenceMaterial(lookup, payloadRef);

  assert.equal(result.status, modules.lookup.JEDIT_ECHO_RETENTION_LOOKUP_MISSING);
  assert.equal(result.obstruction.code, modules.evidence.JEDIT_RETENTION_OBSTRUCTION_MISSING_MATERIAL);
});

test('query identity is not treated as payload retention identity', async () => {
  const modules = await loadModules();
  const inventory = modules.evidence.createJeditRetainedEvidenceInventory({
    packageId: PACKAGE_ID,
    mutationOperationName: MUTATION_OPERATION,
    queryOperationName: QUERY_OPERATION,
    receiptId: RECEIPT_ID,
    readingId: READING_ID,
  });
  const payloadRef = inventory.refs.find((ref) => ref.role === modules.evidence.JEDIT_EVIDENCE_ROLE_READING_PAYLOAD);
  const lookup = modules.lookup.createInMemoryJeditEchoRetentionLookupPort([
    {
      byteHash: QUERY_OPERATION,
      semanticCoordinate: payloadRef.semanticCoordinate,
      materialBytesHex: PAYLOAD_BYTES_HEX,
    },
  ]);
  const result = modules.lookup.lookupJeditRetainedEvidenceMaterial(lookup, payloadRef);

  assert.notEqual(payloadRef.byteIdentity.byteHash, QUERY_OPERATION);
  assert.equal(result.status, modules.lookup.JEDIT_ECHO_RETENTION_LOOKUP_MISSING);
});

async function loadModules() {
  if (modulesPromise) {
    return modulesPromise;
  }

  modulesPromise = (async () => {
    const build = spawnSync('npm', ['run', '--silent', 'build'], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
    });

    assert.equal(build.status, 0, build.stderr || build.stdout);

    const [lookup, evidence] = await Promise.all([
      import(pathToFileURL(LOOKUP_MODULE_PATH).href),
      import(pathToFileURL(EVIDENCE_MODULE_PATH).href),
    ]);

    return {
      lookup,
      evidence,
    };
  })();

  return modulesPromise;
}
