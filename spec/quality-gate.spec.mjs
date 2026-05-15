import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

const QUALITY_GATE_SCRIPT = path.join(process.cwd(), 'scripts', 'quality-gate.mjs');

test('quality gate holds the current baseline without regression', () => {
  const result = spawnSync(process.execPath, [QUALITY_GATE_SCRIPT, '--json'], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);

  const parsed = JSON.parse(result.stdout);
  assert.equal(parsed.ok, true);
  assert.ok(Array.isArray(parsed.regressions));
  assert.equal(parsed.regressions.length, 0);
});

test('quality gate rejects TypeScript enum declarations', () => {
  const fixtureRoot = mkdtempSync(path.join(tmpdir(), 'jedit-quality-gate-'));

  try {
    mkdirSync(path.join(fixtureRoot, 'src'));
    writeFileSync(
      path.join(fixtureRoot, 'src', 'bad-enum.ts'),
      [
        'enum BadToken {',
        "  Value = 'value',",
        '}',
        '',
      ].join('\n'),
    );

    const result = spawnSync(process.execPath, [QUALITY_GATE_SCRIPT, '--json'], {
      cwd: fixtureRoot,
      encoding: 'utf8',
    });
    assert.notEqual(result.status, 0);

    const parsed = JSON.parse(result.stdout);
    assert.equal(parsed.ok, false);
    assert.ok(parsed.enforcedRules.includes('no-enum'));
    assert.deepEqual(parsed.regressions, [
      {
        file: 'src/bad-enum.ts',
        rule: 'no-enum',
        actual: 1,
        allowed: 0,
      },
    ]);
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
});
