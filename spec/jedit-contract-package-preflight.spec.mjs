import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
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
