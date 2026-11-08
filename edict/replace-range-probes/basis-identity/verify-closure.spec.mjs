// SPDX-License-Identifier: Apache-2.0
// © James Ross Ω FLYING•ROBOTS <https://github.com/flyingrobots>
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';

const root = fileURLToPath(new URL('.', import.meta.url));
const checker = join(root, 'verify-closure.mjs');

function runCase(change, swapBeforeRead = false) {
  const scratch = mkdtempSync(join(tmpdir(), 'jedit-basis-closure-'));
  try {
    const application = join(scratch, 'application');
    const provenance = join(scratch, 'application-provenance.json');
    cpSync(join(root, 'application'), application, { recursive: true });
    cpSync(join(root, 'application-provenance.json'), provenance);
    change?.(application, provenance);
    const args = [];
    const marker = join(scratch, 'swapped');
    if (swapBeforeRead) {
      const victim = join(application, 'vendor/jedit-text/manifest.cbor');
      const target = join(scratch, 'matching-bytes');
      writeFileSync(target, readFileSync(victim));
      const loader = join(scratch, 'swap.mjs');
      // Synchronize a real filesystem swap immediately before the leaf read.
      writeFileSync(loader, `
        import fs from 'node:fs';
        import { syncBuiltinESMExports } from 'node:module';
        let swapped = false;
        const swap = path => {
          if (!swapped && path === ${JSON.stringify(victim)}) {
            swapped = true;
            fs.unlinkSync(path);
            fs.symlinkSync(${JSON.stringify(target)}, path);
            fs.writeFileSync(${JSON.stringify(marker)}, 'swapped');
          }
        };
        for (const method of ['openSync', 'readFileSync']) {
          const original = fs[method];
          fs[method] = function(path, ...args) {
            swap(path);
            return original.call(fs, path, ...args);
          };
        }
        syncBuiltinESMExports();
      `);
      args.push('--import', pathToFileURL(loader).href);
    }
    const result = spawnSync(process.execPath, [...args, checker, application, provenance, join(scratch, 'checksums')], { encoding: 'utf8' });
    return { swapped: existsSync(marker), status: result.status, report: JSON.parse(result.status === 0 ? result.stdout : result.stderr) };
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
  ['matching-byte symlink', app => {
    const victim = join(app, 'vendor/jedit-text/manifest.cbor');
    const target = join(app, '..', 'matching-bytes');
    writeFileSync(target, readFileSync(victim));
    unlinkSync(victim);
    symlinkSync(target, victim);
  }],
  ['provenance symlink', (app, provenance) => {
    const target = `${provenance}.original`;
    writeFileSync(target, readFileSync(provenance));
    unlinkSync(provenance);
    symlinkSync(target, provenance);
  }],
  ...['schema', 'sourceCommit'].map(field => [`invalid ${field}`, (app, provenance) => {
    const value = JSON.parse(readFileSync(provenance, 'utf8'));
    value[field] = 'invalid';
    writeFileSync(provenance, JSON.stringify(value));
  }]),
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
    if (name === 'escaping receipt path') assert.equal(result.report.detail, 'invalid recorded path or digest');
    if (name.startsWith('invalid ')) assert.equal(result.report.detail, 'invalid provenance envelope');
  });
}

test('a matching-byte symlink swapped after traversal refuses at the read boundary', () => {
  const result = runCase(undefined, true);
  assert.equal(result.swapped, true);
  assert.equal(result.status, 1);
  assert.equal(result.report.kind, 'InvalidFrozenClosure');
});
