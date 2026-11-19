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
  path.dirname(fileURLToPath(import.meta.url)), '..', 'rope', 'src',
);

/** Each module file, its package coordinate and the coordinates it imports. */
export const ropeModules = Object.freeze([
  Object.freeze({ file: 'Octets.edict', coordinate: 'jedit.text.octets@1' }),
  Object.freeze({ file: 'Codec.edict', coordinate: 'jedit.text.codec@1' }),
  Object.freeze({ file: 'Identity.edict', coordinate: 'jedit.text.identity@1' }),
  Object.freeze({ file: 'Rope.edict', coordinate: 'jedit.text.rope@1' }),
  Object.freeze({ file: 'Flat.edict', coordinate: 'jedit.text.flat@1' }),
  Object.freeze({ file: 'Closure.edict', coordinate: 'jedit.text.closure@1' }),
  Object.freeze({ file: 'Build.edict', coordinate: 'jedit.text.build@1' }),
  Object.freeze({ file: 'Proposal.edict', coordinate: 'jedit.text.proposal@1' }),
  Object.freeze({ file: 'Plan.edict', coordinate: 'jedit.text.plan@1' }),
  Object.freeze({ file: 'ReplaceRange.edict', coordinate: 'jedit.text.replace_range@2' }),
]);

export function sourceDigest(source) {
  const bytes = encode([...SOURCE_DIGEST_DOMAIN, Buffer.from(source)]);
  return `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
}

const LAWPACK = 'jedit.text@2';

// The digest of the vendored jedit.text@2 lawpack manifest.
function lawpackDigest(root) {
  return readFileSync(path.join(root, '..', 'vendor', 'jedit-text-2', 'manifest.sha256'), 'utf8').trim();
}

const TARGET_PATTERN = /^use target (\S+) digest "sha256:[0-9a-f]{64}" as /;

// The echo.dpo@2 profile the lawpack adapter accepts; every `use target` follows it.
function targetProfile(root) {
  return JSON.parse(readFileSync(path.join(root, '..', 'echo-dpo-2-profile.json'), 'utf8')).profile;
}

/** Returns every module's source with each import pinned to its dependency's digest. */
export function pinnedRopeSources(root = ropeSourceRoot) {
  const profile = targetProfile(root);
  const digests = new Map();
  const sources = new Map();
  for (const { file, coordinate } of ropeModules) {
    const lines = readFileSync(path.join(root, file), 'utf8').split('\n');
    const pinned = lines.map((line) => {
      const target = TARGET_PATTERN.exec(line);
      if (target !== null && target[1] === profile.id) {
        return line.replace(/digest "sha256:[0-9a-f]{64}"/, `digest "${profile.digest}"`);
      }
      if (line.startsWith(`use lawpack ${LAWPACK} `)) {
        return line.replace(/digest "sha256:[0-9a-f]{64}"/, `digest "${lawpackDigest(root)}"`);
      }
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
