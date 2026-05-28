import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';

const REPO_ROOT = process.cwd();
const TRANSPORT_MODULE_PATH = path.join(REPO_ROOT, 'dist', 'adapters', 'echo-wasm-kernel.js');

async function loadTransportModule() {
  const build = spawnSync(process.execPath, ['node_modules/typescript/bin/tsc', '-p', 'tsconfig.json'], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });

  assert.equal(build.status, 0, build.stderr || build.stdout);

  return import(pathToFileURL(TRANSPORT_MODULE_PATH).href);
}

test('echo wasm kernel transport stays byte-oriented and substrate-generic', async () => {
  const transportModule = await loadTransportModule();
  const calls = [];
  const fakeModule = {
    async default() {
      calls.push(['bootstrap']);
    },
    init() {
      calls.push(['init']);
      return new Uint8Array([0]);
    },
    dispatch_intent(bytes) {
      calls.push(['dispatch_intent', Array.from(bytes)]);
      return new Uint8Array([1, 2, 3]);
    },
    observe(bytes) {
      calls.push(['observe', Array.from(bytes)]);
      return new Uint8Array([4, 5, 6]);
    },
    scheduler_status() {
      calls.push(['scheduler_status']);
      return new Uint8Array([7, 8, 9]);
    },
    get_codec_id() {
      calls.push(['get_codec_id']);
      return 'codec:echo';
    },
    get_registry_version() {
      calls.push(['get_registry_version']);
      return 'registry:v1';
    },
    get_schema_sha256_hex() {
      calls.push(['get_schema_sha256_hex']);
      return 'deadbeef';
    },
  };

  const transport = await transportModule.createEchoWasmKernelTransport({
    moduleSpecifier: 'virtual:echo-wasm',
    moduleLoader: async (moduleSpecifier) => {
      calls.push(['moduleLoader', moduleSpecifier]);
      return fakeModule;
    },
  });

  assert.deepEqual(Array.from(transport.submitIntentBytes(new Uint8Array([9, 9]))), [1, 2, 3]);
  assert.deepEqual(Array.from(transport.observeBytes(new Uint8Array([8, 8]))), [4, 5, 6]);
  assert.deepEqual(Array.from(transport.schedulerStatusBytes()), [7, 8, 9]);
  assert.equal('dispatchControlIntentBytes' in transport, false);
  assert.deepEqual(transport.kernelInfo(), {
    moduleSpecifier: 'virtual:echo-wasm',
    codecId: 'codec:echo',
    registryVersion: 'registry:v1',
    schemaSha256Hex: 'deadbeef',
  });

  assert.deepEqual(calls, [
    ['moduleLoader', 'virtual:echo-wasm'],
    ['bootstrap'],
    ['init'],
    ['get_codec_id'],
    ['get_registry_version'],
    ['get_schema_sha256_hex'],
    ['dispatch_intent', [9, 9]],
    ['observe', [8, 8]],
    ['scheduler_status'],
  ]);
});

test('echo wasm kernel host transport keeps trusted control off the app surface', async () => {
  const transportModule = await loadTransportModule();
  const calls = [];
  const fakeModule = {
    init() {
      calls.push(['init']);
      return new Uint8Array([0]);
    },
    dispatch_intent(bytes) {
      calls.push(['dispatch_intent', Array.from(bytes)]);
      return new Uint8Array([1]);
    },
    dispatch_control_intent_trusted(bytes) {
      calls.push(['dispatch_control_intent_trusted', Array.from(bytes)]);
      return new Uint8Array([2]);
    },
    observe(bytes) {
      calls.push(['observe', Array.from(bytes)]);
      return new Uint8Array([3]);
    },
    scheduler_status() {
      calls.push(['scheduler_status']);
      return new Uint8Array([4]);
    },
  };

  const hostTransport = await transportModule.createEchoWasmKernelHostTransport({
    moduleSpecifier: 'virtual:echo-wasm',
    moduleLoader: async (moduleSpecifier) => {
      calls.push(['moduleLoader', moduleSpecifier]);
      return fakeModule;
    },
    bootstrapModule: false,
  });

  assert.equal('dispatchControlIntentBytes' in hostTransport.app, false);
  assert.deepEqual(Array.from(hostTransport.app.submitIntentBytes(new Uint8Array([9]))), [1]);
  assert.deepEqual(
    Array.from(hostTransport.trustedHost.dispatchControlIntentBytes(new Uint8Array([8]))),
    [2],
  );

  assert.deepEqual(calls, [
    ['moduleLoader', 'virtual:echo-wasm'],
    ['init'],
    ['dispatch_intent', [9]],
    ['dispatch_control_intent_trusted', [8]],
  ]);
});

test('echo wasm trusted host transport requires the raw trusted control export', async () => {
  const transportModule = await loadTransportModule();
  await assert.rejects(
    () => transportModule.createEchoWasmKernelHostTransport({
      moduleSpecifier: 'virtual:echo-wasm',
      moduleLoader: async () => ({
        dispatch_intent: () => new Uint8Array([1]),
        observe: () => new Uint8Array([2]),
        scheduler_status: () => new Uint8Array([3]),
      }),
      bootstrapModule: false,
      initializeKernel: false,
    }),
    /dispatch_control_intent_trusted/i,
  );
});

test('echo wasm kernel transport raises a transport error when a raw substrate method is missing', async () => {
  const transportModule = await loadTransportModule();
  const transport = await transportModule.createEchoWasmKernelTransport({
    moduleSpecifier: 'virtual:echo-wasm',
    moduleLoader: async () => ({
      observe: () => new Uint8Array([1]),
      scheduler_status: () => new Uint8Array([2]),
    }),
    bootstrapModule: false,
    initializeKernel: false,
  });

  assert.throws(
    () => transport.submitIntentBytes(new Uint8Array([1])),
    /dispatch_intent/i,
  );
});
