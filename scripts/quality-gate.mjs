import fs from 'node:fs';
import path from 'node:path';

import ts from 'typescript';

const ROOT = process.cwd();
const SOURCE_ROOT = path.join(ROOT, 'src');
const BASELINE_PATH = path.join(ROOT, 'quality-baseline.json');
const MAX_LINES_PER_FILE = 500;
const MAX_PARAMETERS_PER_FUNCTION = 5;
const MAX_RUNTIME_IMPORTS_PER_FILE = 12;
const JSON_FLAG = '--json';

function main() {
  const baseline = loadBaseline();
  const files = collectTypeScriptFiles(SOURCE_ROOT);
  const regressions = [];
  const debt = [];
  const improvements = [];

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
      'max-lines-500',
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

function countForbiddenSyntax(relativePath, sourceText) {
  const sourceFile = ts.createSourceFile(relativePath, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const counts = {
    any: 0,
    unknown: 0,
    enum: 0,
    throwNewError: 0,
    typeAssertion: 0,
    maxParameterCount: 0,
    booleanParameter: 0,
    anonymousPublicOptionBag: 0,
    runtimeImportCount: runtimeImportCount(sourceFile),
  };

  visit(sourceFile);
  return counts;

  function visit(node) {
    if (node.kind === ts.SyntaxKind.AnyKeyword) {
      counts.any += 1;
    }
    if (node.kind === ts.SyntaxKind.UnknownKeyword) {
      counts.unknown += 1;
    }
    if (node.kind === ts.SyntaxKind.EnumDeclaration) {
      counts.enum += 1;
    }
    if (isThrowNewError(node)) {
      counts.throwNewError += 1;
    }
    if (isForbiddenTypeAssertion(node, sourceFile)) {
      counts.typeAssertion += 1;
    }
    if (isRuntimeFunctionLike(node)) {
      counts.maxParameterCount = Math.max(counts.maxParameterCount, node.parameters.length);
      counts.booleanParameter += booleanParameterCount(node);
      if (isPublicFunctionLike(node)) {
        counts.anonymousPublicOptionBag += anonymousPublicOptionBagCount(node);
      }
    }
    ts.forEachChild(node, visit);
  }
}

function isThrowNewError(node) {
  if (!ts.isThrowStatement(node) || node.expression == null || !ts.isNewExpression(node.expression)) {
    return false;
  }

  return ts.isIdentifier(node.expression.expression) && node.expression.expression.text === 'Error';
}

function isForbiddenTypeAssertion(node, sourceFile) {
  if (ts.isTypeAssertionExpression(node)) {
    return true;
  }
  if (!ts.isAsExpression(node)) {
    return false;
  }
  return node.type.getText(sourceFile) !== 'const';
}

function isRuntimeFunctionLike(node) {
  return ts.isFunctionDeclaration(node)
    || ts.isFunctionExpression(node)
    || ts.isArrowFunction(node)
    || ts.isMethodDeclaration(node)
    || ts.isConstructorDeclaration(node);
}

function booleanParameterCount(node) {
  return node.parameters.filter((parameter) => parameter.type?.kind === ts.SyntaxKind.BooleanKeyword).length;
}

function anonymousPublicOptionBagCount(node) {
  return node.parameters.filter((parameter) => parameter.type != null && ts.isTypeLiteralNode(parameter.type)).length;
}

function isPublicFunctionLike(node) {
  if (ts.isFunctionDeclaration(node)) {
    return isExported(node);
  }
  if (ts.isMethodDeclaration(node)) {
    return isPublicClassMember(node);
  }
  return isExportedVariableInitializer(node);
}

function isExported(node) {
  return Boolean(node.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword));
}

function isPublicClassMember(node) {
  if (node.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.PrivateKeyword || modifier.kind === ts.SyntaxKind.ProtectedKeyword)) {
    return false;
  }
  return ts.isClassDeclaration(node.parent) && isExported(node.parent);
}

function isExportedVariableInitializer(node) {
  const variableDeclaration = node.parent;
  if (!ts.isVariableDeclaration(variableDeclaration)) {
    return false;
  }
  const variableStatement = variableDeclaration.parent.parent;
  return ts.isVariableStatement(variableStatement) && isExported(variableStatement);
}

function runtimeImportCount(sourceFile) {
  return sourceFile.statements
    .filter(ts.isImportDeclaration)
    .filter((statement) => statement.importClause == null || !statement.importClause.isTypeOnly)
    .length;
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
