import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { REPO_ROOT } from './dist-helpers.mjs';

const ROOTS_ACCESS_PATTERN = new RegExp(
  [
    String.raw`\bstate\.roots\b`,
    String.raw`readonly roots: readonly BufferRoot`,
    String.raw`roots: z\.array\(BufferRootSchema\)`,
    String.raw`roots: \[currentRoot\]`,
  ].join('|'),
);

const RETAINED_ROOT_ACCESS_ALLOWLIST = new Map([
  [
    'src/ports/hot-text-runtime.ts',
    'type definition: HotTextBufferState declares the retained roots field',
  ],
  [
    'src/adapters/full-snapshot-hot-text-runtime-fixture.ts',
    'quarantined fixture: isProductionSafe=false, guarded by installed-text-authority-guard',
  ],
  [
    'src/app/jedit-contract-entity-facts.ts',
    'evidence emission: maps retained roots to root facts, never to current text',
  ],
  [
    'src/adapters/jedit-echo-optic-codec.ts',
    'transport schema: encodes/decodes the state shape without reading text from it',
  ],
]);

function sourceFiles(directory, prefix) {
  const entries = readdirSync(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const relative = `${prefix}/${entry.name}`;
    if (entry.isDirectory()) {
      files.push(...sourceFiles(path.join(directory, entry.name), relative));
    } else if (entry.name.endsWith('.ts')) {
      files.push(relative);
    }
  }
  return files;
}

test('retained full-root access stays quarantined to the allowlist', () => {
  const offenders = sourceFiles(path.join(REPO_ROOT, 'src'), 'src')
    .filter((file) => !file.startsWith('src/generated/'))
    .filter((file) => !RETAINED_ROOT_ACCESS_ALLOWLIST.has(file))
    .filter((file) => ROOTS_ACCESS_PATTERN.test(readFileSync(path.join(REPO_ROOT, file), 'utf8')));

  assert.deepEqual(
    offenders,
    [],
    `new retained full-root access outside the quarantine allowlist:\n${offenders.join('\n')}`,
  );
});

test('the quarantine allowlist names only living files with reasons', () => {
  for (const [file, reason] of RETAINED_ROOT_ACCESS_ALLOWLIST) {
    assert.equal(
      ROOTS_ACCESS_PATTERN.test(readFileSync(path.join(REPO_ROOT, file), 'utf8')),
      true,
      `${file} no longer accesses retained roots; remove it from the allowlist (${reason})`,
    );
  }
});

test('the quarantined fixture cannot pose as production text authority', async () => {
  const { importDist } = await import('./workspace-helpers.mjs');
  const fixture = await importDist('adapters', 'full-snapshot-hot-text-runtime-fixture.js');
  const runtime = fixture.createFullSnapshotHotTextRuntimeFixture();

  assert.equal(runtime.isProductionSafe, false);
  assert.equal(runtime.textAuthorityKind, fixture.FULL_SNAPSHOT_TEXT_AUTHORITY_KIND);
});
