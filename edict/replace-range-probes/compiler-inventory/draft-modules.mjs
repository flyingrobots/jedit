// SPDX-License-Identifier: Apache-2.0 OR LicenseRef-MIND-UCAL-1.0
// © James Ross Ω FLYING•ROBOTS <https://github.com/flyingrobots>
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { encode } from 'cbor-x';

const dependencies = new Map([
  ['Text', []], ['Rope', ['Text']], ['Reference', ['Text']],
  ['ReplaceRange', ['Text', 'Rope']],
]);
const coordinates = new Map([
  ['Text', 'jedit.text.v2@1'], ['Rope', 'jedit.text.rope@1'],
]);

export function sourceDigest(source) {
  const bytes = encode(['edict.digest/v1', 'edict.source/v1', Buffer.from(source)]);
  return `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
}

export function pinnedDrafts(root) {
  const sources = new Map();
  for (const [name, imports] of dependencies) {
    let source = readFileSync(path.join(root, `${name}.edict`), 'utf8');
    for (const dependency of imports) {
      const coordinate = coordinates.get(dependency);
      const digest = sourceDigest(sources.get(dependency));
      const lines = source.split('\n');
      const matching = lines.filter(line => line.startsWith(`use module ${coordinate} `));
      if (matching.length !== 1) throw new Error(`Expected one ${coordinate} import in ${name}`);
      source = lines.map(line => line.startsWith(`use module ${coordinate} `)
        ? line.replace(/(?: digest "sha256:[a-f0-9]{64}")? as /, ` digest "${digest}" as `)
          .replace(/\s*\/\/ PROPOSED: source-module import$/, '')
        : line).join('\n');
    }
    sources.set(name, source);
  }
  return sources;
}

export function draftSourcePaths(name) {
  if (!dependencies.has(name)) throw new Error(`Unknown draft ${name}`);
  const names = new Set([name]);
  function include(current) {
    for (const dependency of dependencies.get(current)) {
      names.add(dependency);
      include(dependency);
    }
  }
  include(name);
  return [...names].map(item => `draft/${item}.edict`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const mode = process.argv[2];
  if (!['--check', '--write'].includes(mode)) throw new Error('usage: draft-modules.mjs --check|--write');
  const root = fileURLToPath(new URL('../../replace-range/draft/', import.meta.url));
  for (const [name, source] of pinnedDrafts(root)) {
    const file = path.join(root, `${name}.edict`);
    if (mode === '--write') writeFileSync(file, source);
    else if (readFileSync(file, 'utf8') !== source) throw new Error(`Stale source-module pin in ${name}`);
  }
}
