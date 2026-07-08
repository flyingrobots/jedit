import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { REPO_ROOT, importDist } from './dist-helpers.mjs';

const TARGET_PROFILE_DIGEST = 'sha256:1111111111111111111111111111111111111111111111111111111111111111';
const CORE_DIGEST = 'sha256:2222222222222222222222222222222222222222222222222222222222222222';
const TARGET_IR_DIGEST = 'sha256:3333333333333333333333333333333333333333333333333333333333333333';
const WIDE_REVIEW_PAYLOAD_KEY_COUNT = 70;
const REVIEW_PAYLOAD_TEST_SCAN_LIMIT = 64;
const REVIEW_PAYLOAD_OMITTED_KEY = '$jeditReviewPayloadOmitted';
const LONG_REVIEW_PAYLOAD_TEXT_LIMIT = 96;

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

function deepArrayReviewPayload() {
  return {
    apiVersion: 'edict.core/v1',
    chain: [[[[['too deep']]]]],
  };
}

function rootWideObjectReviewPayload() {
  return wideReviewObject('root');
}

function rootWideObjectReviewPayloadWithOmittedKey() {
  return {
    [REVIEW_PAYLOAD_OMITTED_KEY]: 'provider data',
    ...wideReviewObject('root'),
  };
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

function arrayAccessorReviewPayload() {
  const items = new Array(1);
  Object.defineProperty(items, '0', {
    enumerable: true,
    get: () => {
      throw new Error('review payload array accessors must not run');
    },
  });
  return { items };
}

function longTextReviewPayload() {
  return {
    [`long${'k'.repeat(160)}`]: 'v'.repeat(160),
    nested: {
      value: 'w'.repeat(160),
    },
  };
}

function duplicateCappedLongKeyReviewPayload() {
  const sharedPrefix = `duplicate${'k'.repeat(160)}`;
  return {
    [`${sharedPrefix}A`]: 'first',
    [`${sharedPrefix}B`]: 'second',
  };
}

function unsupportedValueReviewPayload() {
  return {
    explicitNull: null,
    missing: undefined,
    callback: () => true,
    token: Symbol('provider-token'),
    count: BigInt(1),
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

function reviewPayloadWithThrowingPrototypeEnumeration() {
  const protoTarget = {};
  for (let index = 0; index < WIDE_REVIEW_PAYLOAD_KEY_COUNT; index += 1) {
    protoTarget[`inherited${String(index).padStart(2, '0')}`] = index;
  }
  let descriptorCount = 0;
  const proto = new Proxy(protoTarget, {
    getOwnPropertyDescriptor: (target, key) => {
      descriptorCount += 1;
      if (descriptorCount > REVIEW_PAYLOAD_TEST_SCAN_LIMIT) {
        throw new Error('review payload prototype traversal exceeded bound');
      }
      return Object.getOwnPropertyDescriptor(target, key);
    },
  });
  const review = Object.create(proto);
  review.apiVersion = 'edict.core/v1';
  return review;
}

function apiWithReviewPayload(review) {
  return {
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
            review,
          },
        },
      }),
      dispose: () => undefined,
    }),
  };
}

async function loadInfoForReviewPayload(review) {
  const graft = await loadGraftApiSession();
  const port = graft.createGraftSessionPort({ api: apiWithReviewPayload(review) });
  return port.loadGraftInfo({
    workspaceRoot: REPO_ROOT,
    filePath: path.join(REPO_ROOT, 'demo.edict'),
    dirty: true,
    sourceText: 'package demo.echo@1;',
  });
}

test('Graft session bounds nested array review payloads before rendering', async () => {
  const info = await loadInfoForReviewPayload(deepArrayReviewPayload());

  assert.equal(info.projectionLanes?.[0]?.reviewPayload.apiVersion, 'edict.core/v1');
  assert.match(info.projectionLanes?.[0]?.reviewPayload.chain[0][0][0][0], /depth omitted/);
});

test('Graft session preserves omission markers for root review payload objects', async () => {
  const info = await loadInfoForReviewPayload(rootWideObjectReviewPayload());

  const payload = info.projectionLanes?.[0]?.reviewPayload;
  assert.equal(Object.keys(payload).length, 64);
  assert.equal(Object.hasOwn(payload, REVIEW_PAYLOAD_OMITTED_KEY), true);
  assert.equal(Object.hasOwn(payload, 'root63'), false);
});

test('Graft session preserves provider data when adding omission markers', async () => {
  const info = await loadInfoForReviewPayload(rootWideObjectReviewPayloadWithOmittedKey());

  const payload = info.projectionLanes?.[0]?.reviewPayload;
  const omissionKeys = Object.keys(payload)
    .filter((key) => key.startsWith(REVIEW_PAYLOAD_OMITTED_KEY) && key !== REVIEW_PAYLOAD_OMITTED_KEY);
  assert.equal(payload[REVIEW_PAYLOAD_OMITTED_KEY], 'provider data');
  assert.equal(omissionKeys.length, 1);
  assert.match(payload[omissionKeys[0]], /review payload omitted by adapter bounds/);
});

test('Graft session preserves omission markers for nested review payload objects', async () => {
  const info = await loadInfoForReviewPayload(nestedWideObjectReviewPayload());

  const payload = info.projectionLanes?.[0]?.reviewPayload;
  assert.equal(Object.keys(payload.nested.wide).length, 64);
  assert.equal(Object.hasOwn(payload.nested.wide, REVIEW_PAYLOAD_OMITTED_KEY), true);
  assert.equal(Object.hasOwn(payload.nested.wide, 'nested63'), false);
});

test('Graft session preserves omission markers for wide review payload arrays', async () => {
  const info = await loadInfoForReviewPayload(arrayReviewPayload());

  assert.deepEqual(info.projectionLanes?.[0]?.reviewPayload.items.slice(0, 3), ['a', 'b', 'c']);
  assert.match(info.projectionLanes?.[0]?.reviewPayload.items[3], /3 more entries/);
});

test('Graft session omits provider review payload array accessors without invoking them', async () => {
  const info = await loadInfoForReviewPayload(arrayAccessorReviewPayload());

  assert.equal(info.error, undefined);
  assert.match(info.projectionLanes?.[0]?.reviewPayload.items[0], /accessor omitted/);
});

test('Graft session caps provider review payload keys and strings before storing lanes', async () => {
  const info = await loadInfoForReviewPayload(longTextReviewPayload());

  const payload = info.projectionLanes?.[0]?.reviewPayload;
  const cappedKey = Object.keys(payload)
    .find((key) => key.startsWith('long'));
  assert.equal(cappedKey?.length, LONG_REVIEW_PAYLOAD_TEXT_LIMIT + 3);
  assert.equal(cappedKey?.endsWith('...'), true);
  assert.equal(payload[cappedKey], `${'v'.repeat(LONG_REVIEW_PAYLOAD_TEXT_LIMIT)}...`);
  assert.equal(payload.nested.value, `${'w'.repeat(LONG_REVIEW_PAYLOAD_TEXT_LIMIT)}...`);
});

test('Graft session keeps duplicate capped review payload keys within storage cap', async () => {
  const info = await loadInfoForReviewPayload(duplicateCappedLongKeyReviewPayload());

  const payload = info.projectionLanes?.[0]?.reviewPayload;
  const keys = Object.keys(payload);
  assert.equal(keys.length, 2);
  assert.equal(keys.every((key) => key.length <= LONG_REVIEW_PAYLOAD_TEXT_LIMIT + 3), true);
  assert.deepEqual(Object.values(payload).sort(), ['first', 'second']);
});

test('Graft session marks unsupported provider review payload values', async () => {
  const info = await loadInfoForReviewPayload(unsupportedValueReviewPayload());

  const payload = info.projectionLanes?.[0]?.reviewPayload;
  assert.equal(payload.explicitNull, null);
  assert.match(payload.missing, /unsupported value/);
  assert.match(payload.callback, /unsupported value/);
  assert.match(payload.token, /unsupported value/);
  assert.match(payload.count, /unsupported value/);
});

test('Graft session reports budget omissions separately from depth omissions', async () => {
  const info = await loadInfoForReviewPayload(budgetExhaustingReviewPayload());

  const payloadText = JSON.stringify(info.projectionLanes?.[0]?.reviewPayload);
  assert.match(payloadText, /review payload omitted by adapter bounds/);
  assert.doesNotMatch(payloadText, /review payload depth omitted/);
});

test('Graft session copies provider review payload proto keys as data', async () => {
  const info = await loadInfoForReviewPayload(reviewPayloadWithProtoKey());

  assert.equal(Object.hasOwn(info.projectionLanes?.[0]?.reviewPayload, '__proto__'), true);
  assert.equal(info.projectionLanes?.[0]?.reviewPayload.__proto__, 'provider data');
});

test('Graft session omits provider review payload accessors without invoking them', async () => {
  const info = await loadInfoForReviewPayload(reviewPayloadWithThrowingAccessor());

  assert.equal(info.error, undefined);
  assert.equal(info.projectionLanes?.[0]?.reviewPayload.apiVersion, 'edict.core/v1');
  assert.match(info.projectionLanes?.[0]?.reviewPayload.computed, /accessor omitted/);
});

test('Graft session bounds inherited prototype key traversal', async () => {
  const info = await loadInfoForReviewPayload(reviewPayloadWithThrowingPrototypeEnumeration());

  assert.equal(info.error, undefined);
  assert.equal(info.projectionLanes?.[0]?.reviewPayload.apiVersion, 'edict.core/v1');
  assert.equal(Object.hasOwn(info.projectionLanes?.[0]?.reviewPayload, 'inherited00'), false);
  assert.equal(Object.hasOwn(info.projectionLanes?.[0]?.reviewPayload, REVIEW_PAYLOAD_OMITTED_KEY), false);
});
