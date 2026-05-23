import type {
  EchoContractPackageHostPort,
  EchoContractPackageInstallRequest,
  EchoContractPackageInstallResult,
} from '../ports/echo-contract-package-host.js';
import {
  ECHO_CONTRACT_PACKAGE_INSTALL_BLOCKED,
} from '../ports/echo-contract-package-host.js';
import {
  jeditHotTextContractPackage,
  type JeditContractPackageDescriptor,
} from '../app/jedit-contract-package.js';
import {
  preflightJeditContractPackageInstall,
  type JeditPackagePreflightIssue,
} from '../app/jedit-contract-package-preflight.js';

export const JEDIT_CONTRACT_PACKAGE_INSTALL_PREFLIGHT_BLOCKED = 'PREFLIGHT_BLOCKED';
export const JEDIT_CONTRACT_PACKAGE_INSTALL_HOST_RESULT = 'HOST_RESULT';

export type JeditContractPackageInstallSource =
  | typeof JEDIT_CONTRACT_PACKAGE_INSTALL_PREFLIGHT_BLOCKED
  | typeof JEDIT_CONTRACT_PACKAGE_INSTALL_HOST_RESULT;

export interface JeditContractPackageInstallerOptions {
  readonly host: EchoContractPackageHostPort;
  readonly descriptor?: JeditContractPackageDescriptor;
}

export interface JeditContractPackageInstallResult {
  readonly source: JeditContractPackageInstallSource;
  readonly hostResult: EchoContractPackageInstallResult;
  readonly preflightIssues: readonly JeditPackagePreflightIssue[];
}

export function installJeditContractPackage(
  options: JeditContractPackageInstallerOptions,
): JeditContractPackageInstallResult {
  const descriptor = options.descriptor ?? jeditHotTextContractPackage();
  const preflight = preflightJeditContractPackageInstall(descriptor);

  if (preflight.issues.length > 0) {
    return {
      source: JEDIT_CONTRACT_PACKAGE_INSTALL_PREFLIGHT_BLOCKED,
      hostResult: {
        status: ECHO_CONTRACT_PACKAGE_INSTALL_BLOCKED,
        packageId: descriptor.packageId,
        message: JEDIT_CONTRACT_PACKAGE_INSTALL_PREFLIGHT_BLOCKED,
      },
      preflightIssues: preflight.issues,
    };
  }

  return {
    source: JEDIT_CONTRACT_PACKAGE_INSTALL_HOST_RESULT,
    hostResult: options.host.installContractPackage(toEchoInstallRequest(descriptor)),
    preflightIssues: [],
  };
}

function toEchoInstallRequest(
  descriptor: JeditContractPackageDescriptor,
): EchoContractPackageInstallRequest {
  return {
    packageId: descriptor.packageId,
    packageVersion: descriptor.packageVersion,
    schemaId: descriptor.schemaId,
    artifactId: descriptor.artifactId,
    codecId: descriptor.codecId,
    mutationOperationNames: descriptor.mutationOperationNames,
    queryOperationNames: descriptor.queryOperationNames,
    queryObservers: descriptor.queryObservers,
  };
}
