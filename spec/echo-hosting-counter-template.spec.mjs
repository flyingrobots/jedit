import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';

const REPO_ROOT = process.cwd();
const COUNTER_MODULE_PATH = path.join(REPO_ROOT, 'dist', 'app', 'echo-hosting-counter-template.js');
const HASH_MODULE_PATH = path.join(REPO_ROOT, 'dist', 'adapters', 'hash.js');
const COUNTER_SOURCE_PATH = path.join(REPO_ROOT, 'src', 'app', 'echo-hosting-counter-template.ts');
const COUNTER_SCHEMA_PATH = path.join(REPO_ROOT, 'contracts', 'fixtures', 'counter.graphql');
const INCREMENT_AMOUNT = 3;

let modulesPromise;

test('counter template follows package mutation query state shape', async () => {
  const modules = await loadModules();
  const hash = modules.hash.createHashPort();
  const statePort = modules.counter.createInMemoryCounterTemplateStatePort();
  const descriptor = modules.counter.createCounterTemplatePackageDescriptor();
  const receipt = modules.counter.incrementCounterTemplate(statePort, {
    amount: INCREMENT_AMOUNT,
  }, hash);
  const reading = modules.counter.observeCounterTemplateValue(statePort, hash);

  assert.equal(descriptor.packageId, modules.counter.COUNTER_TEMPLATE_PACKAGE_ID);
  assert.deepEqual(descriptor.mutationOperationNames, [modules.counter.COUNTER_TEMPLATE_INCREMENT_OPERATION]);
  assert.deepEqual(descriptor.queryOperationNames, [modules.counter.COUNTER_TEMPLATE_VALUE_QUERY]);
  assert.equal(receipt.value, INCREMENT_AMOUNT);
  assert.equal(reading.value, INCREMENT_AMOUNT);
});

test('counter template does not import jedit product modules', () => {
  const source = readFileSync(COUNTER_SOURCE_PATH, 'utf8');
  assert.doesNotMatch(source, /jedit/i);
});

test('counter template carries a small app contract fixture', () => {
  const schema = readFileSync(COUNTER_SCHEMA_PATH, 'utf8');
  assert.match(schema, /type Mutation/);
  assert.match(schema, /incrementCounter/);
  assert.match(schema, /type Query/);
  assert.match(schema, /counterValue/);
});

async function loadModules() {
  if (modulesPromise) {
    return modulesPromise;
  }

  modulesPromise = (async () => {
    const build = spawnSync('npm', ['run', '--silent', 'build'], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
    });

    assert.equal(build.status, 0, build.stderr || build.stdout);

    const [counter, hash] = await Promise.all([
      import(pathToFileURL(COUNTER_MODULE_PATH).href),
      import(pathToFileURL(HASH_MODULE_PATH).href),
    ]);

    return {
      counter,
      hash,
    };
  })();

  return modulesPromise;
}
