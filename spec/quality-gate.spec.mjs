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

test('quality gate rejects raw Error throws in source files', () => {
  const fixtureRoot = mkdtempSync(path.join(tmpdir(), 'jedit-quality-gate-'));

  try {
    mkdirSync(path.join(fixtureRoot, 'src'));
    writeFileSync(
      path.join(fixtureRoot, 'src', 'bad-error.ts'),
      [
        'export function failHard() {',
        "  throw new Error('boom');",
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
    assert.ok(parsed.enforcedRules.includes('no-throw-new-error'));
    assert.deepEqual(parsed.regressions, [
      {
        file: 'src/bad-error.ts',
        rule: 'no-throw-new-error',
        actual: 1,
        allowed: 0,
      },
    ]);
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
});

test('quality gate rejects non-const type assertions in source files', () => {
  const fixtureRoot = mkdtempSync(path.join(tmpdir(), 'jedit-quality-gate-'));

  try {
    mkdirSync(path.join(fixtureRoot, 'src'));
    writeFileSync(
      path.join(fixtureRoot, 'src', 'bad-cast.ts'),
      [
        'export function cast(value: string | number): string {',
        '  return value as string;',
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
    assert.ok(parsed.enforcedRules.includes('no-type-assertion'));
    assert.deepEqual(parsed.regressions, [
      {
        file: 'src/bad-cast.ts',
        rule: 'no-type-assertion',
        actual: 1,
        allowed: 0,
      },
    ]);
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
});

test('quality gate rejects functions above the parameter limit', () => {
  const fixtureRoot = mkdtempSync(path.join(tmpdir(), 'jedit-quality-gate-'));

  try {
    mkdirSync(path.join(fixtureRoot, 'src'));
    writeFileSync(
      path.join(fixtureRoot, 'src', 'bad-params.ts'),
      [
        'export function tooMany(a: number, b: number, c: number, d: number, e: number, f: number): number {',
        '  return a + b + c + d + e + f;',
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
    assert.ok(parsed.enforcedRules.includes('max-parameters-5'));
    assert.deepEqual(parsed.regressions, [
      {
        file: 'src/bad-params.ts',
        rule: 'max-parameters-5',
        actual: 6,
        allowed: 5,
      },
    ]);
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
});

test('quality gate rejects boolean parameters', () => {
  const fixtureRoot = mkdtempSync(path.join(tmpdir(), 'jedit-quality-gate-'));

  try {
    mkdirSync(path.join(fixtureRoot, 'src'));
    writeFileSync(
      path.join(fixtureRoot, 'src', 'bad-boolean-param.ts'),
      [
        'export function setEnabled(enabled: boolean): boolean {',
        '  return enabled;',
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
    assert.ok(parsed.enforcedRules.includes('no-boolean-parameter'));
    assert.deepEqual(parsed.regressions, [
      {
        file: 'src/bad-boolean-param.ts',
        rule: 'no-boolean-parameter',
        actual: 1,
        allowed: 0,
      },
    ]);
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
});

test('quality gate rejects anonymous public option bags', () => {
  const fixtureRoot = mkdtempSync(path.join(tmpdir(), 'jedit-quality-gate-'));

  try {
    mkdirSync(path.join(fixtureRoot, 'src'));
    writeFileSync(
      path.join(fixtureRoot, 'src', 'bad-option-bag.ts'),
      [
        'export function run(options: { readonly value: number }): number {',
        '  return options.value;',
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
    assert.ok(parsed.enforcedRules.includes('no-anonymous-public-option-bag'));
    assert.deepEqual(parsed.regressions, [
      {
        file: 'src/bad-option-bag.ts',
        rule: 'no-anonymous-public-option-bag',
        actual: 1,
        allowed: 0,
      },
    ]);
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
});

test('quality gate rejects files above the import fan-in limit', () => {
  const fixtureRoot = mkdtempSync(path.join(tmpdir(), 'jedit-quality-gate-'));

  try {
    mkdirSync(path.join(fixtureRoot, 'src'));
    writeFileSync(
      path.join(fixtureRoot, 'src', 'bad-imports.ts'),
      [
        "import './a01.js';",
        "import './a02.js';",
        "import './a03.js';",
        "import './a04.js';",
        "import './a05.js';",
        "import './a06.js';",
        "import './a07.js';",
        "import './a08.js';",
        "import './a09.js';",
        "import './a10.js';",
        "import './a11.js';",
        "import './a12.js';",
        "import './a13.js';",
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
    assert.ok(parsed.enforcedRules.includes('max-imports-12'));
    assert.deepEqual(parsed.regressions, [
      {
        file: 'src/bad-imports.ts',
        rule: 'max-imports-12',
        actual: 13,
        allowed: 12,
      },
    ]);
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
});

test('quality gate rejects functions above the line limit', () => {
  const fixtureRoot = mkdtempSync(path.join(tmpdir(), 'jedit-quality-gate-'));

  try {
    mkdirSync(path.join(fixtureRoot, 'src'));
    writeFileSync(
      path.join(fixtureRoot, 'src', 'bad-function-lines.ts'),
      [
        'export function tooLong(): number {',
        ...Array.from({ length: 36 }, (_, index) => `  const value${String(index)} = ${String(index)};`),
        '  return value0;',
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
    assert.ok(parsed.enforcedRules.includes('max-function-lines-35'));
    assert.deepEqual(parsed.regressions, [
      {
        file: 'src/bad-function-lines.ts',
        rule: 'max-function-lines-35',
        actual: 37,
        allowed: 35,
      },
    ]);
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
});

test('quality gate rejects functions above the complexity limit', () => {
  const fixtureRoot = mkdtempSync(path.join(tmpdir(), 'jedit-quality-gate-'));

  try {
    mkdirSync(path.join(fixtureRoot, 'src'));
    writeFileSync(
      path.join(fixtureRoot, 'src', 'bad-complexity.ts'),
      [
        'export function tooComplex(value: number): number {',
        '  let result = value;',
        '  if (value > 0) { result += 1; }',
        '  if (value > 1) { result += 1; }',
        '  if (value > 2) { result += 1; }',
        '  if (value > 3) { result += 1; }',
        '  if (value > 4) { result += 1; }',
        '  if (value > 5) { result += 1; }',
        '  if (value > 6) { result += 1; }',
        '  if (value > 7) { result += 1; }',
        '  return result;',
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
    assert.ok(parsed.enforcedRules.includes('complexity-8'));
    assert.deepEqual(parsed.regressions, [
      {
        file: 'src/bad-complexity.ts',
        rule: 'complexity-8',
        actual: 9,
        allowed: 8,
      },
    ]);
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
});

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

test('quality gate rejects overlong source lines', () => {
  const fixtureRoot = mkdtempSync(path.join(tmpdir(), 'jedit-quality-gate-'));
  const overlongLine = `export const unreadable = '${'x'.repeat(150)}';`;

  try {
    mkdirSync(path.join(fixtureRoot, 'src'));
    writeFileSync(
      path.join(fixtureRoot, 'src', 'bad-line-length.ts'),
      [
        overlongLine,
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
    assert.ok(parsed.enforcedRules.includes('max-line-length-160'));
    assert.deepEqual(parsed.regressions, [
      {
        file: 'src/bad-line-length.ts',
        rule: 'max-line-length-160',
        actual: overlongLine.length,
        allowed: 160,
      },
    ]);
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
});
