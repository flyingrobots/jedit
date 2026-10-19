// SPDX-License-Identifier: Apache-2.0
// © James Ross Ω FLYING•ROBOTS <https://github.com/flyingrobots>
import { createHash } from 'node:crypto';
import { lstatSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const hash = bytes => createHash('sha256').update(bytes).digest('hex');

try {
  const [application, provenance, output] = process.argv.slice(2);
  if (!application || !provenance || !output) throw new Error('expected application, provenance and checksum output');
  const root = resolve(application);
  const receiptBytes = readFileSync(provenance);
  const receipt = JSON.parse(receiptBytes);
  if (receipt.schema !== 'jedit.probe-frozen-application/v1' ||
      !/^[a-f0-9]{40}$/.test(receipt.sourceCommit) ||
      receipt.files === null || typeof receipt.files !== 'object' || Array.isArray(receipt.files)) {
    throw new Error('invalid provenance envelope');
  }
  const recorded = Object.entries(receipt.files);
  if (recorded.length === 0) throw new Error('empty historical closure');
  const actual = [];
  function walk(directory, prefix = '') {
    for (const name of readdirSync(directory).sort()) {
      const path = join(directory, name);
      const entry = lstatSync(path);
      const key = prefix + name;
      if (entry.isDirectory()) walk(path, `${key}/`);
      else if (entry.isFile()) actual.push(key);
      else throw new Error(`nonregular historical input: ${key}`);
    }
  }
  walk(root);
  const checksums = [];
  for (const [path, expected] of recorded) {
    if (path.startsWith('/') || /[\\\r\n\t\0]/.test(path) ||
        path.split('/').some(part => part === '' || part === '.' || part === '..') ||
        typeof expected !== 'string' || !/^sha256:[a-f0-9]{64}$/.test(expected)) {
      throw new Error('invalid recorded path or digest');
    }
    const bytes = readFileSync(join(root, path));
    if (`sha256:${hash(bytes)}` !== expected) throw new Error(`historical hash mismatch: ${path}`);
    checksums.push(`${expected.slice(7)}  ${path}`);
  }
  const listed = new Set(recorded.map(([path]) => path));
  if (actual.length !== listed.size || actual.some(path => !listed.has(path))) {
    throw new Error('unrecorded historical input');
  }
  // Bind the JSON envelope too, so runtime verification detects receipt drift.
  const receiptPath = relative(root, resolve(provenance));
  if (/[\\\r\n\t\0]/.test(receiptPath)) throw new Error('invalid provenance path');
  checksums.push(`${hash(receiptBytes)}  ${receiptPath}`);
  writeFileSync(output, `${checksums.join('\n')}\n`);
  process.stdout.write(`${JSON.stringify({ kind: 'FrozenClosureVerified', files: recorded.length })}\n`);
} catch (error) {
  process.stderr.write(`${JSON.stringify({ kind: 'InvalidFrozenClosure', detail: error instanceof Error ? error.message : 'invalid closure' })}\n`);
  process.exitCode = 1;
}
