import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';

const REPO_ROOT = process.cwd();
const PACKAGE_MODULE_PATH = path.join(REPO_ROOT, 'dist', 'app', 'jedit-contract-package.js');
const PREFLIGHT_MODULE_PATH = path.join(REPO_ROOT, 'dist', 'app', 'jedit-contract-package-preflight.js');

let modulesPromise;

test('jedit package install preflight accepts the generated descriptor', async () => {
  const modules = await loadModules();
  const result = modules.preflight.preflightJeditContractPackageInstall();

  assert.equal(result.status, modules.preflight.JEDIT_PACKAGE_PREFLIGHT_READY);
  assert.deepEqual(result.issues, []);
});

test('jedit package install preflight accepts the structural history descriptor', async () => {
  const modules = await loadModules();
  const descriptor = modules.packageModule.jeditStructuralHistoryContractPackage();
  const result = modules.preflight.preflightJeditContractPackageInstall(descriptor);

  assert.equal(result.status, modules.preflight.JEDIT_PACKAGE_PREFLIGHT_READY);
  assert.deepEqual(result.issues, []);
});

test('jedit package install preflight rejects missing required mutations and queries', async () => {
  const modules = await loadModules();
  const descriptor = modules.packageModule.jeditHotTextContractPackage();
  const result = modules.preflight.preflightJeditContractPackageInstall({
    ...descriptor,
    mutationOperationNames: descriptor.mutationOperationNames.slice(1),
    queryOperationNames: descriptor.queryOperationNames.slice(1),
  });

  assert.equal(result.status, modules.preflight.JEDIT_PACKAGE_PREFLIGHT_BLOCKED);
  assert.deepEqual(
    result.issues.map((issue) => issue.code),
    ['MISSING_MUTATION', 'MISSING_QUERY'],
  );
});

test('jedit package install preflight uses canonical required operations', async () => {
  const modules = await loadModules();
  const descriptor = modules.packageModule.jeditHotTextContractPackage();
  const result = modules.preflight.preflightJeditContractPackageInstall({
    ...descriptor,
    mutationOperationNames: descriptor.mutationOperationNames.slice(1),
    queryOperationNames: descriptor.queryOperationNames.slice(1),
    requiredMutationOperationNames: descriptor.mutationOperationNames.slice(1),
    requiredQueryOperationNames: descriptor.queryOperationNames.slice(1),
  });

  assert.equal(result.status, modules.preflight.JEDIT_PACKAGE_PREFLIGHT_BLOCKED);
  assert.deepEqual(
    result.issues.map((issue) => issue.code),
    ['MISSING_MUTATION', 'MISSING_QUERY'],
  );
});

test('jedit package install preflight rejects duplicate mutations and queries', async () => {
  const modules = await loadModules();
  const descriptor = modules.packageModule.jeditHotTextContractPackage();
  const result = modules.preflight.preflightJeditContractPackageInstall({
    ...descriptor,
    mutationOperationNames: [
      ...descriptor.mutationOperationNames,
      descriptor.mutationOperationNames[0],
    ],
    queryOperationNames: [
      ...descriptor.queryOperationNames,
      descriptor.queryOperationNames[0],
    ],
  });

  assert.equal(result.status, modules.preflight.JEDIT_PACKAGE_PREFLIGHT_BLOCKED);
  assert.deepEqual(
    result.issues.map((issue) => issue.code),
    ['DUPLICATE_MUTATION', 'DUPLICATE_QUERY'],
  );
});

test('jedit package install preflight blocks unknown package identities', async () => {
  const modules = await loadModules();
  const descriptor = modules.packageModule.jeditHotTextContractPackage();
  const result = modules.preflight.preflightJeditContractPackageInstall({
    ...descriptor,
    packageId: 'jedit.unknown-package',
  });

  assert.equal(result.status, modules.preflight.JEDIT_PACKAGE_PREFLIGHT_BLOCKED);
  assert.deepEqual(
    result.issues.map((issue) => issue.code),
    ['UNKNOWN_PACKAGE'],
  );
});

test('jedit package operation requests fail closed before runtime work', async () => {
  const modules = await loadModules();
  const descriptor = modules.packageModule.jeditHotTextContractPackage();

  assert.equal(
    modules.preflight.classifyJeditPackageOperationRequest(
      modules.preflight.jeditMutationOperationRequest(descriptor.mutationOperationNames[0]),
    ),
    modules.preflight.JEDIT_PACKAGE_REQUEST_SUPPORTED,
  );
  assert.equal(
    modules.preflight.classifyJeditPackageOperationRequest(
      modules.preflight.jeditMutationOperationRequest('unsupportedMutation'),
    ),
    modules.preflight.JEDIT_PACKAGE_REQUEST_UNSUPPORTED_MUTATION,
  );
  assert.equal(
    modules.preflight.classifyJeditPackageOperationRequest(
      modules.preflight.jeditQueryOperationRequest('unsupportedQuery'),
    ),
    modules.preflight.JEDIT_PACKAGE_REQUEST_UNSUPPORTED_QUERY,
  );
});

test('jedit structural history package requests reject unsupported queries at the package boundary', async () => {
  const modules = await loadModules();
  const descriptor = modules.packageModule.jeditStructuralHistoryContractPackage();

  assert.equal(
    modules.preflight.classifyJeditPackageOperationRequest(
      modules.preflight.jeditMutationOperationRequest(descriptor.mutationOperationNames[0]),
      descriptor,
    ),
    modules.preflight.JEDIT_PACKAGE_REQUEST_SUPPORTED,
  );
  assert.equal(
    modules.preflight.classifyJeditPackageOperationRequest(
      modules.preflight.jeditQueryOperationRequest('textWindow'),
      descriptor,
    ),
    modules.preflight.JEDIT_PACKAGE_REQUEST_UNSUPPORTED_QUERY,
  );
});

async function loadModules() {
  if (modulesPromise) {
    return modulesPromise;
  }

  modulesPromise = (async () => {
    const [packageModule, preflight] = await Promise.all([
      import(pathToFileURL(PACKAGE_MODULE_PATH).href),
      import(pathToFileURL(PREFLIGHT_MODULE_PATH).href),
    ]);

    return {
      packageModule,
      preflight,
    };
  })();

  return modulesPromise;
}
