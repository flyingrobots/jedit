import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';
import semver from 'semver';
import ts from 'typescript';
import { REPO_ROOT, ensureDistBuilt } from './dist-helpers.mjs';

const PORT_PATH = path.join(REPO_ROOT, 'dist', 'ports', 'source-highlighter.js');
const ADAPTER_PATH = path.join(REPO_ROOT, 'dist', 'adapters', 'graft-source-highlighter.js');
const ADAPTER_SOURCE_PATH = path.join(REPO_ROOT, 'src', 'adapters', 'graft-source-highlighter.ts');
const GRAFT_PACKAGE_PATH = path.join(REPO_ROOT, 'node_modules', '@flyingrobots', 'graft', 'package.json');
const GRAFT_COLORFUL_PROSE_MINIMUM_VERSION = '0.10.0';
const GRAFT_COLORFUL_NUMERIC_IR_MINIMUM_VERSION = '0.10.1';
const GRAFT_COLORFUL_CLI_MINIMUM_VERSION = '0.2.1';
const GRAFT_COLORFUL_CLI_BELOW_MINIMUM_VERSION = '0.2.0';
const GRAFT_MALFORMED_VERSION = 'not-semver';
const COLORFUL_CONTRACT_VERSION = 'colorful.syntax/v1';
const COLORFUL_VOCABULARY_HASH = 'sha256:c3709c173d632bd18385b991f63dc3ac09cdba582bc05550f0376db24117bbe1';
const FAKE_COLORFUL_CLI_NAME = 'colorful';
const FAKE_COLORFUL_VERSION_OUTPUT = `colorful ${GRAFT_COLORFUL_CLI_MINIMUM_VERSION}`;
const FAKE_COLORFUL_IR_COMMAND = 'ir';
const FAKE_COLORFUL_STDIN_PATH = '-';
const FAKE_COLORFUL_USAGE_EXIT_STATUS = 64;
const EXECUTABLE_MODE = 0o755;
const MISSING_COLORFUL_CLI_NAME = 'missing-colorful-cli';
const MISSING_COLORFUL_TIMEOUT_MS = 1000;
const MISSING_COLORFUL_MAX_BUFFER_BYTES = 1024;
const DIAGNOSTICS_CWD = '/repo';
const DIAGNOSTICS_COMMAND = 'colorful-test';
const DIAGNOSTICS_FAILURE_MESSAGE = 'adapter exploded';
const DIAGNOSTICS_NONZERO_ERROR = 'colorful command failed';
const DIAGNOSTICS_PARSE_OUTPUT = 'colorful dev';
const PROSE_FIXTURE_TEXT = 'Now is 7.';
const PROSE_KEYWORD_START_COLUMN = 4;
const PROSE_KEYWORD_END_COLUMN = 6;
const PROSE_NUMBER_START_COLUMN = 7;
const PROSE_NUMBER_END_COLUMN = 8;
const PROSE_PUNCTUATION_START_COLUMN = 8;
const PROSE_PUNCTUATION_END_COLUMN = 9;

function semverAtLeast(actual, minimum) {
  return semver.gte(actual, minimum);
}

function readAdapterSourceFile() {
  return ts.createSourceFile(
    ADAPTER_SOURCE_PATH,
    fs.readFileSync(ADAPTER_SOURCE_PATH, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
}

function findFunctionDeclaration(sourceFile, functionName) {
  for (const statement of sourceFile.statements) {
    if (
      ts.isFunctionDeclaration(statement) &&
      statement.name != null &&
      statement.name.text === functionName
    ) {
      return statement;
    }
  }
  assert.fail(`expected ${functionName} function declaration`);
}

function nodeHasShellFalseProperty(node) {
  let found = false;

  function visit(child) {
    if (
      ts.isPropertyAssignment(child) &&
      ts.isIdentifier(child.name) &&
      child.name.text === 'shell' &&
      child.initializer.kind === ts.SyntaxKind.FalseKeyword
    ) {
      found = true;
      return;
    }
    ts.forEachChild(child, visit);
  }

  visit(node);
  return found;
}

test('Graft source highlighter dependency version check honors prerelease ordering', () => {
  assert.equal(semverAtLeast('0.10.0-alpha.1', GRAFT_COLORFUL_PROSE_MINIMUM_VERSION), false);
  assert.equal(semverAtLeast('0.10.0', GRAFT_COLORFUL_PROSE_MINIMUM_VERSION), true);
});

test('Graft source highlighter default loader does not rely on a module-level process runner singleton', () => {
  const sourceFile = readAdapterSourceFile();

  const hasModuleLevelProcessRunner = sourceFile.statements.some((statement) => (
    ts.isVariableStatement(statement) &&
    statement.declarationList.declarations.some((declaration) => (
      ts.isIdentifier(declaration.name) &&
      declaration.name.text === 'NODE_PROCESS_RUNNER'
    ))
  ));

  assert.equal(hasModuleLevelProcessRunner, false);
});

test('Graft source highlighter process runner explicitly disables shell execution', () => {
  const sourceFile = readAdapterSourceFile();
  const factory = findFunctionDeclaration(sourceFile, 'createGraftSourceHighlighterProcessRunner');

  assert.equal(nodeHasShellFalseProperty(factory), true);
});

function readGraftPackageVersion() {
  const packageJson = JSON.parse(fs.readFileSync(GRAFT_PACKAGE_PATH, 'utf8'));
  assert.equal(typeof packageJson.version, 'string');
  return packageJson.version;
}

function writeFakeColorfulCli(directory) {
  const executablePath = path.join(directory, FAKE_COLORFUL_CLI_NAME);
  const script = `#!/usr/bin/env node
const { createHash } = require('node:crypto');
const fs = require('node:fs');

const args = process.argv.slice(2);

function contentHash(content) {
  return \`sha256:\${createHash('sha256').update(content).digest('hex')}\`;
}

if (args.length === 1 && args[0] === '--version') {
  console.log(${JSON.stringify(FAKE_COLORFUL_VERSION_OUTPUT)});
  process.exit(0);
}

if (args.length === 2 && args[0] === ${JSON.stringify(FAKE_COLORFUL_IR_COMMAND)} && args[1] === ${JSON.stringify(FAKE_COLORFUL_STDIN_PATH)}) {
  const content = fs.readFileSync(0, 'utf8');
  const bytes = Buffer.from(content, 'utf8');
  process.stdout.write(JSON.stringify({
    contractVersion: ${JSON.stringify(COLORFUL_CONTRACT_VERSION)},
    schemaHash: 'sha256:test-schema',
    vocabularyHash: ${JSON.stringify(COLORFUL_VOCABULARY_HASH)},
    source: {
      unitId: 'notes.txt',
      contentHash: contentHash(content),
      utf8ByteLength: bytes.byteLength,
    },
    tokens: [
      {
        occurrenceId: 1,
        byteRange: { startUtf8: ${String(PROSE_KEYWORD_START_COLUMN)}, endUtf8: ${String(PROSE_KEYWORD_END_COLUMN)} },
        tokenKind: 'WORD',
        lexicalClass: 'FUNCTION',
        functionKind: null,
      },
      {
        occurrenceId: 2,
        byteRange: { startUtf8: ${String(PROSE_NUMBER_START_COLUMN)}, endUtf8: ${String(PROSE_NUMBER_END_COLUMN)} },
        tokenKind: 'NUMBER',
        lexicalClass: null,
        functionKind: null,
      },
      {
        occurrenceId: 3,
        byteRange: { startUtf8: ${String(PROSE_PUNCTUATION_START_COLUMN)}, endUtf8: ${String(PROSE_PUNCTUATION_END_COLUMN)} },
        tokenKind: 'PUNCTUATION',
        lexicalClass: null,
        functionKind: null,
      },
    ],
    structure: [
      {
        nodeId: 0,
        kind: 'PARAGRAPH',
        byteRange: { startUtf8: 0, endUtf8: bytes.byteLength },
        depth: 0,
        childNodeIds: [1],
      },
      {
        nodeId: 1,
        kind: 'SENTENCE',
        byteRange: { startUtf8: 0, endUtf8: bytes.byteLength },
        depth: 1,
        childNodeIds: [],
      },
    ],
  }));
  process.exit(0);
}

console.error(\`unsupported fake colorful invocation: \${args.join(' ')}\`);
process.exit(${String(FAKE_COLORFUL_USAGE_EXIT_STATUS)});
`;
  fs.writeFileSync(executablePath, script);
  fs.chmodSync(executablePath, EXECUTABLE_MODE);
}

async function withPathPrefix(directory, action) {
  const originalPath = process.env.PATH;
  process.env.PATH = originalPath == null ? directory : `${directory}${path.delimiter}${originalPath}`;
  try {
    return await action();
  } finally {
    if (originalPath == null) {
      delete process.env.PATH;
    } else {
      process.env.PATH = originalPath;
    }
  }
}

async function loadGraftSourceHighlighterModules() {
  await ensureDistBuilt();

  return {
    port: await import(pathToFileURL(PORT_PATH).href),
    adapter: await import(pathToFileURL(ADAPTER_PATH).href),
  };
}

test('Graft source highlighter projects editor-buffer syntax spans through the source highlight port', async () => {
  const { port, adapter } = await loadGraftSourceHighlighterModules();
  let parserReady = false;
  let request;
  const runtime = {
    ensureParserReady: async () => {
      parserReady = true;
    },
    createProjectionBundle: (filePath, content, options) => {
      request = { filePath, content, options };
      return {
        syntax: {
          partial: false,
          spans: [
            {
              className: 'keyword',
              text: 'export',
              range: { start: { row: 1, column: 0 }, end: { row: 1, column: 6 } },
            },
            {
              className: 'variable',
              text: 'ready',
              range: { start: { row: 1, column: 13 }, end: { row: 1, column: 18 } },
            },
          ],
        },
      };
    },
  };

  const highlighter = adapter.createGraftSourceHighlighter({
    loadRuntime: async () => runtime,
  });

  const result = await highlighter.highlight({
    path: 'src/app.ts',
    text: 'const local = true;\nexport const ready = local;\n',
    startLine: 1,
    lineCount: 2,
    headId: 'head-1',
    tick: 7,
  });

  assert.equal(parserReady, true);
  assert.deepEqual(request, {
    filePath: 'src/app.ts',
    content: 'const local = true;\nexport const ready = local;\n',
    options: {
      basis: { kind: 'editor_head', headId: 'head-1', tick: 7 },
      viewport: {
        start: { row: 1, column: 0 },
        end: { row: 3, column: 0 },
      },
    },
  });
  assert.equal(result.path, 'src/app.ts');
  assert.equal(result.partial, false);
  assert.equal(result.spans.length, 2);
  assert.equal(result.spans[0].role, port.SOURCE_HIGHLIGHT_ROLE.Keyword);
  assert.deepEqual(result.spans[0].range, {
    start: { row: 1, column: 0 },
    end: { row: 1, column: 6 },
  });
  assert.equal(result.spans[1].role, port.SOURCE_HIGHLIGHT_ROLE.Variable);
});

test('Graft source highlighter dependency includes released Colorful prose support', async () => {
  await ensureDistBuilt();

  assert.equal(
    semverAtLeast(readGraftPackageVersion(), GRAFT_COLORFUL_PROSE_MINIMUM_VERSION),
    true,
  );
  const graft = await import('@flyingrobots/graft');
  assert.equal(typeof graft.createColorfulCliProseProjector, 'function');
  assert.equal(graft.COLORFUL_CLI_MINIMUM_VERSION, GRAFT_COLORFUL_CLI_MINIMUM_VERSION);
});

test('Graft source highlighter maps Colorful prose spans from text buffers', async () => {
  const { port, adapter } = await loadGraftSourceHighlighterModules();
  const runtime = {
    ensureParserReady: async () => undefined,
    createProjectionBundle: () => ({
      syntax: {
        partial: false,
        spans: [
          {
            className: 'keyword',
            text: 'ship',
            range: { start: { row: 0, column: 0 }, end: { row: 0, column: 4 } },
          },
          {
            className: 'number',
            text: '7',
            range: { start: { row: 0, column: 10 }, end: { row: 0, column: 11 } },
          },
          {
            className: 'punctuation',
            text: '.',
            range: { start: { row: 0, column: 11 }, end: { row: 0, column: 12 } },
          },
          {
            className: 'string',
            text: '"clear"',
            range: { start: { row: 1, column: 0 }, end: { row: 1, column: 7 } },
          },
        ],
      },
    }),
  };

  const highlighter = adapter.createGraftSourceHighlighter({
    loadRuntime: async () => runtime,
  });

  const result = await highlighter.highlight({
    path: 'notes.txt',
    text: 'ship it in 7.\n"clear"\n',
    startLine: 0,
    lineCount: 2,
    headId: 'head-prose',
    tick: 9,
  });

  assert.equal(result.path, 'notes.txt');
  assert.equal(result.partial, false);
  assert.deepEqual(
    result.spans.map((span) => span.role),
    [
      port.SOURCE_HIGHLIGHT_ROLE.Keyword,
      port.SOURCE_HIGHLIGHT_ROLE.Number,
      port.SOURCE_HIGHLIGHT_ROLE.Punctuation,
      port.SOURCE_HIGHLIGHT_ROLE.String,
    ],
  );
});

test('Graft source highlighter returns a partial reading when projection throws', async () => {
  const { adapter } = await loadGraftSourceHighlighterModules();
  const highlighter = adapter.createGraftSourceHighlighter({
    loadRuntime: async () => ({
      ensureParserReady: async () => undefined,
      createProjectionBundle: () => {
        throw new Error(DIAGNOSTICS_FAILURE_MESSAGE);
      },
    }),
  });

  const result = await highlighter.highlight({
    path: 'notes.txt',
    text: PROSE_FIXTURE_TEXT,
    startLine: 0,
    lineCount: 1,
    headId: 'head-prose',
    tick: 9,
  });

  assert.equal(result.path, 'notes.txt');
  assert.equal(result.partial, true);
  assert.deepEqual(result.spans, []);
  assert.match(result.notice, new RegExp(DIAGNOSTICS_FAILURE_MESSAGE));
});

test('Graft source highlighter process runner normalizes missing CLI output streams', async () => {
  const { adapter } = await loadGraftSourceHighlighterModules();
  const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'jedit-missing-colorful-cli-'));
  const runner = adapter.createGraftSourceHighlighterProcessRunner();

  try {
    const result = runner.run({
      command: path.join(tempDirectory, MISSING_COLORFUL_CLI_NAME),
      args: ['--version'],
      cwd: REPO_ROOT,
      timeoutMs: MISSING_COLORFUL_TIMEOUT_MS,
      maxBufferBytes: MISSING_COLORFUL_MAX_BUFFER_BYTES,
    });

    assert.equal(result.status, null);
    assert.equal(result.stdout, '');
    assert.equal(result.stderr, '');
    assert.equal(result.error instanceof Error, true);
  } finally {
    fs.rmSync(tempDirectory, { recursive: true, force: true });
  }
});

test('Graft diagnostics report the parser, Graft, and Colorful CLI posture', async () => {
  const { adapter } = await loadGraftSourceHighlighterModules();
  const requests = [];
  const diagnostics = adapter.createGraftDiagnosticsPort({
    cwd: DIAGNOSTICS_CWD,
    command: DIAGNOSTICS_COMMAND,
    processRunner: {
      run(request) {
        requests.push(request);
        return Promise.resolve({
          status: 0,
          stdout: FAKE_COLORFUL_VERSION_OUTPUT,
          stderr: '',
        });
      },
    },
    loadRuntime: async () => ({
      GRAFT_VERSION: GRAFT_COLORFUL_NUMERIC_IR_MINIMUM_VERSION,
      COLORFUL_CLI_MINIMUM_VERSION: GRAFT_COLORFUL_CLI_MINIMUM_VERSION,
      isParserReady: () => false,
    }),
  });

  const report = await diagnostics.loadDiagnostics();

  assert.equal(report.title, 'Graft diagnostics');
  assert.equal(report.summary, 'Colorful prose projection is active.');
  assert.deepEqual(requests, [{
    command: DIAGNOSTICS_COMMAND,
    args: ['--version'],
    cwd: DIAGNOSTICS_CWD,
    timeoutMs: 5000,
      maxBufferBytes: 65536,
    }]);
  assert.deepEqual(
    report.rows.map((row) => [row.label, row.value, row.status]),
    [
      ['Graft package', GRAFT_COLORFUL_NUMERIC_IR_MINIMUM_VERSION, 'ok'],
      ['Parser runtime', 'cold', 'warn'],
      ['Colorful command', DIAGNOSTICS_COMMAND, 'ok'],
      ['Colorful minimum', GRAFT_COLORFUL_CLI_MINIMUM_VERSION, 'ok'],
      ['Colorful CLI', GRAFT_COLORFUL_CLI_MINIMUM_VERSION, 'ok'],
      ['Prose projection', 'active', 'ok'],
    ],
  );
});

test('Graft diagnostics report Colorful version probe and projection failures', async () => {
  const { adapter } = await loadGraftSourceHighlighterModules();
  const scenarios = [
    {
      name: 'nonzero',
      result: { status: 2, stdout: '', stderr: DIAGNOSTICS_NONZERO_ERROR },
      summary: 'Colorful prose projection is inactive.',
      row: ['Colorful CLI', 'unavailable', 'error', DIAGNOSTICS_NONZERO_ERROR],
    },
    {
      name: 'parse',
      result: { status: 0, stdout: DIAGNOSTICS_PARSE_OUTPUT, stderr: '' },
      summary: 'Colorful prose projection is inactive.',
      row: ['Colorful CLI', 'unavailable', 'error', DIAGNOSTICS_PARSE_OUTPUT],
    },
    {
      name: 'below-minimum',
      result: { status: 0, stdout: `colorful ${GRAFT_COLORFUL_CLI_BELOW_MINIMUM_VERSION}`, stderr: '' },
      summary: 'Colorful prose projection is inactive.',
      row: ['Prose projection', 'inactive', 'warn', GRAFT_COLORFUL_CLI_MINIMUM_VERSION],
    },
  ];

  for (const scenario of scenarios) {
    const diagnostics = adapter.createGraftDiagnosticsPort({
      cwd: DIAGNOSTICS_CWD,
      command: DIAGNOSTICS_COMMAND,
      processRunner: {
        run: async () => scenario.result,
      },
      loadRuntime: async () => ({
        GRAFT_VERSION: GRAFT_COLORFUL_NUMERIC_IR_MINIMUM_VERSION,
        COLORFUL_CLI_MINIMUM_VERSION: GRAFT_COLORFUL_CLI_MINIMUM_VERSION,
        isParserReady: () => true,
      }),
    });

    const report = await diagnostics.loadDiagnostics();
    const row = report.rows.find((candidate) => candidate.label === scenario.row[0]);

    assert.equal(report.summary, scenario.summary, scenario.name);
    assert.equal(row.value, scenario.row[1], scenario.name);
    assert.equal(row.status, scenario.row[2], scenario.name);
    assert.match(row.detail, new RegExp(scenario.row[3]), scenario.name);
  }
});

test('Graft diagnostics fail closed for malformed runtime minimum and old Graft support', async () => {
  const { adapter } = await loadGraftSourceHighlighterModules();
  const diagnostics = adapter.createGraftDiagnosticsPort({
    cwd: DIAGNOSTICS_CWD,
    command: DIAGNOSTICS_COMMAND,
    processRunner: {
      run: async () => ({
        status: 0,
        stdout: FAKE_COLORFUL_VERSION_OUTPUT,
        stderr: '',
      }),
    },
    loadRuntime: async () => ({
      GRAFT_VERSION: GRAFT_COLORFUL_PROSE_MINIMUM_VERSION,
      COLORFUL_CLI_MINIMUM_VERSION: GRAFT_MALFORMED_VERSION,
      isParserReady: () => true,
    }),
  });

  const report = await diagnostics.loadDiagnostics();
  const graftRow = report.rows.find((row) => row.label === 'Graft package');
  const minimumRow = report.rows.find((row) => row.label === 'Colorful minimum');
  const projectionRow = report.rows.find((row) => row.label === 'Prose projection');

  assert.equal(report.summary, 'Colorful prose projection is inactive.');
  assert.equal(graftRow.status, 'error');
  assert.match(graftRow.detail, new RegExp(GRAFT_COLORFUL_NUMERIC_IR_MINIMUM_VERSION));
  assert.equal(minimumRow.status, 'error');
  assert.match(minimumRow.detail, new RegExp(GRAFT_MALFORMED_VERSION));
  assert.equal(projectionRow.value, 'inactive');
  assert.equal(projectionRow.status, 'warn');
});

test('Graft diagnostics failedDiagnostics maps the failure request message', async () => {
  const { adapter } = await loadGraftSourceHighlighterModules();
  const diagnostics = adapter.createGraftDiagnosticsPort();

  const report = diagnostics.failedDiagnostics({ message: DIAGNOSTICS_FAILURE_MESSAGE });

  assert.equal(report.summary, 'Graft diagnostics failed.');
  assert.deepEqual(report.rows, [{
    label: 'Prose projection',
    value: 'unavailable',
    status: 'error',
    detail: DIAGNOSTICS_FAILURE_MESSAGE,
  }]);
});

test('Graft source highlighter uses Colorful CLI prose projection for text buffers by default', async () => {
  const { port, adapter } = await loadGraftSourceHighlighterModules();
  const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'jedit-colorful-cli-'));
  writeFakeColorfulCli(tempDirectory);

  try {
    await withPathPrefix(tempDirectory, async () => {
      const highlighter = adapter.createGraftSourceHighlighter();

      const result = await highlighter.highlight({
        path: 'notes.txt',
        text: PROSE_FIXTURE_TEXT,
        startLine: 0,
        lineCount: 1,
        headId: 'head-prose',
        tick: 10,
      });

      assert.equal(result.path, 'notes.txt');
      assert.equal(result.partial, false);
      assert.deepEqual(result.spans, [
        {
          role: port.SOURCE_HIGHLIGHT_ROLE.Keyword,
          range: {
            start: { row: 0, column: PROSE_KEYWORD_START_COLUMN },
            end: { row: 0, column: PROSE_KEYWORD_END_COLUMN },
          },
        },
        {
          role: port.SOURCE_HIGHLIGHT_ROLE.Number,
          range: {
            start: { row: 0, column: PROSE_NUMBER_START_COLUMN },
            end: { row: 0, column: PROSE_NUMBER_END_COLUMN },
          },
        },
      ]);
    });
  } finally {
    fs.rmSync(tempDirectory, { recursive: true, force: true });
  }
});

test('Graft source highlighter loads the published Graft package by default', async () => {
  const { port, adapter } = await loadGraftSourceHighlighterModules();
  const highlighter = adapter.createGraftSourceHighlighter();

  const result = await highlighter.highlight({
    path: 'src/app.ts',
    text: 'const ready = true;\n',
    startLine: 0,
    lineCount: 1,
    headId: 'head-1',
    tick: 8,
  });

  assert.equal(result.path, 'src/app.ts');
  assert.equal(result.partial, false);
  assert.equal(result.spans[0].role, port.SOURCE_HIGHLIGHT_ROLE.Keyword);
  assert.deepEqual(result.spans[0].range, {
    start: { row: 0, column: 0 },
    end: { row: 0, column: 5 },
  });
});
