import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { REPO_ROOT, importDist } from './dist-helpers.mjs';

const TARGET_PROFILE_DIGEST = 'sha256:1111111111111111111111111111111111111111111111111111111111111111';
const CORE_DIGEST = 'sha256:2222222222222222222222222222222222222222222222222222222222222222';
const TARGET_IR_DIGEST = 'sha256:3333333333333333333333333333333333333333333333333333333333333333';

async function loadGraftApiSession() {
  return importDist('adapters', 'graft-api-session.js');
}

function availableEdictProjection() {
  return {
    language: 'edict',
    name: 'demo.edict',
    basis: null,
    syntax: { state: 'not_requested' },
    diagnostics: { items: [] },
    core: {
      state: 'available',
      value: {
        digest: CORE_DIGEST,
        review: {
          apiVersion: 'edict.core/v1',
          module: { name: 'demo.echo' },
        },
      },
    },
    targetIr: {
      state: 'available',
      value: {
        domain: 'echo.span-ir/v1',
        target: {
          coordinate: 'echo.dpo@1',
          digest: TARGET_PROFILE_DIGEST,
        },
        digest: TARGET_IR_DIGEST,
        review: {
          intents: {
            replaceThing: { effect: 'target.replace' },
          },
        },
      },
    },
    echoReceipt: { state: 'not_requested' },
    status: {
      status: 'ok',
      checked: 1,
      errors: 0,
      exitCode: 0,
    },
  };
}

function reviewObjectWithThrowingJsonHook() {
  const review = {
    apiVersion: 'edict.core/v1',
    module: { name: 'demo.echo' },
  };
  Object.defineProperty(review, 'toJSON', {
    enumerable: false,
    value: () => {
      throw new Error('review payload should not be cloned through JSON');
    },
  });
  return review;
}

function deepArrayReviewPayload() {
  return {
    apiVersion: 'edict.core/v1',
    chain: [[[[['too deep']]]]],
  };
}

test('Graft session carries Edict review payloads into generic projection lanes', async () => {
  const graft = await loadGraftApiSession();
  const api = {
    createRepoLocalGraft: (options) => ({ cwd: options.cwd }),
    callGraftTool: async (_session, name) => name === 'file_outline'
      ? { projection: 'ready', jumpTable: [] }
      : { files: [] },
    createEdictCliProjectionProvider: () => ({ providerId: 'edict-provider' }),
    createStructuredBuffer: () => ({
      edictProjection: () => availableEdictProjection(),
      dispose: () => undefined,
    }),
  };
  const port = graft.createGraftSessionPort({ api });

  const info = await port.loadGraftInfo({
    workspaceRoot: REPO_ROOT,
    filePath: path.join(REPO_ROOT, 'demo.edict'),
    dirty: true,
    sourceText: 'package demo.echo@1;',
  });

  assert.deepEqual(info.projectionLanes?.map((lane) => lane.reviewPayload), [{
    apiVersion: 'edict.core/v1',
    module: { name: 'demo.echo' },
  }, {
    intents: {
      replaceThing: { effect: 'target.replace' },
    },
  }]);
});

test('Graft session does not JSON-clone provider review payloads', async () => {
  const graft = await loadGraftApiSession();
  const api = {
    createRepoLocalGraft: (options) => ({ cwd: options.cwd }),
    callGraftTool: async (_session, name) => name === 'file_outline'
      ? { projection: 'ready', jumpTable: [] }
      : { files: [] },
    createEdictCliProjectionProvider: () => ({ providerId: 'edict-provider' }),
    createStructuredBuffer: () => ({
      edictProjection: () => ({
        ...availableEdictProjection(),
        core: {
          state: 'available',
          value: {
            digest: CORE_DIGEST,
            review: reviewObjectWithThrowingJsonHook(),
          },
        },
      }),
      dispose: () => undefined,
    }),
  };
  const port = graft.createGraftSessionPort({ api });

  const info = await port.loadGraftInfo({
    workspaceRoot: REPO_ROOT,
    filePath: path.join(REPO_ROOT, 'demo.edict'),
    dirty: true,
    sourceText: 'package demo.echo@1;',
  });

  assert.equal(info.error, undefined);
  assert.deepEqual(info.projectionLanes?.[0]?.reviewPayload, {
    apiVersion: 'edict.core/v1',
    module: { name: 'demo.echo' },
  });
});

test('Graft session bounds nested array review payloads before rendering', async () => {
  const graft = await loadGraftApiSession();
  const api = {
    createRepoLocalGraft: (options) => ({ cwd: options.cwd }),
    callGraftTool: async (_session, name) => name === 'file_outline'
      ? { projection: 'ready', jumpTable: [] }
      : { files: [] },
    createEdictCliProjectionProvider: () => ({ providerId: 'edict-provider' }),
    createStructuredBuffer: () => ({
      edictProjection: () => ({
        ...availableEdictProjection(),
        core: {
          state: 'available',
          value: {
            digest: CORE_DIGEST,
            review: deepArrayReviewPayload(),
          },
        },
      }),
      dispose: () => undefined,
    }),
  };
  const port = graft.createGraftSessionPort({ api });

  const info = await port.loadGraftInfo({
    workspaceRoot: REPO_ROOT,
    filePath: path.join(REPO_ROOT, 'demo.edict'),
    dirty: true,
    sourceText: 'package demo.echo@1;',
  });

  assert.deepEqual(info.projectionLanes?.[0]?.reviewPayload, {
    apiVersion: 'edict.core/v1',
    chain: [[[[]]]],
  });
});
