import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';

const REPO_ROOT = process.cwd();
const GRAFT_API_SESSION_PATH = path.join(REPO_ROOT, 'dist', 'adapters', 'graft-api-session.js');

async function loadGraftApiSession() {
  const build = spawnSync(process.execPath, ['node_modules/typescript/bin/tsc', '-p', 'tsconfig.json'], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });

  assert.equal(build.status, 0, build.stderr || build.stdout);
  return import(pathToFileURL(GRAFT_API_SESSION_PATH).href);
}

test('Graft file outline decoder accepts runtime-validated outline payloads', async () => {
  const graft = await loadGraftApiSession();
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

test('Graft session port uses the direct API without a close lifecycle', async () => {
  const graft = await loadGraftApiSession();
  const created = [];
  const calls = [];
  const api = {
    createRepoLocalGraft: (options) => {
      const session = { cwd: options.cwd };
      created.push(session);
      return session;
    },
    callGraftTool: async (session, name, args) => {
      calls.push({ session, name, args });
      if (name === 'file_outline') {
        return {
          projection: 'ready',
          jumpTable: [{
            symbol: 'render',
            kind: 'function',
            start: 4,
            end: 12,
          }],
        };
      }
      return {
        files: [{
          path: 'src/main.ts',
          summary: 'src/main.ts | changed',
          diff: {
            added: [{ kind: 'function', name: 'render' }],
            changed: [],
            removed: [],
          },
        }],
      };
    },
  };
  const port = graft.createGraftSessionPort({ api });
  const filePath = path.join(REPO_ROOT, 'src', 'main.ts');

  const info = await port.loadGraftInfo({
    workspaceRoot: REPO_ROOT,
    filePath,
    dirty: false,
  });
  await port.closeConnection();

  assert.deepEqual(created, [{ cwd: REPO_ROOT }]);
  assert.deepEqual(calls.map((call) => ({
    session: call.session,
    name: call.name,
    args: call.args,
  })), [
    { session: created[0], name: 'file_outline', args: { path: 'src/main.ts' } },
    { session: created[0], name: 'graft_diff', args: { path: 'src/main.ts' } },
  ]);
  assert.deepEqual(info.outlineItems, [{
    kind: 'function',
    name: 'render',
    startLine: 4,
    endLine: 12,
  }]);
  assert.deepEqual(info.changeLines, [
    'changed',
    '+ function render',
  ]);
});

test('Graft file outline decoder rejects malformed jump table entries', async () => {
  const graft = await loadGraftApiSession();

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
  const graft = await loadGraftApiSession();

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
