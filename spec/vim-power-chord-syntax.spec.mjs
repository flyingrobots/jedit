import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import { importDist, REPO_ROOT } from './dist-helpers.mjs';

const SNAPSHOT_PATH = path.join(REPO_ROOT, 'spec', 'fixtures', 'vim-power-chord-syntax-snapshots.json');
const snapshots = JSON.parse(readFileSync(SNAPSHOT_PATH, 'utf8'));

test('Vim chord syntax parser matches complete, pending, and invalid snapshots', async () => {
  const syntax = await importDist('app', 'workspace', 'vim-chord-syntax.js');

  for (const snapshot of snapshots) {
    assert.deepEqual(syntax.parseVimChordSyntax(snapshot.keys), snapshot.syntax, snapshot.name);
  }
});

test('Vim chord syntax parser accepts token streams behind the raw key boundary', async () => {
  const syntax = await importDist('app', 'workspace', 'vim-chord-syntax.js');

  for (const snapshot of snapshots) {
    assert.deepEqual(syntax.parseVimChordTokens(snapshot.syntax.tokens), snapshot.syntax, snapshot.name);
  }
});

test('Vim chord syntax constants are stable for agent witnesses', async () => {
  const syntax = await importDist('app', 'workspace', 'vim-chord-syntax.js');

  assert.equal(syntax.VimChordSyntaxKinds.Complete, 'complete');
  assert.equal(syntax.VimChordSyntaxKinds.Pending, 'pending');
  assert.equal(syntax.VimChordSyntaxKinds.Invalid, 'invalid');
  assert.equal(syntax.VimChordSyntaxFamilies.OperatorTextObject, 'operatorTextObject');
  assert.equal(syntax.VimChordSyntaxFamilies.CommandLine, 'commandLine');
  assert.equal(syntax.VimChordSyntaxFamilies.Put, 'put');
  assert.equal(syntax.VimChordObstructions.UnknownToken, 'unknownToken');
  assert.equal(syntax.VimChordObstructions.TrailingTokens, 'trailingTokens');
});
