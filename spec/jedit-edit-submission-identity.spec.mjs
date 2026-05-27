import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';

const REPO_ROOT = process.cwd();
const IDENTITY_MODULE_PATH = path.join(REPO_ROOT, 'dist', 'app', 'jedit-edit-submission-identity.js');
const HASH_MODULE_PATH = path.join(REPO_ROOT, 'dist', 'adapters', 'hash.js');

let modulesPromise;

test('stable edit submission identity is deterministic for retry of the same operation', async () => {
  const modules = await loadModules();
  const input = identityInput({
    clientOperationId: 'client-op:1',
    canonicalEnvelopeDigest: 'envelope:digest:1',
  });

  const first = modules.identity.createJeditEditSubmissionIdentity(input, modules.hash.createHashPort());
  const retry = modules.identity.createJeditEditSubmissionIdentity(input, modules.hash.createHashPort());

  assert.equal(retry.submissionId, first.submissionId);
  assert.equal(retry.idempotencyKeyDigest, first.idempotencyKeyDigest);
  assert.equal(retry.canonicalEnvelopeDigest, 'envelope:digest:1');
});

test('stable edit submission identity treats same envelope with new operation id as a new submission', async () => {
  const modules = await loadModules();
  const first = modules.identity.createJeditEditSubmissionIdentity(
    identityInput({
      clientOperationId: 'client-op:1',
      canonicalEnvelopeDigest: 'envelope:same',
    }),
    modules.hash.createHashPort(),
  );
  const second = modules.identity.createJeditEditSubmissionIdentity(
    identityInput({
      clientOperationId: 'client-op:2',
      canonicalEnvelopeDigest: 'envelope:same',
    }),
    modules.hash.createHashPort(),
  );

  assert.notEqual(second.submissionId, first.submissionId);
  assert.equal(second.canonicalEnvelopeDigest, first.canonicalEnvelopeDigest);
});

test('stable edit submission identity preserves same submission id for conflicting retry detection', async () => {
  const modules = await loadModules();
  const original = modules.identity.createJeditEditSubmissionIdentity(
    identityInput({
      clientOperationId: 'client-op:1',
      canonicalEnvelopeDigest: 'envelope:original',
    }),
    modules.hash.createHashPort(),
  );
  const conflictingRetry = modules.identity.createJeditEditSubmissionIdentity(
    identityInput({
      clientOperationId: 'client-op:1',
      canonicalEnvelopeDigest: 'envelope:changed',
    }),
    modules.hash.createHashPort(),
  );

  assert.equal(conflictingRetry.submissionId, original.submissionId);
  assert.notEqual(conflictingRetry.idempotencyKeyDigest, original.idempotencyKeyDigest);
  assert.notEqual(conflictingRetry.canonicalEnvelopeDigest, original.canonicalEnvelopeDigest);
});

test('stable edit submission identity does not collide on embedded separators', async () => {
  const modules = await loadModules();
  const first = modules.identity.createJeditEditSubmissionIdentity(
    identityInput({
      appInstanceId: 'jedit-app:a',
      sessionId: 'jedit-session:b\u001fc',
      clientOperationId: 'client-op:separator',
      canonicalEnvelopeDigest: 'envelope:separator',
    }),
    modules.hash.createHashPort(),
  );
  const second = modules.identity.createJeditEditSubmissionIdentity(
    identityInput({
      appInstanceId: 'jedit-app:a\u001fjedit-session:b',
      sessionId: 'c',
      clientOperationId: 'client-op:separator',
      canonicalEnvelopeDigest: 'envelope:separator',
    }),
    modules.hash.createHashPort(),
  );

  assert.notEqual(second.submissionId, first.submissionId);
});

function identityInput(overrides) {
  return {
    appInstanceId: 'jedit-app:test',
    sessionId: 'jedit-session:test',
    contractPackageId: 'jedit.contract:text',
    contractOperationName: 'replaceRange',
    causalBasisDigest: 'basis:digest:test',
    ...overrides,
  };
}

async function loadModules() {
  if (modulesPromise) {
    return modulesPromise;
  }

  modulesPromise = (async () => {
    const [identity, hash] = await Promise.all([
      import(pathToFileURL(IDENTITY_MODULE_PATH).href),
      import(pathToFileURL(HASH_MODULE_PATH).href),
    ]);

    return {
      identity,
      hash,
    };
  })();

  return modulesPromise;
}
