import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { encode } from 'cbor-x';

import { git } from './git-fixture-helpers.mjs';
import {
  adapterTargets,
  lawpackManifestDigest,
  providerPins,
  restoringOnFailure,
  withAdapterTargets,
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

function providerWithProfile(t, profile, artifacts) {
  const root = temporaryDirectory(t);
  mkdirSync(path.join(root, 'generated', 'primary'), { recursive: true });
  writeFileSync(path.join(root, 'generated', 'primary', 'target-profile.echo-dpo.cbor'), encode(profile));
  writeFileSync(path.join(root, 'provider-manifest.echo.json'), JSON.stringify({ provider: {}, artifacts }));
  return root;
}

test('adapterTargets reads the target profile and target IR the provider publishes', (t) => {
  const irDigest = Buffer.alloc(32, 9);
  const root = providerWithProfile(
    t,
    { targetIr: { id: 'echo.span-ir/v2', digest: ['sha256', irDigest] } },
    [{ role: 'target-profile.echo-dpo', resource: { coordinate: 'echo.dpo@2', digest: 'sha256:profile2' } }],
  );

  assert.deepEqual(adapterTargets(root), {
    acceptedTargetProfile: { id: 'echo.dpo@2', digest: 'sha256:profile2' },
    acceptedTargetIr: { id: 'echo.span-ir/v2', digest: `sha256:${irDigest.toString('hex')}` },
  });
});

test('withAdapterTargets rebinds every target adapter and leaves the input unchanged', () => {
  const stale = { id: 'echo.dpo@1', digest: 'sha256:old' };
  const lawpack = {
    lawpack: {
      targetAdapters: [
        { coordinate: 'a', acceptedTargetProfile: stale, acceptedTargetIr: stale },
        { coordinate: 'b', acceptedTargetProfile: stale, acceptedTargetIr: stale },
      ],
    },
  };
  const targets = {
    acceptedTargetProfile: { id: 'echo.dpo@2', digest: 'sha256:new' },
    acceptedTargetIr: { id: 'echo.span-ir/v2', digest: 'sha256:ir' },
  };

  const bound = withAdapterTargets(lawpack, targets);

  for (const adapter of bound.lawpack.targetAdapters) {
    assert.deepEqual(adapter.acceptedTargetProfile, targets.acceptedTargetProfile);
    assert.deepEqual(adapter.acceptedTargetIr, targets.acceptedTargetIr);
  }
  assert.equal(lawpack.lawpack.targetAdapters[0].acceptedTargetProfile.digest, 'sha256:old');
});

function fixtureRepository(t) {
  const repo = temporaryDirectory(t);
  mkdirSync(path.join(repo, 'managed'));
  writeFileSync(path.join(repo, 'managed', 'pinned.txt'), 'original\n');
  writeFileSync(path.join(repo, 'outside.txt'), 'outside\n');
  git(repo, 'init', '-q');
  git(repo, 'add', '-A');
  git(repo, '-c', 'user.email=t@example.com', '-c', 'user.name=t', 'commit', '-qm', 'fixture');
  return repo;
}

test('restoringOnFailure restores managed paths and removes files the failed run created', (t) => {
  const repo = fixtureRepository(t);

  assert.throws(() => restoringOnFailure(repo, ['managed'], () => {
    writeFileSync(path.join(repo, 'managed', 'pinned.txt'), 'regenerated\n');
    writeFileSync(path.join(repo, 'managed', 'fresh.txt'), 'new\n');
    throw new Error('host failed to compile');
  }), /host failed to compile/);

  assert.equal(readFileSync(path.join(repo, 'managed', 'pinned.txt'), 'utf8'), 'original\n');
  assert.equal(git(repo, 'status', '--porcelain=v1', '--untracked-files=all'), '');
});

test('restoringOnFailure keeps a successful run and refuses dirty managed paths up front', (t) => {
  const repo = fixtureRepository(t);

  restoringOnFailure(repo, ['managed'], () => {
    writeFileSync(path.join(repo, 'managed', 'pinned.txt'), 'relocked\n');
  });
  assert.equal(readFileSync(path.join(repo, 'managed', 'pinned.txt'), 'utf8'), 'relocked\n');

  assert.throws(() => restoringOnFailure(repo, ['managed'], () => {}), /managed paths must be clean/);
  writeFileSync(path.join(repo, 'outside.txt'), 'edited\n');
  git(repo, 'checkout', '--', 'managed');
  assert.doesNotThrow(() => restoringOnFailure(repo, ['managed'], () => {}));
});
