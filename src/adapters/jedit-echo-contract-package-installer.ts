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
const PACKAGE_IDENTITY_FIELD_SEPARATOR = '|';
const PACKAGE_IDENTITY_LIST_SEPARATOR = ',';
const PACKAGE_OBSERVER_FIELD_SEPARATOR = ':';

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
      if (installed != null && echoContractPackageInstallIdentity(installed) !== echoContractPackageInstallIdentity(request)) {
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

function echoContractPackageInstallIdentity(
  request: EchoContractPackageInstallRequest,
): string {
  return [
    request.packageId,
    request.packageVersion,
    request.schemaId,
    request.artifactId,
    request.codecId,
    request.mutationOperationNames.join(PACKAGE_IDENTITY_LIST_SEPARATOR),
    request.queryOperationNames.join(PACKAGE_IDENTITY_LIST_SEPARATOR),
    request.queryObservers.map((observer) => [
      observer.queryName,
      observer.observerPlanId,
    ].join(PACKAGE_OBSERVER_FIELD_SEPARATOR)).join(PACKAGE_IDENTITY_LIST_SEPARATOR),
  ].join(PACKAGE_IDENTITY_FIELD_SEPARATOR);
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
