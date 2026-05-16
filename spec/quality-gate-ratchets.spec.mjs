import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

const QUALITY_GATE_SCRIPT = path.join(process.cwd(), 'scripts', 'quality-gate.mjs');

test('quality gate rejects functions above the nesting depth limit', () => {
  const fixtureRoot = mkdtempSync(path.join(tmpdir(), 'jedit-quality-gate-'));

  try {
    mkdirSync(path.join(fixtureRoot, 'src'));
    writeFileSync(
      path.join(fixtureRoot, 'src', 'bad-depth.ts'),
      [
        'export function tooDeep(value: number): number {',
        '  if (value > 0) {',
        '    if (value > 1) {',
        '      if (value > 2) {',
        '        if (value > 3) {',
        '          if (value > 4) {',
        '            return value;',
        '          }',
        '        }',
        '      }',
        '    }',
        '  }',
        '  return 0;',
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
    assert.ok(parsed.enforcedRules.includes('max-depth-4'));
    assert.deepEqual(parsed.regressions, [
      {
        file: 'src/bad-depth.ts',
        rule: 'max-depth-4',
        actual: 5,
        allowed: 4,
      },
    ]);
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
});

test('quality gate treats catch clauses as the try control level for nesting depth', () => {
  const fixtureRoot = mkdtempSync(path.join(tmpdir(), 'jedit-quality-gate-'));

  try {
    mkdirSync(path.join(fixtureRoot, 'src'));
    writeFileSync(
      path.join(fixtureRoot, 'src', 'catch-depth.ts'),
      [
        'export function recover(value: number): number {',
        '  try {',
        '    return value;',
        '  } catch {',
        '    if (value > 0) {',
        '      if (value > 1) {',
        '        if (value > 2) {',
        '          return value;',
        '        }',
        '      }',
        '    }',
        '  }',
        '  return 0;',
        '}',
        '',
      ].join('\n'),
    );

    const result = spawnSync(process.execPath, [QUALITY_GATE_SCRIPT, '--json'], {
      cwd: fixtureRoot,
      encoding: 'utf8',
    });
    assert.equal(result.status, 0, result.stderr || result.stdout);

    const parsed = JSON.parse(result.stdout);
    assert.equal(parsed.ok, true);
    assert.equal(parsed.regressions.length, 0);
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
});

test('quality gate rejects functions above the statement limit', () => {
  const fixtureRoot = mkdtempSync(path.join(tmpdir(), 'jedit-quality-gate-'));

  try {
    mkdirSync(path.join(fixtureRoot, 'src'));
    writeFileSync(
      path.join(fixtureRoot, 'src', 'bad-statements.ts'),
      [
        'export function tooManyStatements(): void {',
        '  let value = 0;',
        ...Array.from({ length: 25 }, (_, index) => `  value += ${String(index + 1)};`),
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
    assert.ok(parsed.enforcedRules.includes('max-statements-25'));
    assert.deepEqual(parsed.regressions, [
      {
        file: 'src/bad-statements.ts',
        rule: 'max-statements-25',
        actual: 26,
        allowed: 25,
      },
    ]);
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
});

test('quality gate rejects magic comparison literals in source logic', () => {
  const fixtureRoot = mkdtempSync(path.join(tmpdir(), 'jedit-quality-gate-'));

  try {
    mkdirSync(path.join(fixtureRoot, 'src', 'app'), { recursive: true });
    writeFileSync(
      path.join(fixtureRoot, 'src', 'app', 'bad-magic-literals.ts'),
      [
        'export function accepts(status: string, count: number): boolean {',
        "  return status === 'ready' || count === 42;",
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
    assert.ok(parsed.enforcedRules.includes('no-magic-comparison-literal'));
    assert.deepEqual(parsed.regressions, [
      {
        file: 'src/app/bad-magic-literals.ts',
        rule: 'no-magic-comparison-literal',
        actual: 2,
        allowed: 0,
      },
    ]);
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
});

test('quality gate rejects magic comparison literals in domain logic', () => {
  const fixtureRoot = mkdtempSync(path.join(tmpdir(), 'jedit-quality-gate-'));

  try {
    mkdirSync(path.join(fixtureRoot, 'src', 'domain'), { recursive: true });
    writeFileSync(
      path.join(fixtureRoot, 'src', 'domain', 'bad-magic-literals.ts'),
      [
        'export function accepts(status: string, count: number): boolean {',
        "  return status === 'ready' || count === 42;",
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
    assert.deepEqual(parsed.regressions, [
      {
        file: 'src/domain/bad-magic-literals.ts',
        rule: 'no-magic-comparison-literal',
        actual: 2,
        allowed: 0,
      },
    ]);
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
});

test('quality gate allows structural number comparisons in source logic', () => {
  const fixtureRoot = mkdtempSync(path.join(tmpdir(), 'jedit-quality-gate-'));

  try {
    mkdirSync(path.join(fixtureRoot, 'src', 'app'), { recursive: true });
    writeFileSync(
      path.join(fixtureRoot, 'src', 'app', 'structural-numbers.ts'),
      [
        'export function accepts(index: number, offset: number, count: number): boolean {',
        '  return index === -1 || offset === 0 || count === 1;',
        '}',
        '',
      ].join('\n'),
    );

    const result = spawnSync(process.execPath, [QUALITY_GATE_SCRIPT, '--json'], {
      cwd: fixtureRoot,
      encoding: 'utf8',
    });
    assert.equal(result.status, 0, result.stderr || result.stdout);

    const parsed = JSON.parse(result.stdout);
    assert.equal(parsed.ok, true);
    assert.equal(parsed.regressions.length, 0);
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
});

test('quality gate rejects magic switch case literals in source logic', () => {
  const fixtureRoot = mkdtempSync(path.join(tmpdir(), 'jedit-quality-gate-'));

  try {
    mkdirSync(path.join(fixtureRoot, 'src', 'app'), { recursive: true });
    writeFileSync(
      path.join(fixtureRoot, 'src', 'app', 'bad-switch-cases.ts'),
      [
        'export function classify(status: string | number): number {',
        '  switch (status) {',
        "    case 'ready':",
        '      return 1;',
        '    case 42:',
        '      return 0;',
        '    default:',
        '      return -1;',
        '  }',
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
    assert.deepEqual(parsed.regressions, [
      {
        file: 'src/app/bad-switch-cases.ts',
        rule: 'no-magic-comparison-literal',
        actual: 2,
        allowed: 0,
      },
    ]);
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
});

test('quality gate allows boundary comparison literals outside app and domain logic', () => {
  const fixtureRoot = mkdtempSync(path.join(tmpdir(), 'jedit-quality-gate-'));

  try {
    mkdirSync(path.join(fixtureRoot, 'src', 'adapters'), { recursive: true });
    writeFileSync(
      path.join(fixtureRoot, 'src', 'adapters', 'wire-codec.ts'),
      [
        'export function acceptsWireToken(status: string, count: number): boolean {',
        "  return status === 'ready' || count === 42;",
        '}',
        '',
      ].join('\n'),
    );

    const result = spawnSync(process.execPath, [QUALITY_GATE_SCRIPT, '--json'], {
      cwd: fixtureRoot,
      encoding: 'utf8',
    });
    assert.equal(result.status, 0, result.stderr || result.stdout);

    const parsed = JSON.parse(result.stdout);
    assert.equal(parsed.ok, true);
    assert.equal(parsed.regressions.length, 0);
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
});
