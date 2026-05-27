import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';

const REPO_ROOT = process.cwd();
const TRIPWIRE_MODULE_PATH = path.join(REPO_ROOT, 'dist', 'app', 'jedit-local-fallback-tripwire.js');

let modulePromise;

test('release-gate tripwire starts clear when no local fallback is attempted', async () => {
  const module = await loadModule();
  const tripwire = module.createJeditLocalFallbackTripwire({
    mode: 'enforced',
  });

  const snapshot = tripwire.snapshot();

  assert.equal(snapshot.status, 'clear');
  assert.deepEqual(snapshot.attempts, []);
  assert.equal(module.legacyFallbackStatusFromTripwire(snapshot), 'not_detected');
});

test('release-gate tripwire reports detected fallback after a local fallback attempt', async () => {
  const module = await loadModule();
  const tripwire = module.createJeditLocalFallbackTripwire({
    mode: 'enforced',
  });

  const snapshot = tripwire.recordLocalFallbackAttempt({
    code: 'legacy_buffer_read',
    message: 'Production recovery attempted to read a local buffer.',
  });

  assert.equal(snapshot.status, 'tripped');
  assert.equal(snapshot.attempts[0].code, 'legacy_buffer_read');
  assert.equal(module.legacyFallbackStatusFromTripwire(snapshot), 'detected');
});

test('disabled tripwire records attempts and preserves detected fallback evidence', async () => {
  const module = await loadModule();
  const tripwire = module.createJeditLocalFallbackTripwire({
    mode: 'disabled',
  });

  const snapshot = tripwire.recordLocalFallbackAttempt({
    code: 'fixture_fallback',
    message: 'Fixture mode touched local state.',
  });

  assert.equal(snapshot.status, 'ignored');
  assert.equal(snapshot.attempts.length, 1);
  assert.equal(module.legacyFallbackStatusFromTripwire(snapshot), 'detected');
});

async function loadModule() {
  if (modulePromise) {
    return modulePromise;
  }
  modulePromise = (async () => {    return import(pathToFileURL(TRIPWIRE_MODULE_PATH).href);
  })();
  return modulePromise;
}
