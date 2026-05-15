import fs from 'node:fs';
import path from 'node:path';

import ts from 'typescript';

const ROOT = process.cwd();
const SOURCE_ROOT = path.join(ROOT, 'src');
const BASELINE_PATH = path.join(ROOT, 'quality-baseline.json');
const MAX_LINES_PER_FILE = 500;
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
      const actual = counts[key];
      const allowed = baseline.forbiddenTypeKeywords[relativePath]?.[key] ?? 0;
      if (actual > allowed) {
        regressions.push({
          file: relativePath,
          rule: `no-${key}`,
          actual,
          allowed,
        });
      } else if (actual > 0) {
        debt.push({
          file: relativePath,
          rule: `no-${key}`,
          actual,
          allowed,
        });
        if (actual < allowed) {
          improvements.push(`${relativePath}: no-${key} improved ${allowed} -> ${actual}`);
        }
      }
    }

    const actualEnums = counts.enum;
    const allowedEnums = baseline.enumDeclarations?.[relativePath] ?? 0;
    if (actualEnums > allowedEnums) {
      regressions.push({
        file: relativePath,
        rule: 'no-enum',
        actual: actualEnums,
        allowed: allowedEnums,
      });
    } else if (actualEnums > 0) {
      debt.push({
        file: relativePath,
        rule: 'no-enum',
        actual: actualEnums,
        allowed: allowedEnums,
      });
      if (actualEnums < allowedEnums) {
        improvements.push(`${relativePath}: no-enum improved ${allowedEnums} -> ${actualEnums}`);
      }
    }
  }

  const result = {
    ok: regressions.length === 0,
    enforcedRules: ['no-any', 'no-unknown', 'no-enum', 'max-lines-500'],
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

function loadBaseline() {
  if (!fs.existsSync(BASELINE_PATH)) {
    return {
      maxLines: {},
      forbiddenTypeKeywords: {},
      enumDeclarations: {},
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
    ts.forEachChild(node, visit);
  }
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
