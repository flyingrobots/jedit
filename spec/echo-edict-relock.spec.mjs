import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { encode } from 'cbor-x';

import {
  lawpackManifestDigest,
  providerPins,
  withGitRev,
  withImportDigest,
  withOracleDigests,
} from '../scripts/deps/echo-edict-relock.mjs';

const ECHO_GIT = 'https://github.com/flyingrobots/echo';
const OLD_REV = 'a'.repeat(40);
const NEW_REV = 'b'.repeat(40);

function sha256Hex(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function temporaryDirectory(t) {
  const directory = realpathSync(mkdtempSync(path.join(tmpdir(), 'jedit-relock-')));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  return directory;
}

test('withGitRev moves every dependency on the named repository and nothing else', () => {
  const manifest = [
    '[dependencies]',
    `warp-core = { git = "${ECHO_GIT}", rev = "${OLD_REV}", features = ["trusted_runtime"] }`,
    `echo-wasm-abi = { git = "${ECHO_GIT}", rev = "${OLD_REV}" }`,
    `other = { git = "https://github.com/flyingrobots/edict", rev = "${OLD_REV}" }`,
    'serde = "1"',
    '',
  ].join('\n');

  const moved = withGitRev(manifest, ECHO_GIT, NEW_REV);

  assert.equal(moved.split(NEW_REV).length - 1, 2);
  assert.match(moved, new RegExp(`edict", rev = "${OLD_REV}"`));
  assert.match(moved, /features = \["trusted_runtime"\]/);
});

test('withGitRev refuses a manifest with no dependency on the repository', () => {
  assert.throws(() => withGitRev('serde = "1"\n', ECHO_GIT, NEW_REV), /no dependency on/);
});

test('withOracleDigests binds the lawpack to the oracle source set and file digest', () => {
  const lawpack = {
    lawpack: {
      compatibility: { id: 'jedit.text.compatibility/v1', digest: 'sha256:old' },
      conformanceFixtureCorpus: { id: 'jedit.text.ReplaceRange.oracle@1', digest: 'sha256:old' },
    },
  };

  const bound = withOracleDigests(lawpack, { sourceSetHex: '11', oracleSha256Hex: '22' });

  assert.equal(bound.lawpack.compatibility.digest, 'sha256:11');
  assert.equal(bound.lawpack.conformanceFixtureCorpus.digest, 'sha256:22');
  assert.equal(bound.lawpack.compatibility.id, 'jedit.text.compatibility/v1');
  assert.equal(lawpack.lawpack.compatibility.digest, 'sha256:old');
});

test('withImportDigest rewrites only the named lawpack import', () => {
  const source = [
    'package jedit.text.replace_range@1;',
    '',
    'use lawpack jedit.text@1 digest "sha256:0000" as text;',
    'use lawpack causal.cell@1 digest "sha256:1111" as cell;',
    '',
  ].join('\n');

  const rewritten = withImportDigest(source, 'jedit.text@1', 'sha256:ffff');

  assert.match(rewritten, /use lawpack jedit\.text@1 digest "sha256:ffff" as text;/);
  assert.match(rewritten, /use lawpack causal\.cell@1 digest "sha256:1111" as cell;/);
  assert.throws(() => withImportDigest(source, 'missing.pack@1', 'sha256:ffff'), /no import of missing\.pack@1/);
});

test('lawpackManifestDigest reads the manifest digest from Edict lawpack output', () => {
  const output = {
    schema: 'edict.lawpack-output/v1',
    artifacts: [
      { path: 'manifest.cbor', kind: 'manifest', digest: 'sha256:abc' },
      { path: 'exports.cbor', kind: 'exports', digest: 'sha256:def' },
    ],
  };

  assert.equal(lawpackManifestDigest(output), 'sha256:abc');
  assert.throws(() => lawpackManifestDigest({ ...output, artifacts: [] }), /one manifest artifact/);
});

test('providerPins derives the toolchain-lock provider entry from a checked provider package', (t) => {
  const root = temporaryDirectory(t);
  mkdirSync(path.join(root, 'components'));
  mkdirSync(path.join(root, 'generated', 'primary'), { recursive: true });
  const lowerer = Buffer.from('lowerer component');
  const verifier = Buffer.from('verifier component');
  writeFileSync(path.join(root, 'components', 'lowerer.echo-dpo.component.wasm'), lowerer);
  writeFileSync(path.join(root, 'components', 'verifier.echo-dpo.component.wasm'), verifier);
  const contractDigest = Buffer.alloc(32, 7);
  writeFileSync(
    path.join(root, 'generated', 'primary', 'target-profile.echo-dpo.cbor'),
    encode({ verifier: { id: 'echo.dpo.verifier/v1', digest: ['sha256', contractDigest] } }),
  );
  const manifestBytes = Buffer.from(JSON.stringify({
    provider: { coordinate: 'echo.edict-provider@1', digest: 'sha256:provider' },
    artifacts: [
      { role: 'lowerer.echo-dpo', resource: { coordinate: 'echo.dpo.lowerer/component@1', digest: `sha256:${sha256Hex(lowerer)}` } },
      { role: 'verifier.echo-dpo', resource: { coordinate: 'echo.dpo.verifier/component@1', digest: `sha256:${sha256Hex(verifier)}` } },
      { role: 'target-profile.echo-dpo', resource: { coordinate: 'echo.dpo@1', digest: 'sha256:profile' } },
    ],
  }));
  writeFileSync(path.join(root, 'provider-manifest.echo.json'), manifestBytes);

  assert.deepEqual(providerPins(root), {
    coordinate: 'echo.edict-provider@1',
    digest: 'sha256:provider',
    manifestSha256: sha256Hex(manifestBytes),
    targetProfile: { coordinate: 'echo.dpo@1', digest: 'sha256:profile' },
    lowerer: { coordinate: 'echo.dpo.lowerer/component@1', sha256: sha256Hex(lowerer) },
    verifier: {
      coordinate: 'echo.dpo.verifier/component@1',
      sha256: sha256Hex(verifier),
      contract: { coordinate: 'echo.dpo.verifier/v1', digest: `sha256:${contractDigest.toString('hex')}` },
    },
  });
});

test('providerPins refuses a component whose bytes disagree with the provider manifest', (t) => {
  const root = temporaryDirectory(t);
  mkdirSync(path.join(root, 'components'));
  mkdirSync(path.join(root, 'generated', 'primary'), { recursive: true });
  writeFileSync(path.join(root, 'components', 'lowerer.echo-dpo.component.wasm'), 'lowerer');
  writeFileSync(path.join(root, 'components', 'verifier.echo-dpo.component.wasm'), 'verifier');
  writeFileSync(
    path.join(root, 'generated', 'primary', 'target-profile.echo-dpo.cbor'),
    encode({ verifier: { id: 'echo.dpo.verifier/v1', digest: ['sha256', Buffer.alloc(32)] } }),
  );
  writeFileSync(path.join(root, 'provider-manifest.echo.json'), JSON.stringify({
    provider: { coordinate: 'echo.edict-provider@1', digest: 'sha256:provider' },
    artifacts: [
      { role: 'lowerer.echo-dpo', resource: { coordinate: 'echo.dpo.lowerer/component@1', digest: 'sha256:wrong' } },
      { role: 'verifier.echo-dpo', resource: { coordinate: 'echo.dpo.verifier/component@1', digest: `sha256:${sha256Hex(Buffer.from('verifier'))}` } },
      { role: 'target-profile.echo-dpo', resource: { coordinate: 'echo.dpo@1', digest: 'sha256:profile' } },
    ],
  }));

  assert.throws(() => providerPins(root), /lowerer\.echo-dpo component bytes disagree/);
});
