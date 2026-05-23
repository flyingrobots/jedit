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

  assert.equal(payload.semanticCoordinate.operationName, 'textWindow');
  assert.equal(payload.semanticCoordinate.coordinate, 'payload:reading-1');
  assert.equal(payload.byteIdentity.byteHash, 'reading-payload:reading-1');
  assert.notEqual(payload.byteIdentity.byteHash, payload.semanticCoordinate.operationName);
});

test('missing retained material is a typed obstruction', async () => {
  const retained = await loadRetained();
  const inventory = sampleInventory(retained);
  const receipt = inventory.refs.find((ref) => ref.role === retained.JEDIT_EVIDENCE_ROLE_RECEIPT);

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
