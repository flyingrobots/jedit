import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { REPO_ROOT, importDist } from './dist-helpers.mjs';

let modulesPromise;

async function loadGraftApiSession() {
  if (modulesPromise == null) {
    modulesPromise = importGraftApiSession();
  }
  return modulesPromise;
}

async function importGraftApiSession() {
  const [graft, errors] = await Promise.all([
    importDist('adapters', 'graft-api-session.js'),
    importDist('domain', 'errors.js'),
  ]);
  return { graft, errors };
}

test('Graft file outline decoder accepts runtime-validated outline payloads', async () => {
  const { graft } = await loadGraftApiSession();
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
  const { graft } = await loadGraftApiSession();
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

test('Graft session labels dirty drawer data as stale saved-file projection', async () => {
  const { graft } = await loadGraftApiSession();
  const api = {
    createRepoLocalGraft: (options) => ({ cwd: options.cwd }),
    callGraftTool: async (_session, name) => {
      if (name === 'file_outline') {
        return {
          projection: 'ready',
          jumpTable: [],
        };
      }
      return { files: [] };
    },
  };
  const port = graft.createGraftSessionPort({ api });
  const info = await port.loadGraftInfo({
    workspaceRoot: REPO_ROOT,
    filePath: path.join(REPO_ROOT, 'notes.txt'),
    dirty: true,
  });

  assert.equal(info.projectionSource, 'saved-file');
  assert.equal(info.projectionPosture, 'stale');
  assert.equal(info.notice, 'saved file only; unsaved buffer edits not included');
});

test('Graft file outline decoder rejects malformed jump table entries', async () => {
  const { graft } = await loadGraftApiSession();

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
  const { graft } = await loadGraftApiSession();

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

test('Graft tool parser extracts text content blocks and rejects missing text payloads', async () => {
  const { graft, errors } = await loadGraftApiSession();

  assert.deepEqual(graft.parseGraftToolResult({
    content: [{
      type: 'text',
      text: JSON.stringify({
        projection: 'ready',
        jumpTable: [],
      }),
    }],
  }), {
    projection: 'ready',
    jumpTable: [],
  });
  assert.throws(
    () => graft.parseGraftToolResult({
      content: [{
        type: 'image',
        text: JSON.stringify({ ignored: true }),
      }],
    }),
    errors.GraftInvalidPayloadError,
  );
});
