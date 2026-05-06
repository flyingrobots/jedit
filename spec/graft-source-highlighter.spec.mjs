import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';

const REPO_ROOT = process.cwd();
const PORT_PATH = path.join(REPO_ROOT, 'dist', 'ports', 'source-highlighter.js');
const ADAPTER_PATH = path.join(REPO_ROOT, 'dist', 'adapters', 'graft-source-highlighter.js');

async function loadGraftSourceHighlighterModules() {
  const build = spawnSync(process.execPath, ['node_modules/typescript/bin/tsc', '-p', 'tsconfig.json'], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });

  assert.equal(build.status, 0, build.stderr || build.stdout);

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
