import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';

const REPO_ROOT = process.cwd();
const PACKAGE_MODULE_PATH = path.join(REPO_ROOT, 'dist', 'app', 'jedit-contract-package.js');
const GENERATED_MODULE_PATH = path.join(REPO_ROOT, 'dist', 'generated', 'jedit', 'hot-text-runtime.wesley.generated.js');

let modulesPromise;

test('jedit hot text package descriptor binds generated operation metadata', async () => {
  const modules = await loadModules();
  const descriptor = modules.packageModule.jeditHotTextContractPackage();

  assert.equal(descriptor.packageId, modules.packageModule.JEDIT_HOT_TEXT_PACKAGE_ID);
  assert.equal(descriptor.packageVersion, modules.packageModule.JEDIT_HOT_TEXT_PACKAGE_VERSION);
  assert.equal(descriptor.schemaId, modules.packageModule.JEDIT_HOT_TEXT_SCHEMA_ID);
  assert.equal(descriptor.artifactId, modules.packageModule.JEDIT_HOT_TEXT_ARTIFACT_ID);
  assert.equal(descriptor.codecId, modules.packageModule.JEDIT_HOT_TEXT_CODEC_ID);
  assert.deepEqual(
    descriptor.mutationOperationNames,
    [
      modules.generated.mutationCreateBufferWorldlineOperation.fieldName,
      modules.generated.mutationReplaceRangeAsTickOperation.fieldName,
      modules.generated.mutationCreateCheckpointOperation.fieldName,
    ],
  );
  assert.deepEqual(
    descriptor.queryOperationNames,
    [
      modules.generated.queryWorldlineSnapshotOperation.fieldName,
      modules.generated.queryTextWindowOperation.fieldName,
    ],
  );
});

test('jedit hot text package descriptor stamps query observer identities', async () => {
  const modules = await loadModules();
  const descriptor = modules.packageModule.jeditHotTextContractPackage();

  assert.deepEqual(
    descriptor.queryObservers,
    descriptor.queryOperationNames.map((queryName) => ({
      queryName,
      observerPlanId: modules.packageModule.jeditQueryObserverPlanId(queryName),
    })),
  );
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

    const [packageModule, generated] = await Promise.all([
      import(pathToFileURL(PACKAGE_MODULE_PATH).href),
      import(pathToFileURL(GENERATED_MODULE_PATH).href),
    ]);

    return {
      packageModule,
      generated,
    };
  })();

  return modulesPromise;
}
