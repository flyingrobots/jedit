import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { REPO_ROOT } from './dist-helpers.mjs';
import { importDist } from './workspace-helpers.mjs';

const STATE_ROOTS_ACCESS_PATTERN = /\bstate(?:\.roots\b|\s*\[\s*['"`]roots['"`]\s*\])/;
const ROOTS_BINDING_PATTERN = /\.roots\b|\[\s*['"`]roots['"`]\s*\]|\broots\s*[,}:=]/;
const RETAINED_ROOT_CONTEXT_PATTERN = /HotTextBufferState|BufferRoot|hot-text-runtime/;

export function accessesRetainedRoots(sourceText) {
  if (STATE_ROOTS_ACCESS_PATTERN.test(sourceText)) {
    return true;
  }
  return RETAINED_ROOT_CONTEXT_PATTERN.test(sourceText)
    && ROOTS_BINDING_PATTERN.test(sourceText);
}

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
    .filter((file) => accessesRetainedRoots(readFileSync(path.join(REPO_ROOT, file), 'utf8')));

  assert.deepEqual(
    offenders,
    [],
    `new retained full-root access outside the quarantine allowlist:\n${offenders.join('\n')}`,
  );
});

test('the quarantine allowlist names only living files with reasons', () => {
  for (const [file, reason] of RETAINED_ROOT_ACCESS_ALLOWLIST) {
    assert.equal(
      accessesRetainedRoots(readFileSync(path.join(REPO_ROOT, file), 'utf8')),
      true,
      `${file} no longer accesses retained roots; remove it from the allowlist (${reason})`,
    );
  }
});

test('the guard catches retained-root access regardless of binding shape', () => {
  const evasions = [
    'const { roots } = bufferState; // HotTextBufferState destructure',
    'snapshot.roots.map((root) => root.text) // BufferRoot snapshot walk',
    "state['roots'].map((root) => root.text)",
    'state["roots"].map((root) => root.text)',
    'state[`roots`].map((root) => root.text)',
    "snapshot [ 'roots' ].map((root) => root.text) // BufferRoot snapshot walk",
    'import type { HotTextBufferState } from "x"; const kept = history.roots;',
  ];
  for (const evasion of evasions) {
    assert.equal(accessesRetainedRoots(evasion), true, evasion);
  }
  assert.equal(
    accessesRetainedRoots('const roots = quadraticRoots(a, b, c); // ray math'),
    false,
  );
  assert.equal(
    accessesRetainedRoots('canonicalRootSet(roots: readonly EchoCausalAnchorRoot[])'),
    false,
  );
});

test('the quarantined fixture cannot pose as production text authority', async () => {
  const fixture = await importDist('adapters', 'full-snapshot-hot-text-runtime-fixture.js');
  const runtime = fixture.createFullSnapshotHotTextRuntimeFixture();

  assert.equal(runtime.isProductionSafe, false);
  assert.equal(runtime.textAuthorityKind, fixture.FULL_SNAPSHOT_TEXT_AUTHORITY_KIND);
});
