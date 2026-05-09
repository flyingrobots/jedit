import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';

const REPO_ROOT = process.cwd();
const GRAFT_MCP_SESSION_PATH = path.join(REPO_ROOT, 'dist', 'adapters', 'graft-mcp-session.js');

async function loadGraftMcpSession() {
  const build = spawnSync(process.execPath, ['node_modules/typescript/bin/tsc', '-p', 'tsconfig.json'], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });

  assert.equal(build.status, 0, build.stderr || build.stdout);
  return import(pathToFileURL(GRAFT_MCP_SESSION_PATH).href);
}

test('Graft file outline decoder accepts runtime-validated outline payloads', async () => {
  const graft = await loadGraftMcpSession();
  const result = graft.decodeGraftFileOutlineResult({
    projection: 'ready',
    jumpTable: [
      {
        symbol: 'render',
        kind: 'function',
        start: 4,
        end: 12,
      },
    ],
  });

  assert.deepEqual(result, {
    projection: 'ready',
    jumpTable: [
      {
        symbol: 'render',
        kind: 'function',
        start: 4,
        end: 12,
      },
    ],
  });
});

test('Graft file outline decoder rejects malformed jump table entries', async () => {
  const graft = await loadGraftMcpSession();

  assert.throws(
    () => graft.decodeGraftFileOutlineResult({
      jumpTable: [
        {
          symbol: 'render',
          kind: 'function',
          start: '4',
          end: 12,
        },
      ],
    }),
    /jumpTable\[0\]\.start/,
  );
});

test('Graft diff decoder rejects malformed structural diff entries', async () => {
  const graft = await loadGraftMcpSession();

  assert.throws(
    () => graft.decodeGraftStructDiffResult({
      files: [
        {
          path: 'src/main.ts',
          summary: 'src/main.ts | changed',
          diff: {
            added: [{ kind: 'function', name: 'render' }],
            changed: [{ kind: 'class', name: 7 }],
            removed: [],
          },
        },
      ],
    }),
    /files\[0\]\.diff\.changed\[0\]\.name/,
  );
});
