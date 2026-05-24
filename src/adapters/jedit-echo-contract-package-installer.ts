import type {
  EchoContractPackageHostPort,
  EchoContractPackageInstallRequest,
  EchoContractPackageInstallResult,
} from '../ports/echo-contract-package-host.js';
import {
  ECHO_CONTRACT_PACKAGE_INSTALL_BLOCKED,
  ECHO_CONTRACT_PACKAGE_INSTALL_INSTALLED,
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

const CONFLICTING_PACKAGE_IDENTITY_MESSAGE = 'CONFLICTING_PACKAGE_IDENTITY';

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

export function createRecordingEchoContractPackageHost(): EchoContractPackageHostPort {
  const installedPackages = new Map<string, EchoContractPackageInstallRequest>();
  return {
    installContractPackage(request) {
      const installed = installedPackages.get(request.packageId);
      if (installed != null && !sameEchoContractPackageInstallIdentity(installed, request)) {
        return {
          status: ECHO_CONTRACT_PACKAGE_INSTALL_BLOCKED,
          packageId: request.packageId,
          message: CONFLICTING_PACKAGE_IDENTITY_MESSAGE,
        };
      }
      installedPackages.set(request.packageId, request);
      return {
        status: ECHO_CONTRACT_PACKAGE_INSTALL_INSTALLED,
        packageId: request.packageId,
      };
    },
  };
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

function sameEchoContractPackageInstallIdentity(
  left: EchoContractPackageInstallRequest,
  right: EchoContractPackageInstallRequest,
): boolean {
  return left.packageId === right.packageId
    && left.packageVersion === right.packageVersion
    && left.schemaId === right.schemaId
    && left.artifactId === right.artifactId
    && left.codecId === right.codecId
    && sameStringList(left.mutationOperationNames, right.mutationOperationNames)
    && sameStringList(left.queryOperationNames, right.queryOperationNames)
    && sameQueryObserverList(left.queryObservers, right.queryObservers);
}

function sameStringList(
  left: readonly string[],
  right: readonly string[],
): boolean {
  return left.length === right.length
    && left.every((value, index) => value === right[index]);
}

function sameQueryObserverList(
  left: EchoContractPackageInstallRequest['queryObservers'],
  right: EchoContractPackageInstallRequest['queryObservers'],
): boolean {
  return left.length === right.length
    && left.every((observer, index) => {
      const matching = right[index];
      return matching != null
        && observer.queryName === matching.queryName
        && observer.observerPlanId === matching.observerPlanId;
    });
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
