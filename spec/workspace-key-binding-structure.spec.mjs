import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import ts from 'typescript';

const REPO_ROOT = process.cwd();
const KEY_BINDINGS_PATH = path.join(REPO_ROOT, 'src', 'app', 'workspace', 'key-bindings.ts');
const MAX_IMPORTS = 12;
const MAX_FUNCTION_LINES = 35;
const MAX_FUNCTION_PARAMS = 5;
const MAX_NESTING_DEPTH = 4;
const MAX_COMPLEXITY = 8;

test('workspace key binding dispatcher satisfies code standards limits', () => {
  const sourceText = readFileSync(KEY_BINDINGS_PATH, 'utf8');
  const sourceFile = ts.createSourceFile(KEY_BINDINGS_PATH, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const updateFromKey = findFunction(sourceFile, 'updateFromKey');

  assert.notEqual(updateFromKey, undefined);
  assert.ok(importCount(sourceFile) <= MAX_IMPORTS);
  assert.ok(functionLineCount(sourceFile, updateFromKey) <= MAX_FUNCTION_LINES);
  assert.ok(updateFromKey.parameters.length <= MAX_FUNCTION_PARAMS);
  assert.ok(nestingDepth(updateFromKey) <= MAX_NESTING_DEPTH);
  assert.ok(cyclomaticComplexity(updateFromKey) <= MAX_COMPLEXITY);
});

function importCount(sourceFile) {
  return sourceFile.statements.filter(ts.isImportDeclaration).length;
}

function findFunction(sourceFile, functionName) {
  for (const statement of sourceFile.statements) {
    if (ts.isFunctionDeclaration(statement) && statement.name?.text === functionName) {
      return statement;
    }
  }
  return undefined;
}

function functionLineCount(sourceFile, node) {
  return lineNumber(sourceFile, node.end) - lineNumber(sourceFile, node.getStart(sourceFile)) + 1;
}

function lineNumber(sourceFile, position) {
  return sourceFile.getLineAndCharacterOfPosition(position).line + 1;
}

function nestingDepth(node) {
  let maximumDepth = 0;

  function visit(child, depth) {
    const nextDepth = branchingNode(child) ? depth + 1 : depth;
    maximumDepth = Math.max(maximumDepth, nextDepth);
    ts.forEachChild(child, (grandchild) => visit(grandchild, nextDepth));
  }

  ts.forEachChild(node, (child) => visit(child, 0));
  return maximumDepth;
}

function cyclomaticComplexity(node) {
  let complexity = 1;

  function visit(child) {
    if (complexityNode(child)) {
      complexity += 1;
    }
    ts.forEachChild(child, visit);
  }

  ts.forEachChild(node, visit);
  return complexity;
}

function branchingNode(node) {
  return ts.isIfStatement(node)
    || ts.isForStatement(node)
    || ts.isForInStatement(node)
    || ts.isForOfStatement(node)
    || ts.isWhileStatement(node)
    || ts.isDoStatement(node)
    || ts.isSwitchStatement(node)
    || ts.isTryStatement(node)
    || ts.isConditionalExpression(node);
}

function complexityNode(node) {
  return branchingNode(node)
    || ts.isCaseClause(node)
    || ts.isCatchClause(node)
    || booleanOperator(node);
}

function booleanOperator(node) {
  return ts.isBinaryExpression(node)
    && (
      node.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken
      || node.operatorToken.kind === ts.SyntaxKind.BarBarToken
      || node.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken
    );
}
