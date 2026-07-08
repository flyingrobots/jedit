import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { REPO_ROOT, importDist } from './dist-helpers.mjs';

const TARGET_PROFILE_DIGEST = 'sha256:1111111111111111111111111111111111111111111111111111111111111111';
const CORE_DIGEST = 'sha256:2222222222222222222222222222222222222222222222222222222222222222';
const TARGET_IR_DIGEST = 'sha256:3333333333333333333333333333333333333333333333333333333333333333';
const WIDE_REVIEW_PAYLOAD_KEY_COUNT = 70;
const REVIEW_PAYLOAD_OMITTED_KEY = '$jeditReviewPayloadOmitted';

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

function rootWideObjectReviewPayload() {
  return wideReviewObject('root');
}

function nestedWideObjectReviewPayload() {
  return {
    nested: {
      wide: wideReviewObject('nested'),
    },
  };
}

function wideReviewObject(prefix) {
  const result = {};
  for (let index = 0; index < WIDE_REVIEW_PAYLOAD_KEY_COUNT; index += 1) {
    result[`${prefix}${String(index).padStart(2, '0')}`] = index;
  }
  return result;
}

function arrayReviewPayload() {
  return {
    items: ['a', 'b', 'c', 'd', 'e', 'f'],
  };
}

function budgetExhaustingReviewPayload() {
  const review = { preface: true };
  for (let parentIndex = 0; parentIndex < 63; parentIndex += 1) {
    const child = {};
    for (let childIndex = 0; childIndex < WIDE_REVIEW_PAYLOAD_KEY_COUNT; childIndex += 1) {
      child[`child${String(parentIndex).padStart(2, '0')}${String(childIndex).padStart(2, '0')}`] = {};
    }
    review[`parent${String(parentIndex).padStart(2, '0')}`] = child;
  }
  return review;
}

function reviewPayloadWithProtoKey() {
  const review = {};
  Object.defineProperty(review, '__proto__', {
    enumerable: true,
    value: 'provider data',
  });
  return review;
}

function reviewPayloadWithThrowingAccessor() {
  const review = { apiVersion: 'edict.core/v1' };
  Object.defineProperty(review, 'computed', {
    enumerable: true,
    get: () => {
      throw new Error('review payload accessors must not run');
    },
  });
  return review;
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

  assert.equal(info.projectionLanes?.[0]?.reviewPayload.apiVersion, 'edict.core/v1');
  assert.match(info.projectionLanes?.[0]?.reviewPayload.chain[0][0][0][0], /depth omitted/);
});

test('Graft session preserves omission markers for root review payload objects', async () => {
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
            review: rootWideObjectReviewPayload(),
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

  const payload = info.projectionLanes?.[0]?.reviewPayload;
  assert.equal(Object.keys(payload).length, 64);
  assert.equal(Object.hasOwn(payload, REVIEW_PAYLOAD_OMITTED_KEY), true);
  assert.equal(Object.hasOwn(payload, 'root63'), false);
});

test('Graft session preserves omission markers for nested review payload objects', async () => {
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
            review: nestedWideObjectReviewPayload(),
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

  const payload = info.projectionLanes?.[0]?.reviewPayload;
  assert.equal(Object.keys(payload.nested.wide).length, 64);
  assert.equal(Object.hasOwn(payload.nested.wide, REVIEW_PAYLOAD_OMITTED_KEY), true);
  assert.equal(Object.hasOwn(payload.nested.wide, 'nested63'), false);
});

test('Graft session preserves omission markers for wide review payload arrays', async () => {
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
            review: arrayReviewPayload(),
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

  assert.deepEqual(info.projectionLanes?.[0]?.reviewPayload.items.slice(0, 3), ['a', 'b', 'c']);
  assert.match(info.projectionLanes?.[0]?.reviewPayload.items[3], /3 more entries/);
});

test('Graft session reports budget omissions separately from depth omissions', async () => {
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
            review: budgetExhaustingReviewPayload(),
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

  const payloadText = JSON.stringify(info.projectionLanes?.[0]?.reviewPayload);
  assert.match(payloadText, /review payload omitted by adapter bounds/);
  assert.doesNotMatch(payloadText, /review payload depth omitted/);
});

test('Graft session copies provider review payload proto keys as data', async () => {
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
            review: reviewPayloadWithProtoKey(),
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

  assert.equal(Object.hasOwn(info.projectionLanes?.[0]?.reviewPayload, '__proto__'), true);
  assert.equal(info.projectionLanes?.[0]?.reviewPayload.__proto__, 'provider data');
});

test('Graft session omits provider review payload accessors without invoking them', async () => {
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
            review: reviewPayloadWithThrowingAccessor(),
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
  assert.equal(info.projectionLanes?.[0]?.reviewPayload.apiVersion, 'edict.core/v1');
  assert.match(info.projectionLanes?.[0]?.reviewPayload.computed, /accessor omitted/);
});
