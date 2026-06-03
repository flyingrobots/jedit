import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';
import { REPO_ROOT, ensureDistBuilt } from './dist-helpers.mjs';

const LIFECYCLE_MODULE_PATH = path.join(REPO_ROOT, 'dist', 'adapters', 'echo-runtime-lifecycle.js');
const CYCLE_LIMIT = 7;
const TICK_INTERVAL_SECONDS = 1 / 60;
const START_REQUEST_BYTES = Object.freeze([13, 14, 15]);
const START_RESPONSE_BYTES = Object.freeze([16, 17, 18]);
const REQUEST_BYTES = Object.freeze([1, 2, 3]);
const RESPONSE_BYTES = Object.freeze([4, 5, 6]);
const STOP_REQUEST_BYTES = Object.freeze([7, 8, 9]);
const STOP_RESPONSE_BYTES = Object.freeze([10, 11, 12]);

async function loadLifecycleModule() {
  await ensureDistBuilt();

  return import(pathToFileURL(LIFECYCLE_MODULE_PATH).href);
}

test('trusted Echo lifecycle port requests start cadence without exposing tick injection', async () => {
  const lifecycleModule = await loadLifecycleModule();
  const calls = [];
  const lifecycle = lifecycleModule.createTrustedEchoRuntimeLifecyclePort({
    trustedHost: {
      dispatchControlIntentBytes(bytes) {
        calls.push(['trusted-control', Array.from(bytes)]);
        return Uint8Array.from(START_RESPONSE_BYTES);
      },
    },
    codec: {
      encodeStartRequest(request) {
        calls.push(['encode-start', request.tickIntervalSeconds]);
        return Uint8Array.from(START_REQUEST_BYTES);
      },
      decodeStartResponse(bytes) {
        calls.push(['decode-start', Array.from(bytes)]);
        return {
          accepted: true,
          lastRunCompletion: 'started',
        };
      },
      encodeRunUntilIdleRequest() {
        return Uint8Array.from(REQUEST_BYTES);
      },
      decodeRunUntilIdleResponse() {
        return {
          accepted: true,
          lastRunCompletion: 'quiesced',
        };
      },
      encodeStopRequest() {
        return Uint8Array.from(STOP_REQUEST_BYTES);
      },
      decodeStopResponse() {
        return {
          accepted: true,
          lastRunCompletion: 'stopped',
        };
      },
    },
  });

  assert.deepEqual(
    lifecycle.requestStart({ tickIntervalSeconds: TICK_INTERVAL_SECONDS }),
    {
      accepted: true,
      lastRunCompletion: 'started',
    },
  );
  assert.equal('tick' in lifecycle, false);
  assert.equal('stepTick' in lifecycle, false);
  assert.equal('advanceTick' in lifecycle, false);
  assert.deepEqual(calls, [
    ['encode-start', TICK_INTERVAL_SECONDS],
    ['trusted-control', START_REQUEST_BYTES],
    ['decode-start', START_RESPONSE_BYTES],
  ]);
});

test('trusted Echo lifecycle port requests run-until-idle without exposing tick injection', async () => {
  const lifecycleModule = await loadLifecycleModule();
  const calls = [];
  const lifecycle = lifecycleModule.createTrustedEchoRuntimeLifecyclePort({
    trustedHost: {
      dispatchControlIntentBytes(bytes) {
        calls.push(['trusted-control', Array.from(bytes)]);
        return Uint8Array.from(RESPONSE_BYTES);
      },
    },
    codec: {
      encodeStartRequest() {
        return Uint8Array.from(START_REQUEST_BYTES);
      },
      decodeStartResponse() {
        return {
          accepted: true,
          lastRunCompletion: 'started',
        };
      },
      encodeRunUntilIdleRequest(request) {
        calls.push(['encode-run-until-idle', request.cycleLimit]);
        return Uint8Array.from(REQUEST_BYTES);
      },
      decodeRunUntilIdleResponse(bytes) {
        calls.push(['decode-run-until-idle', Array.from(bytes)]);
        return {
          accepted: true,
          lastRunCompletion: 'quiesced',
        };
      },
      encodeStopRequest() {
        calls.push(['encode-stop']);
        return Uint8Array.from(STOP_REQUEST_BYTES);
      },
      decodeStopResponse(bytes) {
        calls.push(['decode-stop', Array.from(bytes)]);
        return {
          accepted: true,
          lastRunCompletion: 'stopped',
        };
      },
    },
  });

  assert.deepEqual(
    lifecycle.requestRunUntilIdle({ cycleLimit: CYCLE_LIMIT }),
    {
      accepted: true,
      lastRunCompletion: 'quiesced',
    },
  );
  assert.equal('tick' in lifecycle, false);
  assert.equal('stepTick' in lifecycle, false);
  assert.equal('advanceTick' in lifecycle, false);
  assert.deepEqual(calls, [
    ['encode-run-until-idle', CYCLE_LIMIT],
    ['trusted-control', REQUEST_BYTES],
    ['decode-run-until-idle', RESPONSE_BYTES],
  ]);
});

test('trusted Echo lifecycle port requests stop through trusted control only', async () => {
  const lifecycleModule = await loadLifecycleModule();
  const calls = [];
  const lifecycle = lifecycleModule.createTrustedEchoRuntimeLifecyclePort({
    trustedHost: {
      dispatchControlIntentBytes(bytes) {
        calls.push(['trusted-control', Array.from(bytes)]);
        return Uint8Array.from(STOP_RESPONSE_BYTES);
      },
    },
    codec: {
      encodeStartRequest() {
        return Uint8Array.from(START_REQUEST_BYTES);
      },
      decodeStartResponse() {
        return {
          accepted: true,
          lastRunCompletion: 'started',
        };
      },
      encodeRunUntilIdleRequest() {
        return Uint8Array.from(REQUEST_BYTES);
      },
      decodeRunUntilIdleResponse() {
        return {
          accepted: true,
          lastRunCompletion: 'quiesced',
        };
      },
      encodeStopRequest() {
        calls.push(['encode-stop']);
        return Uint8Array.from(STOP_REQUEST_BYTES);
      },
      decodeStopResponse(bytes) {
        calls.push(['decode-stop', Array.from(bytes)]);
        return {
          accepted: true,
          lastRunCompletion: 'stopped',
        };
      },
    },
  });

  assert.deepEqual(
    lifecycle.requestStop(),
    {
      accepted: true,
      lastRunCompletion: 'stopped',
    },
  );
  assert.equal('tick' in lifecycle, false);
  assert.deepEqual(calls, [
    ['encode-stop'],
    ['trusted-control', STOP_REQUEST_BYTES],
    ['decode-stop', STOP_RESPONSE_BYTES],
  ]);
});

test('trusted Echo lifecycle port keeps app transport out of lifecycle authority', async () => {
  const lifecycleModule = await loadLifecycleModule();
  const lifecycle = lifecycleModule.createTrustedEchoRuntimeLifecyclePort({
    trustedHost: {
      dispatchControlIntentBytes() {
        return Uint8Array.from(RESPONSE_BYTES);
      },
    },
    codec: {
      encodeStartRequest() {
        return Uint8Array.from(START_REQUEST_BYTES);
      },
      decodeStartResponse() {
        return {
          accepted: true,
          lastRunCompletion: 'started',
        };
      },
      encodeRunUntilIdleRequest() {
        return Uint8Array.from(REQUEST_BYTES);
      },
      decodeRunUntilIdleResponse() {
        return {
          accepted: true,
          lastRunCompletion: 'quiesced',
        };
      },
      encodeStopRequest() {
        return Uint8Array.from(STOP_REQUEST_BYTES);
      },
      decodeStopResponse() {
        return {
          accepted: true,
          lastRunCompletion: 'stopped',
        };
      },
    },
  });

  assert.equal('submitIntentBytes' in lifecycle, false);
  assert.equal('observeBytes' in lifecycle, false);
  assert.equal('schedulerStatusBytes' in lifecycle, false);
});
