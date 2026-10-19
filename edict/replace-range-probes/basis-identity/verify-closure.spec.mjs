// SPDX-License-Identifier: Apache-2.0
// © James Ross Ω FLYING•ROBOTS <https://github.com/flyingrobots>
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = fileURLToPath(new URL('.', import.meta.url));
const checker = join(root, 'verify-closure.mjs');

function runCase(change) {
  const scratch = mkdtempSync(join(tmpdir(), 'jedit-basis-closure-'));
  try {
    const application = join(scratch, 'application');
    const provenance = join(scratch, 'application-provenance.json');
    cpSync(join(root, 'application'), application, { recursive: true });
    cpSync(join(root, 'application-provenance.json'), provenance);
    change?.(application, provenance);
    const result = spawnSync(process.execPath, [checker, application, provenance, join(scratch, 'checksums')], { encoding: 'utf8' });
    return { status: result.status, report: JSON.parse(result.status === 0 ? result.stdout : result.stderr) };
  } finally {
    rmSync(scratch, { recursive: true });
  }
}

test('the retained closure passes before producing the checksum projection', () => {
  const result = runCase();
  assert.equal(result.status, 0);
  assert.equal(result.report.files, 12);
});

for (const [name, mutate] of [
  ['tampered file', app => writeFileSync(join(app, 'vendor/jedit-text/manifest.cbor'), Buffer.from([0]))],
  ['missing file', app => unlinkSync(join(app, 'vendor/jedit-text/manifest.cbor'))],
  ['unrecorded file', app => writeFileSync(join(app, 'unrecorded'), 'extra')],
  ['escaping receipt path', (app, provenance) => {
    const value = JSON.parse(readFileSync(provenance, 'utf8'));
    value.files['../outside'] = `sha256:${'0'.repeat(64)}`;
    writeFileSync(provenance, JSON.stringify(value));
  }],
]) {
  test(`${name} refuses before compilation`, () => {
    const result = runCase(mutate);
    assert.equal(result.status, 1);
    assert.equal(result.report.kind, 'InvalidFrozenClosure');
  });
}
