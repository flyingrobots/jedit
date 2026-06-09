import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import { importDist, REPO_ROOT } from './dist-helpers.mjs';

const SNAPSHOT_PATH = path.join(REPO_ROOT, 'spec', 'fixtures', 'vim-power-grammar-snapshots.json');
const snapshots = JSON.parse(readFileSync(SNAPSHOT_PATH, 'utf8'));

test('Vim grammar tokenizer matches syntax snapshots', async () => {
  const grammar = await importDist('app', 'workspace', 'vim-grammar.js');

  for (const snapshot of snapshots) {
    assert.deepEqual(grammar.tokenizeVimKeys(snapshot.keys), snapshot.tokens, snapshot.name);
  }
});

test('Vim grammar token kind constants are stable for agent witnesses', async () => {
  const grammar = await importDist('app', 'workspace', 'vim-grammar.js');

  assert.equal(grammar.VimGrammarTokenKinds.Count, 'count');
  assert.equal(grammar.VimGrammarTokenKinds.Register, 'register');
  assert.equal(grammar.VimGrammarTokenKinds.Operator, 'operator');
  assert.equal(grammar.VimGrammarTokenKinds.Motion, 'motion');
  assert.equal(grammar.VimGrammarTokenKinds.TextObject, 'textObject');
  assert.equal(grammar.VimGrammarTokenKinds.CommandLineInvocation, 'commandLineInvocation');
  assert.equal(grammar.VimGrammarTokenKinds.MacroControl, 'macroControl');
});
