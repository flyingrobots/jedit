// SPDX-License-Identifier: Apache-2.0 OR LicenseRef-MIND-UCAL-1.0
// © James Ross Ω FLYING•ROBOTS <https://github.com/flyingrobots>
// Writes (--write) or checks (--check) the schema-2 fixture artifact and its
// sidecar. Regeneration is a reviewed change: read the diff before committing.
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { buildArtifact, RETAINED_ORACLE_PATH } from './build-artifact.mts';

export const ARTIFACT_PATH = 'contracts/jedit/acceptance/replace-range-schema-2/replace-range-schema-2.fixtures.json';

export function sha256(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

export function retainedIds(oracleBytes: Uint8Array): string[] {
  const parsed: { cases: { id: string }[] } = JSON.parse(new TextDecoder().decode(oracleBytes));
  return parsed.cases.map((entry) => entry.id);
}

export function renderArtifact(root: string): string {
  const oracle = readFileSync(path.join(root, RETAINED_ORACLE_PATH));
  return `${JSON.stringify(buildArtifact(retainedIds(oracle), sha256(oracle)), null, 2)}\n`;
}

function main(): void {
  const root = process.cwd();
  const mode = process.argv[2];
  const rendered = renderArtifact(root);
  const artifactPath = path.join(root, ARTIFACT_PATH);
  const sidecarPath = artifactPath.replace(/\.json$/, '.sha256');
  const digest = `${sha256(new TextEncoder().encode(rendered))}\n`;
  if (mode === '--write') {
    writeFileSync(artifactPath, rendered);
    writeFileSync(sidecarPath, digest);
    return;
  }
  if (mode !== '--check') throw new Error('usage: generate.mts --write | --check');
  if (readFileSync(artifactPath, 'utf8') !== rendered || readFileSync(sidecarPath, 'utf8') !== digest) {
    throw new Error(`${ARTIFACT_PATH} differs from its rows; regenerate with --write and review the diff`);
  }
}

if (process.argv[1] !== undefined && import.meta.url === `file://${path.resolve(process.argv[1])}`) main();
