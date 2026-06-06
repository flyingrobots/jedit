import ts from 'typescript';

// Structural sentinels only: -1 for not-found, 0 for empty/index origins, and 1 for single-step/count cases.
// Other integers are semantic in comparisons and must be named before use.
const STRUCTURAL_NUMBER_LITERALS = new Set([-1, 0, 1]);

export function countForbiddenSyntax(relativePath, sourceText) {
  const sourceFile = ts.createSourceFile(relativePath, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const magicComparisonRuleTarget = isMagicComparisonRuleTarget(relativePath);
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
    maxFunctionLineCount: 0,
    maxCyclomaticComplexity: 0,
    maxNestingDepth: 0,
    maxStatementCount: 0,
    maxSourceLineLength: isGeneratedSource(relativePath) ? 0 : maxSourceLineLength(sourceText),
    magicComparisonLiteral: 0,
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
    if (magicComparisonRuleTarget && isMagicComparisonLiteral(node)) {
      counts.magicComparisonLiteral += 1;
    }
    if (isRuntimeFunctionLike(node)) {
      counts.maxParameterCount = Math.max(counts.maxParameterCount, node.parameters.length);
      counts.booleanParameter += booleanParameterCount(node);
      counts.maxFunctionLineCount = Math.max(
        counts.maxFunctionLineCount,
        functionBodyLineCount(sourceFile, node),
      );
      counts.maxCyclomaticComplexity = Math.max(
        counts.maxCyclomaticComplexity,
        cyclomaticComplexity(node),
      );
      counts.maxNestingDepth = Math.max(
        counts.maxNestingDepth,
        nestingDepth(node),
      );
      counts.maxStatementCount = Math.max(
        counts.maxStatementCount,
        functionStatementCount(node),
      );
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
    || ts.isGetAccessorDeclaration(node)
    || ts.isSetAccessorDeclaration(node)
    || ts.isConstructorDeclaration(node);
}

function functionBodyLineCount(sourceFile, node) {
  if (node.body == null) {
    return 0;
  }

  if (!ts.isBlock(node.body)) {
    return codeLineCount(sourceFile, node.body.getStart(sourceFile), node.body.getEnd());
  }

  const statements = node.body.statements;
  if (statements.length === 0) {
    return 0;
  }

  return codeLineCount(
    sourceFile,
    statements[0].getStart(sourceFile),
    statements[statements.length - 1].getEnd(),
  );
}

function codeLineCount(sourceFile, startPosition, endPosition) {
  const startLine = sourceFile.getLineAndCharacterOfPosition(startPosition).line;
  const endLine = sourceFile.getLineAndCharacterOfPosition(endPosition).line;
  return sourceFile.text
    .split(/\r?\n/)
    .slice(startLine, endLine + 1)
    .filter(isCountedCodeLine)
    .length;
}

function isCountedCodeLine(line) {
  const trimmed = line.trim();
  return trimmed.length > 0 && !trimmed.startsWith('//');
}

function functionStatementCount(node) {
  if (node.body == null) {
    return 0;
  }

  let count = 0;
  visitStatementNode(node.body);
  return count;

  function visitStatementNode(child) {
    if (child !== node.body && isRuntimeFunctionLike(child)) {
      return;
    }
    if (ts.isStatement(child) && !ts.isBlock(child)) {
      count += 1;
    }
    ts.forEachChild(child, visitStatementNode);
  }
}

function cyclomaticComplexity(node) {
  if (node.body == null) {
    return 1;
  }

  let complexity = 1;
  visitComplexityNode(node.body);
  return complexity;

  function visitComplexityNode(child) {
    if (child !== node.body && isRuntimeFunctionLike(child)) {
      return;
    }
    if (isCyclomaticBranch(child)) {
      complexity += 1;
    }
    if (isShortCircuitBranch(child)) {
      complexity += 1;
    }
    ts.forEachChild(child, visitComplexityNode);
  }
}

function isCyclomaticBranch(node) {
  return ts.isIfStatement(node)
    || ts.isForStatement(node)
    || ts.isForInStatement(node)
    || ts.isForOfStatement(node)
    || ts.isWhileStatement(node)
    || ts.isDoStatement(node)
    || ts.isCaseClause(node)
    || ts.isConditionalExpression(node);
}

function isShortCircuitBranch(node) {
  if (!ts.isBinaryExpression(node)) {
    return false;
  }
  return node.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken
    || node.operatorToken.kind === ts.SyntaxKind.BarBarToken
    || node.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken;
}

function nestingDepth(node) {
  if (node.body == null) {
    return 0;
  }

  let maxDepth = 0;
  visitDepthNode(node.body, 0);
  return maxDepth;

  function visitDepthNode(child, currentDepth) {
    if (child !== node.body && isRuntimeFunctionLike(child)) {
      return;
    }

    const childDepth = isNestingNode(child) ? currentDepth + 1 : currentDepth;
    maxDepth = Math.max(maxDepth, childDepth);
    ts.forEachChild(child, (grandchild) => visitDepthNode(grandchild, childDepth));
  }
}

function isNestingNode(node) {
  // Catch bodies continue the surrounding try nesting level; catch is not an extra control nest.
  return ts.isIfStatement(node)
    || ts.isForStatement(node)
    || ts.isForInStatement(node)
    || ts.isForOfStatement(node)
    || ts.isWhileStatement(node)
    || ts.isDoStatement(node)
    || ts.isSwitchStatement(node)
    || ts.isTryStatement(node);
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

function isGeneratedSource(relativePath) {
  return relativePath.startsWith('src/generated/');
}

function isMagicComparisonRuleTarget(relativePath) {
  return relativePath.startsWith('src/app/') || relativePath.startsWith('src/domain/');
}

function maxSourceLineLength(sourceText) {
  return Math.max(0, ...sourceText.split(/\r?\n/).map((line) => line.length));
}

function isMagicComparisonLiteral(node) {
  if (isStructuralNumberLiteral(node)) {
    return false;
  }
  if (!isComparableLiteral(node)) {
    return false;
  }
  if (isSwitchCaseLiteral(node)) {
    return true;
  }
  return isBinaryComparisonLiteral(node);
}

function isComparableLiteral(node) {
  return ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) || ts.isNumericLiteral(node);
}

function isStructuralNumberLiteral(node) {
  if (!ts.isNumericLiteral(node)) {
    return false;
  }
  return STRUCTURAL_NUMBER_LITERALS.has(numericLiteralValue(node));
}

function numericLiteralValue(node) {
  if (
    ts.isPrefixUnaryExpression(node.parent)
    && node.parent.operator === ts.SyntaxKind.MinusToken
    && node.parent.operand === node
  ) {
    return -Number(node.text);
  }
  return Number(node.text);
}

function isSwitchCaseLiteral(node) {
  return ts.isCaseClause(node.parent) && node.parent.expression === node;
}

function isBinaryComparisonLiteral(node) {
  const expression = comparisonExpressionForLiteral(node);
  return expression != null && isComparisonOperator(expression.operatorToken.kind);
}

function comparisonExpressionForLiteral(node) {
  if (ts.isBinaryExpression(node.parent)) {
    return node.parent;
  }
  if (!ts.isPrefixUnaryExpression(node.parent) || !ts.isBinaryExpression(node.parent.parent)) {
    return undefined;
  }
  return node.parent.parent;
}

function isComparisonOperator(kind) {
  return kind === ts.SyntaxKind.EqualsEqualsEqualsToken
    || kind === ts.SyntaxKind.ExclamationEqualsEqualsToken
    || kind === ts.SyntaxKind.EqualsEqualsToken
    || kind === ts.SyntaxKind.ExclamationEqualsToken
    || kind === ts.SyntaxKind.LessThanToken
    || kind === ts.SyntaxKind.LessThanEqualsToken
    || kind === ts.SyntaxKind.GreaterThanToken
    || kind === ts.SyntaxKind.GreaterThanEqualsToken;
}
