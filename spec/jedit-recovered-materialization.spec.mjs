import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';

const REPO_ROOT = process.cwd();
const MATERIALIZATION_MODULE_PATH = path.join(REPO_ROOT, 'dist', 'app', 'jedit-recovered-materialization.js');
const HASH_MODULE_PATH = path.join(REPO_ROOT, 'dist', 'adapters', 'hash.js');

let modulesPromise;

test('jedit materializes recovered text artifact from Echo reading payload', async () => {
  const modules = await loadModules();

  const result = modules.materialization.materializeJeditTextArtifactFromRecoveredBasis({
    recoveredReading: availableReading(),
    payload: echoPayload(modules, 'Recovered text'),
    hash: modules.hash.createHashPort(),
  });

  assert.equal(result.status, 'JEDIT_RECOVERED_MATERIALIZATION_READY');
  assert.equal(result.artifact.readingId, 'reading:materialize');
  assert.equal(result.artifact.basisDigest, 'basis:materialize');
  assert.equal(result.artifact.text, 'Recovered text');
  assert.match(result.artifact.textDigest, /^sha256:[a-f0-9]{64}$/u);
});

test('jedit blocks materialization when recovered reading evidence is unavailable', async () => {
  const modules = await loadModules();

  const result = modules.materialization.materializeJeditTextArtifactFromRecoveredBasis({
    recoveredReading: {
      status: 'JEDIT_RECOVERED_READING_INCOMPLETE',
      reason: 'missing_reading',
    },
    payload: echoPayload(modules, 'Recovered text'),
    hash: modules.hash.createHashPort(),
  });

  assert.equal(result.status, 'JEDIT_RECOVERED_MATERIALIZATION_BLOCKED');
  assert.equal(result.reason, 'recovered_reading_unavailable');
});

test('jedit blocks materialization from local buffer payload source', async () => {
  const modules = await loadModules();

  const result = modules.materialization.materializeJeditTextArtifactFromRecoveredBasis({
    recoveredReading: availableReading(),
    payload: {
      source: 'local_buffer',
      text: 'Local text',
      textDigest: 'sha256:local',
      readingId: 'reading:materialize',
      basisDigest: 'basis:materialize',
      readingBasisDigest: 'basis:materialize',
      semanticCoordinateDigest: 'coordinate:materialize',
    },
    hash: modules.hash.createHashPort(),
  });

  assert.equal(result.status, 'JEDIT_RECOVERED_MATERIALIZATION_BLOCKED');
  assert.equal(result.reason, 'recovered_payload_source_not_echo');
});

test('jedit blocks materialization when payload evidence does not match the recovered reading', async () => {
  const modules = await loadModules();
  const payload = echoPayload(modules, 'Recovered text');
  payload.readingId = 'reading:stale-local';

  const result = modules.materialization.materializeJeditTextArtifactFromRecoveredBasis({
    recoveredReading: availableReading(),
    payload,
    hash: modules.hash.createHashPort(),
  });

  assert.equal(result.status, 'JEDIT_RECOVERED_MATERIALIZATION_BLOCKED');
  assert.equal(result.reason, 'recovered_payload_evidence_mismatch');
});

test('jedit blocks materialization when payload text digest does not match text bytes', async () => {
  const modules = await loadModules();
  const payload = echoPayload(modules, 'Recovered text');
  payload.text = 'Locally swapped text';

  const result = modules.materialization.materializeJeditTextArtifactFromRecoveredBasis({
    recoveredReading: availableReading(),
    payload,
    hash: modules.hash.createHashPort(),
  });

  assert.equal(result.status, 'JEDIT_RECOVERED_MATERIALIZATION_BLOCKED');
  assert.equal(result.reason, 'recovered_payload_digest_mismatch');
});

function availableReading() {
  return {
    status: 'JEDIT_RECOVERED_READING_AVAILABLE',
    reading: {
      readingId: 'reading:materialize',
      basisDigest: 'basis:materialize',
      readingBasisDigest: 'basis:materialize',
      semanticCoordinateDigest: 'coordinate:materialize',
      readingSource: 'retained',
      readingAuthority: 'echo_committed_reading',
    },
  };
}

function echoPayload(modules, text) {
  return {
    source: 'echo_recovered_reading',
    text,
    textDigest: `sha256:${modules.hash.createHashPort().sha256Hex(text)}`,
    readingId: 'reading:materialize',
    basisDigest: 'basis:materialize',
    readingBasisDigest: 'basis:materialize',
    semanticCoordinateDigest: 'coordinate:materialize',
  };
}

async function loadModules() {
  if (modulesPromise) {
    return modulesPromise;
  }

  modulesPromise = (async () => {
    const [materialization, hash] = await Promise.all([
      import(pathToFileURL(MATERIALIZATION_MODULE_PATH).href),
      import(pathToFileURL(HASH_MODULE_PATH).href),
    ]);

    return {
      materialization,
      hash,
    };
  })();

  return modulesPromise;
}
