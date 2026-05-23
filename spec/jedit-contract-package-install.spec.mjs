import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';

const REPO_ROOT = process.cwd();
const INSTALLER_MODULE_PATH = path.join(REPO_ROOT, 'dist', 'adapters', 'jedit-echo-contract-package-installer.js');
const PACKAGE_MODULE_PATH = path.join(REPO_ROOT, 'dist', 'app', 'jedit-contract-package.js');
const HOST_PORT_MODULE_PATH = path.join(REPO_ROOT, 'dist', 'ports', 'echo-contract-package-host.js');

let modulesPromise;

test('trusted adapter installs jedit package through a generic Echo package port', async () => {
  const modules = await loadModules();
  const descriptor = modules.packageModule.jeditHotTextContractPackage();
  const host = recordingHost(modules);
  const result = modules.installer.installJeditContractPackage({ host });

  assert.equal(result.source, modules.installer.JEDIT_CONTRACT_PACKAGE_INSTALL_HOST_RESULT);
  assert.equal(result.hostResult.status, modules.hostPort.ECHO_CONTRACT_PACKAGE_INSTALL_INSTALLED);
  assert.deepEqual(host.requests, [
    {
      packageId: descriptor.packageId,
      packageVersion: descriptor.packageVersion,
      schemaId: descriptor.schemaId,
      artifactId: descriptor.artifactId,
      codecId: descriptor.codecId,
      mutationOperationNames: descriptor.mutationOperationNames,
      queryOperationNames: descriptor.queryOperationNames,
      queryObservers: descriptor.queryObservers,
    },
  ]);
});

test('trusted adapter blocks invalid package before reaching Echo package port', async () => {
  const modules = await loadModules();
  const descriptor = modules.packageModule.jeditHotTextContractPackage();
  const host = recordingHost(modules);
  const result = modules.installer.installJeditContractPackage({
    host,
    descriptor: {
      ...descriptor,
      mutationOperationNames: descriptor.mutationOperationNames.slice(1),
    },
  });

  assert.equal(result.source, modules.installer.JEDIT_CONTRACT_PACKAGE_INSTALL_PREFLIGHT_BLOCKED);
  assert.equal(result.hostResult.status, modules.hostPort.ECHO_CONTRACT_PACKAGE_INSTALL_BLOCKED);
  assert.deepEqual(host.requests, []);
  assert.deepEqual(
    result.preflightIssues.map((issue) => issue.code),
    ['MISSING_MUTATION'],
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

    const [installer, packageModule, hostPort] = await Promise.all([
      import(pathToFileURL(INSTALLER_MODULE_PATH).href),
      import(pathToFileURL(PACKAGE_MODULE_PATH).href),
      import(pathToFileURL(HOST_PORT_MODULE_PATH).href),
    ]);

    return {
      installer,
      packageModule,
      hostPort,
    };
  })();

  return modulesPromise;
}

function recordingHost(modules) {
  const requests = [];
  return {
    requests,
    installContractPackage(request) {
      requests.push(request);
      return {
        status: modules.hostPort.ECHO_CONTRACT_PACKAGE_INSTALL_INSTALLED,
        packageId: request.packageId,
      };
    },
  };
}
