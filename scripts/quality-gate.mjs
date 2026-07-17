import fs from 'node:fs';
import path from 'node:path';

import { countForbiddenSyntax } from './quality-gate/syntax-counts.mjs';

const ROOT = process.cwd();
const SOURCE_ROOT = path.join(ROOT, 'src');
const BASELINE_PATH = path.join(ROOT, 'quality-baseline.json');
const PACKAGE_PATH = path.join(ROOT, 'package.json');
const MAX_LINES_PER_FILE = 500;
const MAX_PARAMETERS_PER_FUNCTION = 5;
const MAX_RUNTIME_IMPORTS_PER_FILE = 12;
const MAX_FUNCTION_LINES = 35;
const MAX_CYCLOMATIC_COMPLEXITY = 8;
const MAX_NESTING_DEPTH = 4;
const MAX_STATEMENTS_PER_FUNCTION = 25;
const MAX_SOURCE_LINE_LENGTH = 160;
const JSON_FLAG = '--json';
const IDENTITY_DOCTRINE_DOC = path.join(ROOT, 'docs/design/echo-identity-doctrine.md');
const IDENTITY_DOCTRINE_REQUIRED_LINKS = [
  { file: 'ARCHITECTURE.md', marker: 'docs/design/echo-identity-doctrine.md' },
  { file: 'README.md', marker: 'docs/design/echo-identity-doctrine.md' },
  { file: 'docs/BEARING.md', marker: 'design/echo-identity-doctrine.md' },
  { file: 'docs/echo-application-hosting-guide.md', marker: 'docs/design/echo-identity-doctrine.md' },
  { file: 'docs/design/0027-echo-hosted-production-cutover.md', marker: 'echo-identity-doctrine.md' },
];

function main() {
  const baseline = loadBaseline();
  const files = collectTypeScriptFiles(SOURCE_ROOT);
  const regressions = [];
  const debt = [];
  const improvements = [];
  validateIdentityDoctrineReferences(regressions);

  for (const filePath of files) {
    const relativePath = toRepoPath(filePath);
    const sourceText = fs.readFileSync(filePath, 'utf8');
    const lineCount = sourceText.split('\n').length;
    const counts = countForbiddenSyntax(relativePath, sourceText);

    const allowedLineCount = baseline.maxLines[relativePath] ?? MAX_LINES_PER_FILE;
    if (lineCount > allowedLineCount) {
      regressions.push({
        file: relativePath,
        rule: 'max-lines',
        actual: lineCount,
        allowed: allowedLineCount,
      });
    } else if (lineCount > MAX_LINES_PER_FILE) {
      debt.push({
        file: relativePath,
        rule: 'max-lines',
        actual: lineCount,
        allowed: allowedLineCount,
      });
      if (lineCount < allowedLineCount) {
        improvements.push(`${relativePath}: max-lines improved ${allowedLineCount} -> ${lineCount}`);
      }
    }

    for (const key of ['any', 'unknown']) {
      recordCountRule({
        relativePath,
        rule: `no-${key}`,
        actual: counts[key],
        allowed: baseline.forbiddenTypeKeywords[relativePath]?.[key] ?? 0,
        cleanLimit: 0,
        regressions,
        debt,
        improvements,
      });
    }

    recordCountRule({
      relativePath,
      rule: 'no-enum',
      actual: counts.enum,
      allowed: baseline.enumDeclarations?.[relativePath] ?? 0,
      cleanLimit: 0,
      regressions,
      debt,
      improvements,
    });
    recordCountRule({
      relativePath,
      rule: 'no-throw-new-error',
      actual: counts.throwNewError,
      allowed: baseline.rawErrorThrows?.[relativePath] ?? 0,
      cleanLimit: 0,
      regressions,
      debt,
      improvements,
    });
    recordCountRule({
      relativePath,
      rule: 'no-type-assertion',
      actual: counts.typeAssertion,
      allowed: baseline.typeAssertions?.[relativePath] ?? 0,
      cleanLimit: 0,
      regressions,
      debt,
      improvements,
    });
    recordCountRule({
      relativePath,
      rule: 'max-parameters-5',
      actual: counts.maxParameterCount,
      allowed: baseline.maxParameters?.[relativePath] ?? MAX_PARAMETERS_PER_FUNCTION,
      cleanLimit: MAX_PARAMETERS_PER_FUNCTION,
      regressions,
      debt,
      improvements,
    });
    recordCountRule({
      relativePath,
      rule: 'no-boolean-parameter',
      actual: counts.booleanParameter,
      allowed: baseline.booleanParameters?.[relativePath] ?? 0,
      cleanLimit: 0,
      regressions,
      debt,
      improvements,
    });
    recordCountRule({
      relativePath,
      rule: 'no-anonymous-public-option-bag',
      actual: counts.anonymousPublicOptionBag,
      allowed: baseline.anonymousPublicOptionBags?.[relativePath] ?? 0,
      cleanLimit: 0,
      regressions,
      debt,
      improvements,
    });
    recordCountRule({
      relativePath,
      rule: 'max-imports-12',
      actual: counts.runtimeImportCount,
      allowed: baseline.runtimeImports?.[relativePath] ?? MAX_RUNTIME_IMPORTS_PER_FILE,
      cleanLimit: MAX_RUNTIME_IMPORTS_PER_FILE,
      regressions,
      debt,
      improvements,
    });
    recordCountRule({
      relativePath,
      rule: 'max-function-lines-35',
      actual: counts.maxFunctionLineCount,
      allowed: baseline.maxFunctionLines?.[relativePath] ?? MAX_FUNCTION_LINES,
      cleanLimit: MAX_FUNCTION_LINES,
      regressions,
      debt,
      improvements,
    });
    recordCountRule({
      relativePath,
      rule: 'complexity-8',
      actual: counts.maxCyclomaticComplexity,
      allowed: baseline.cyclomaticComplexity?.[relativePath] ?? MAX_CYCLOMATIC_COMPLEXITY,
      cleanLimit: MAX_CYCLOMATIC_COMPLEXITY,
      regressions,
      debt,
      improvements,
    });
    recordCountRule({
      relativePath,
      rule: 'max-depth-4',
      actual: counts.maxNestingDepth,
      allowed: baseline.maxDepth?.[relativePath] ?? MAX_NESTING_DEPTH,
      cleanLimit: MAX_NESTING_DEPTH,
      regressions,
      debt,
      improvements,
    });
    recordCountRule({
      relativePath,
      rule: 'max-statements-25',
      actual: counts.maxStatementCount,
      allowed: baseline.maxStatements?.[relativePath] ?? MAX_STATEMENTS_PER_FUNCTION,
      cleanLimit: MAX_STATEMENTS_PER_FUNCTION,
      regressions,
      debt,
      improvements,
    });
    recordCountRule({
      relativePath,
      rule: 'max-line-length-160',
      actual: counts.maxSourceLineLength,
      allowed: baseline.maxLineLength?.[relativePath] ?? MAX_SOURCE_LINE_LENGTH,
      cleanLimit: MAX_SOURCE_LINE_LENGTH,
      regressions,
      debt,
      improvements,
    });
    recordCountRule({
      relativePath,
      rule: 'no-magic-comparison-literal',
      actual: counts.magicComparisonLiteral,
      allowed: baseline.magicComparisonLiterals?.[relativePath] ?? 0,
      cleanLimit: 0,
      regressions,
      debt,
      improvements,
    });
  }

  const result = {
    ok: regressions.length === 0,
    enforcedRules: [
      'no-any',
      'no-unknown',
      'no-enum',
      'no-throw-new-error',
      'no-type-assertion',
      'max-parameters-5',
      'no-boolean-parameter',
      'no-anonymous-public-option-bag',
      'max-imports-12',
      'max-function-lines-35',
      'complexity-8',
      'max-depth-4',
      'max-statements-25',
      'max-line-length-160',
      'no-magic-comparison-literal',
      'max-lines-500',
      'identity-doctrine-links',
    ],
    fileCount: files.length,
    regressions,
    debt,
    improvements,
  };

  if (process.argv.includes(JSON_FLAG)) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } else {
    printHuman(result);
  }

  process.exitCode = result.ok ? 0 : 1;
}

function validateIdentityDoctrineReferences(regressions) {
  if (!isJeditRepoRoot()) {
    return;
  }

  if (!fs.existsSync(IDENTITY_DOCTRINE_DOC)) {
    regressions.push({
      file: 'docs/design/echo-identity-doctrine.md',
      rule: 'identity-doctrine-links',
      actual: 'missing',
      allowed: 'present',
    });
    return;
  }

  const doctrineText = fs.readFileSync(IDENTITY_DOCTRINE_DOC, 'utf8');
  const hasTitle = doctrineText.includes('# Echo Identity Doctrine');
  if (!hasTitle) {
    regressions.push({
      file: 'docs/design/echo-identity-doctrine.md',
      rule: 'identity-doctrine-links',
      actual: 'missing doctrine heading',
      allowed: 'Echo Identity Doctrine',
    });
  }

  for (const entry of IDENTITY_DOCTRINE_REQUIRED_LINKS) {
    const fullPath = path.join(ROOT, entry.file);
    if (!fs.existsSync(fullPath)) {
      regressions.push({
        file: entry.file,
        rule: 'identity-doctrine-links',
        actual: 'missing',
        allowed: `include marker ${entry.marker}`,
      });
      continue;
    }
    const content = fs.readFileSync(fullPath, 'utf8');
    if (!content.includes(entry.marker)) {
      regressions.push({
        file: entry.file,
        rule: 'identity-doctrine-links',
        actual: 'marker missing',
        allowed: `include marker ${entry.marker}`,
      });
    }
  }
}

function isJeditRepoRoot() {
  if (!fs.existsSync(PACKAGE_PATH)) {
    return false;
  }

  const packageJson = JSON.parse(fs.readFileSync(PACKAGE_PATH, 'utf8'));
  return packageJson.name === 'jedit';
}

function recordCountRule(options) {
  if (options.actual > options.allowed) {
    options.regressions.push({
      file: options.relativePath,
      rule: options.rule,
      actual: options.actual,
      allowed: options.allowed,
    });
    return;
  }

  if (options.actual <= options.cleanLimit) {
    return;
  }

  options.debt.push({
    file: options.relativePath,
    rule: options.rule,
    actual: options.actual,
    allowed: options.allowed,
  });
  if (options.actual < options.allowed) {
    options.improvements.push(`${options.relativePath}: ${options.rule} improved ${options.allowed} -> ${options.actual}`);
  }
}

function loadBaseline() {
  if (!fs.existsSync(BASELINE_PATH)) {
    return {
      maxLines: {},
      forbiddenTypeKeywords: {},
      enumDeclarations: {},
      rawErrorThrows: {},
      typeAssertions: {},
      maxParameters: {},
      booleanParameters: {},
      anonymousPublicOptionBags: {},
      runtimeImports: {},
      maxFunctionLines: {},
      cyclomaticComplexity: {},
      maxDepth: {},
      maxStatements: {},
      maxLineLength: {},
      magicComparisonLiterals: {},
    };
  }

  return JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8'));
}

function collectTypeScriptFiles(directory) {
  if (!fs.existsSync(directory)) {
    return [];
  }

  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectTypeScriptFiles(fullPath));
      continue;
    }
    if (entry.isFile() && fullPath.endsWith('.ts')) {
      files.push(fullPath);
    }
  }
  return files.sort();
}

function toRepoPath(filePath) {
  return path.relative(ROOT, filePath).split(path.sep).join('/');
}

function printHuman(result) {
  process.stdout.write('quality gate\n');
  process.stdout.write(`files scanned: ${result.fileCount}\n`);
  process.stdout.write(`rules: ${result.enforcedRules.join(', ')}\n`);

  if (result.regressions.length === 0) {
    process.stdout.write('regressions: none\n');
  } else {
    process.stdout.write('regressions:\n');
    for (const regression of result.regressions) {
      process.stdout.write(`- ${regression.file} ${regression.rule} actual=${regression.actual} allowed=${regression.allowed}\n`);
    }
  }

  if (result.debt.length > 0) {
    process.stdout.write('tracked debt:\n');
    for (const item of result.debt) {
      process.stdout.write(`- ${item.file} ${item.rule} actual=${item.actual} allowed=${item.allowed}\n`);
    }
  }

  if (result.improvements.length > 0) {
    process.stdout.write('improvements:\n');
    for (const improvement of result.improvements) {
      process.stdout.write(`- ${improvement}\n`);
    }
  }
}

main();
