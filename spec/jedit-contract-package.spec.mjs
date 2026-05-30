import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';

const REPO_ROOT = process.cwd();
const PACKAGE_MODULE_PATH = path.join(REPO_ROOT, 'dist', 'app', 'jedit-contract-package.js');
const GENERATED_MODULE_PATH = path.join(REPO_ROOT, 'dist', 'generated', 'jedit', 'rope.wesley.generated.js');
const STRUCTURAL_HISTORY_GENERATED_MODULE_PATH = path.join(
  REPO_ROOT,
  'dist',
  'generated',
  'jedit',
  'structural-history-replace-text-range.wesley.generated.js',
);

let modulesPromise;

test('jedit hot text package descriptor binds generated operation metadata', async () => {
  const modules = await loadModules();
  const descriptor = modules.packageModule.jeditHotTextContractPackage();

  assert.equal(descriptor.packageId, modules.packageModule.JEDIT_HOT_TEXT_PACKAGE_ID);
  assert.equal(descriptor.packageVersion, modules.packageModule.JEDIT_HOT_TEXT_PACKAGE_VERSION);
  assert.equal(descriptor.schemaId, modules.packageModule.JEDIT_HOT_TEXT_SCHEMA_ID);
  assert.equal(descriptor.artifactId, modules.packageModule.JEDIT_HOT_TEXT_ARTIFACT_ID);
  assert.equal(descriptor.codecId, modules.packageModule.JEDIT_HOT_TEXT_CODEC_ID);
  // Ratchet: bind the descriptor IDs to the explicit rope paths so a stale
  // descriptor/constant pair cannot drift together (renaming the constant
  // would otherwise hide a missed migration here).
  assert.equal(descriptor.schemaId, 'contracts/jedit/rope.graphql');
  assert.equal(descriptor.artifactId, 'src/generated/jedit/rope.wesley.generated.ts');
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

test('jedit structural history package descriptor binds generated operation metadata', async () => {
  const modules = await loadModules();
  const descriptor = modules.packageModule.jeditStructuralHistoryContractPackage();

  assert.equal(descriptor.packageId, modules.packageModule.JEDIT_STRUCTURAL_HISTORY_PACKAGE_ID);
  assert.equal(descriptor.packageVersion, modules.packageModule.JEDIT_STRUCTURAL_HISTORY_PACKAGE_VERSION);
  assert.equal(descriptor.schemaId, modules.packageModule.JEDIT_STRUCTURAL_HISTORY_SCHEMA_ID);
  assert.equal(descriptor.artifactId, modules.packageModule.JEDIT_STRUCTURAL_HISTORY_ARTIFACT_ID);
  assert.equal(descriptor.codecId, modules.packageModule.JEDIT_STRUCTURAL_HISTORY_CODEC_ID);
  assert.deepEqual(
    descriptor.mutationOperationNames,
    [
      modules.structuralHistoryGenerated.mutationReplaceTextRangeOperation.fieldName,
    ],
  );
  assert.deepEqual(descriptor.queryOperationNames, []);
  assert.deepEqual(descriptor.requiredMutationOperationNames, descriptor.mutationOperationNames);
  assert.deepEqual(descriptor.requiredQueryOperationNames, []);
  assert.deepEqual(descriptor.queryObservers, []);
});

async function loadModules() {
  if (modulesPromise) {
    return modulesPromise;
  }

  modulesPromise = (async () => {
    const [packageModule, generated, structuralHistoryGenerated] = await Promise.all([
      import(pathToFileURL(PACKAGE_MODULE_PATH).href),
      import(pathToFileURL(GENERATED_MODULE_PATH).href),
      import(pathToFileURL(STRUCTURAL_HISTORY_GENERATED_MODULE_PATH).href),
    ]);

    return {
      packageModule,
      generated,
      structuralHistoryGenerated,
    };
  })();

  return modulesPromise;
}
