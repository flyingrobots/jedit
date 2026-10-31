// SPDX-License-Identifier: Apache-2.0 OR LicenseRef-MIND-UCAL-1.0
// © James Ross Ω FLYING•ROBOTS <https://github.com/flyingrobots>

import assert from 'node:assert/strict';
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const helper = new URL('../edict/replace-range/tests/compiler.mjs', import.meta.url).href;

function compilerPackage(name, binary) {
  return { id: `path+file:///compiler#${name}@1.0.0`, name, targets: [{ name: binary, kind: ['bin'] }] };
}

function buildFixture(t, packages, artifacts) {
  const root = mkdtempSync(path.join(tmpdir(), 'jedit-compiler-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const metadata = { packages, workspace_members: packages.map((pkg) => pkg.id) };
  writeFileSync(path.join(root, 'metadata.json'), JSON.stringify(metadata));
  writeFileSync(path.join(root, 'artifacts.jsonl'), artifacts.map((value) => JSON.stringify(value)).join('\n'));
  const cargo = path.join(root, 'cargo');
  writeFileSync(cargo, `#!/usr/bin/env node
import { appendFileSync, readFileSync } from 'node:fs';
appendFileSync('calls.jsonl', JSON.stringify(process.argv.slice(2)) + '\\n');
process.stdout.write(readFileSync(process.argv[3] === 'metadata' ? 'metadata.json' : 'artifacts.jsonl'));
`);
  chmodSync(cargo, 0o755);
  return {
    run() {
      return spawnSync(process.execPath, ['--input-type=module', '-e',
        `import { buildCompiler } from ${JSON.stringify(helper)}; console.log(buildCompiler(process.cwd(), '1.96.0'));`], {
        cwd: root,
        encoding: 'utf8',
        env: { ...process.env, PATH: `${root}${path.delimiter}${process.env.PATH}` },
      });
    },
    calls() { return readFileSync(path.join(root, 'calls.jsonl'), 'utf8').trim().split('\n').map(JSON.parse); },
  };
}

function artifact(pkg, executable = '/target/compiler') {
  return { reason: 'compiler-artifact', package_id: pkg.id, target: pkg.targets[0], executable };
}

for (const [name, binary] of [['edict-cli', 'edict'], ['amblicit-cli', 'amblicit']]) {
  test(`builds the public ${binary} compiler from its workspace metadata`, (t) => {
    const pkg = compilerPackage(name, binary);
    const fixture = buildFixture(t, [pkg], [artifact(pkg)]);
    const result = fixture.run();
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), '/target/compiler');
    assert.deepEqual(fixture.calls(), [
      ['+1.96.0', 'metadata', '--no-deps', '--format-version', '1'],
      ['+1.96.0', 'build', '--locked', '-p', name, '--bin', binary, '--message-format=json-render-diagnostics'],
    ]);
  });
}

test('refuses an ambiguous compiler workspace before building', (t) => {
  const fixture = buildFixture(t, [compilerPackage('edict-cli', 'edict'), compilerPackage('amblicit-cli', 'amblicit')], []);
  const result = fixture.run();
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /one public compiler, found 2/);
  assert.equal(fixture.calls().length, 1);
});

test('refuses a workspace without a public compiler before building', (t) => {
  const fixture = buildFixture(t, [compilerPackage('other-cli', 'edict')], []);
  const result = fixture.run();
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /one public compiler, found 0/);
  assert.equal(fixture.calls().length, 1);
});

test('does not accept an executable from another package', (t) => {
  const pkg = compilerPackage('amblicit-cli', 'amblicit');
  const forged = { ...artifact(pkg), package_id: 'other-package' };
  const fixture = buildFixture(t, [pkg], [forged]);
  const result = fixture.run();
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /one public compiler executable/);
});
