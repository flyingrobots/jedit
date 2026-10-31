// SPDX-License-Identifier: Apache-2.0 OR LicenseRef-MIND-UCAL-1.0
// © James Ross Ω FLYING•ROBOTS <https://github.com/flyingrobots>
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { draftSourcePaths, pinnedDrafts, sourceDigest } from './draft-modules.mjs';

test('module digest agrees with the compiler independent canonical-CBOR vector', () => {
  const source = 'package library.bytes@1;\nfn marker() -> Bytes<max=1> { return b"A"; }\n';
  assert.equal(sourceDigest(source),
    'sha256:b69a636a99599fbc566e827918a6c34208cde8c8a62c47c2343dbc64b9eb7f82');
});

test('a leaf edit repins every dependent module, including the transitive rope import', () => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'jim-draft-pins-'));
  try {
    writeFileSync(path.join(root, 'Boundary.edict'), 'package jedit.text.boundary@1;\n');
    writeFileSync(path.join(root, 'Text.edict'),
      'package jedit.text.v2@1;\nuse module jedit.text.boundary@1 as boundary;\n');
    writeFileSync(path.join(root, 'Rope.edict'), 'package jedit.text.rope@1;\nuse module jedit.text.v2@1 as v2;\n');
    for (const name of ['Reference', 'ReplaceRange']) {
      const rope = name === 'ReplaceRange' ? 'use module jedit.text.rope@1 as rope;\n' : '';
      writeFileSync(path.join(root, `${name}.edict`), `use module jedit.text.v2@1 as v2;\n${rope}`);
    }
    const before = pinnedDrafts(root);
    for (const [name, source] of before) writeFileSync(path.join(root, `${name}.edict`), source);
    assert.deepEqual(pinnedDrafts(root), before);
    writeFileSync(path.join(root, 'Boundary.edict'), 'package jedit.text.boundary@1;\n// new source bytes\n');
    const after = pinnedDrafts(root);
    for (const name of ['Text', 'Rope', 'Reference', 'ReplaceRange']) {
      assert.notEqual(after.get(name), before.get(name));
    }
    const ropePin = sourceDigest(after.get('Rope'));
    assert.ok(after.get('ReplaceRange').includes(`digest "${ropePin}" as rope;`));
    assert.deepEqual(draftSourcePaths('ReplaceRange'),
      ['draft/ReplaceRange.edict', 'draft/Text.edict', 'draft/Boundary.edict', 'draft/Rope.edict']);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
