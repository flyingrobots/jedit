import assert from 'node:assert/strict';
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

test('trusted adapter installs structural history package through a generic Echo package port', async () => {
  const modules = await loadModules();
  const descriptor = modules.packageModule.jeditStructuralHistoryContractPackage();
  const host = recordingHost(modules);
  const result = modules.installer.installJeditContractPackage({ host, descriptor });

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
      queryOperationNames: [],
      queryObservers: [],
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

test('recording package host treats duplicate install as idempotent and conflicts as blocked', async () => {
  const modules = await loadModules();
  const descriptor = modules.packageModule.jeditHotTextContractPackage();
  const host = modules.installer.createRecordingEchoContractPackageHost();
  const first = modules.installer.installJeditContractPackage({ host, descriptor });
  const duplicate = modules.installer.installJeditContractPackage({ host, descriptor });
  const conflict = modules.installer.installJeditContractPackage({
    host,
    descriptor: {
      ...descriptor,
      artifactId: `${descriptor.artifactId}.conflict`,
    },
  });

  assert.equal(first.hostResult.status, modules.hostPort.ECHO_CONTRACT_PACKAGE_INSTALL_INSTALLED);
  assert.equal(duplicate.hostResult.status, modules.hostPort.ECHO_CONTRACT_PACKAGE_INSTALL_INSTALLED);
  assert.equal(conflict.hostResult.status, modules.hostPort.ECHO_CONTRACT_PACKAGE_INSTALL_BLOCKED);
});

async function loadModules() {
  if (modulesPromise) {
    return modulesPromise;
  }

  modulesPromise = (async () => {
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
