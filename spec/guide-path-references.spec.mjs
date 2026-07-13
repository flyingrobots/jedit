import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { REPO_ROOT } from './dist-helpers.mjs';

const GUIDE_PATHS = [
  'README.md',
  'GUIDE.md',
  'ADVANCED_GUIDE.md',
  'ARCHITECTURE.md',
  'docs/BEARING.md',
];

const PATH_TOKEN_PATTERN = /(?:src|scripts)\/[A-Za-z0-9._/-]+/g;
const TRAILING_PUNCTUATION_PATTERN = /[.,:;)\]}'"`]+$/;

const DOCUMENTED_FUTURE_PATH_ALLOWLIST = new Set([]);

function referencedPaths(markdown) {
  const references = new Map();
  const lines = markdown.split('\n');

  lines.forEach((lineText, lineIndex) => {
    for (const match of lineText.matchAll(PATH_TOKEN_PATTERN)) {
      const token = match[0].replace(TRAILING_PUNCTUATION_PATTERN, '');
      if (token.includes('*')) {
        continue;
      }
      if (!references.has(token)) {
        references.set(token, lineIndex + 1);
      }
    }
  });

  return references;
}

function unresolvedReferences(guidePath) {
  const markdown = readFileSync(path.join(REPO_ROOT, guidePath), 'utf8');
  const unresolved = [];

  for (const [token, lineNumber] of referencedPaths(markdown)) {
    if (DOCUMENTED_FUTURE_PATH_ALLOWLIST.has(token)) {
      continue;
    }
    if (!existsSync(path.join(REPO_ROOT, token))) {
      unresolved.push(`${guidePath}:${lineNumber} -> ${token}`);
    }
  }

  return unresolved;
}

for (const guidePath of GUIDE_PATHS) {
  test(`every src/ and scripts/ path referenced by ${guidePath} exists`, () => {
    const unresolved = unresolvedReferences(guidePath);

    assert.deepEqual(
      unresolved,
      [],
      `dead path references:\n${unresolved.join('\n')}`,
    );
  });
}

test('the guide path witness sees through fenced code and plain prose', () => {
  const references = referencedPaths(
    [
      'Prose mentions src/main.ts inline.',
      '```text',
      '-> src/adapters/in-memory-example.ts',
      '```',
      'A [link](src/domain/errors.ts) and `scripts/quality-gate.mjs`.',
    ].join('\n'),
  );

  assert.deepEqual(
    [...references.keys()].sort(),
    [
      'scripts/quality-gate.mjs',
      'src/adapters/in-memory-example.ts',
      'src/domain/errors.ts',
      'src/main.ts',
    ],
  );
});
