import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';

const REPO_ROOT = process.cwd();
const RETAINED_MODULE_PATH = path.join(REPO_ROOT, 'dist', 'app', 'jedit-retained-evidence.js');

let retainedPromise;

test('retained reading payload byte identity is distinct from query identity', async () => {
  const retained = await loadRetained();
  const inventory = sampleInventory(retained);
  const payload = inventory.refs.find((ref) => ref.role === retained.JEDIT_EVIDENCE_ROLE_READING_PAYLOAD);
  assert.ok(payload, 'expected reading payload retained ref');

  assert.equal(payload.semanticCoordinate.operationName, 'textWindow');
  assert.equal(payload.semanticCoordinate.coordinate, 'payload:reading-1');
  assert.equal(payload.byteIdentity.byteHash, 'reading-payload:reading-1');
  assert.notEqual(payload.byteIdentity.byteHash, payload.semanticCoordinate.operationName);
});

test('missing retained material is a typed obstruction', async () => {
  const retained = await loadRetained();
  const inventory = sampleInventory(retained);
  const receipt = inventory.refs.find((ref) => ref.role === retained.JEDIT_EVIDENCE_ROLE_RECEIPT);
  assert.ok(receipt, 'expected receipt retained ref');

  assert.deepEqual(retained.missingJeditRetentionMaterial(receipt), {
    code: retained.JEDIT_RETENTION_OBSTRUCTION_MISSING_MATERIAL,
    role: retained.JEDIT_EVIDENCE_ROLE_RECEIPT,
    semanticCoordinate: receipt.semanticCoordinate,
  });
});

test('retained evidence refs include semantic coordinates for host inventory', async () => {
  const retained = await loadRetained();
  const inventory = sampleInventory(retained);

  assert.deepEqual(inventory.refs.map((ref) => ref.role), [
    retained.JEDIT_EVIDENCE_ROLE_PACKAGE,
    retained.JEDIT_EVIDENCE_ROLE_RECEIPT,
    retained.JEDIT_EVIDENCE_ROLE_READING_ENVELOPE,
    retained.JEDIT_EVIDENCE_ROLE_READING_PAYLOAD,
  ]);
  assert.equal(inventory.refs.every((ref) => ref.semanticCoordinate.packageId === 'jedit-package'), true);
});

test('host inventory can reuse adapter-projected missing reading evidence', async () => {
  const retained = await loadRetained();
  const readingEvidence = retained.createJeditReadingRetainedEvidenceInventory({
    packageId: 'jedit-package',
    queryOperationName: 'textWindow',
    readingId: 'reading-1',
  });
  const inventory = retained.createJeditRetainedEvidenceInventory({
    packageId: 'jedit-package',
    mutationOperationName: 'replaceRangeAsTick',
    queryOperationName: 'textWindow',
    receiptId: 'receipt-1',
    readingId: 'reading-1',
    readingEvidence,
  });
  const readingRefs = inventory.refs.filter((ref) => (
    ref.role === retained.JEDIT_EVIDENCE_ROLE_READING_ENVELOPE
      || ref.role === retained.JEDIT_EVIDENCE_ROLE_READING_PAYLOAD
  ));

  assert.deepEqual(readingRefs.map((ref) => ref.posture), [
    retained.JEDIT_RETAINED_EVIDENCE_MISSING,
    retained.JEDIT_RETAINED_EVIDENCE_MISSING,
  ]);
  assert.equal(readingRefs.every((ref) => 'byteIdentity' in ref), false);
});

function sampleInventory(retained) {
  return retained.createJeditRetainedEvidenceInventory({
    packageId: 'jedit-package',
    mutationOperationName: 'replaceRangeAsTick',
    queryOperationName: 'textWindow',
    receiptId: 'receipt-1',
    readingId: 'reading-1',
  });
}

async function loadRetained() {
  if (retainedPromise) {
    return retainedPromise;
  }

  retainedPromise = (async () => {
    const build = spawnSync('npm', ['run', '--silent', 'build'], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
    });

    assert.equal(build.status, 0, build.stderr || build.stdout);
    return import(pathToFileURL(RETAINED_MODULE_PATH).href);
  })();

  return retainedPromise;
}
