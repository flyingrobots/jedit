// The authored persistent-rope source modules, in dependency order, and the
// digest pins that bind each `use module` import to its dependency's bytes.
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { encode } from 'cbor-x';

const SOURCE_DIGEST_DOMAIN = ['edict.digest/v1', 'edict.source/v1'];
const IMPORT_PATTERN = /^use module (\S+) digest "sha256:[0-9a-f]{64}" as /;

export const ropeSourceRoot = path.join(
  path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'rope',
);

/** Each module file, its package coordinate and the coordinates it imports. */
export const ropeModules = Object.freeze([
  Object.freeze({ file: 'Octets.edict', coordinate: 'jedit.text.octets@1' }),
  Object.freeze({ file: 'Codec.edict', coordinate: 'jedit.text.codec@1' }),
  Object.freeze({ file: 'Identity.edict', coordinate: 'jedit.text.identity@1' }),
  Object.freeze({ file: 'Rope.edict', coordinate: 'jedit.text.rope@1' }),
]);

export function sourceDigest(source) {
  const bytes = encode([...SOURCE_DIGEST_DOMAIN, Buffer.from(source)]);
  return `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
}

/** Returns every module's source with each import pinned to its dependency's digest. */
export function pinnedRopeSources(root = ropeSourceRoot) {
  const digests = new Map();
  const sources = new Map();
  for (const { file, coordinate } of ropeModules) {
    const lines = readFileSync(path.join(root, file), 'utf8').split('\n');
    const pinned = lines.map((line) => {
      const match = IMPORT_PATTERN.exec(line);
      if (match === null) return line;
      const digest = digests.get(match[1]);
      if (digest === undefined) throw new Error(`${file} imports ${match[1]} before it is defined`);
      return line.replace(/digest "sha256:[0-9a-f]{64}"/, `digest "${digest}"`);
    }).join('\n');
    sources.set(file, pinned);
    digests.set(coordinate, sourceDigest(pinned));
  }
  return sources;
}

/** Rewrites the module files in place with their pinned imports. */
export function writePinnedRopeSources(root = ropeSourceRoot) {
  for (const [file, source] of pinnedRopeSources(root)) {
    writeFileSync(path.join(root, file), source);
  }
}
