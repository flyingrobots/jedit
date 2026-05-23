export const ECHO_CONTRACT_PACKAGE_INSTALL_INSTALLED = 'INSTALLED';
export const ECHO_CONTRACT_PACKAGE_INSTALL_BLOCKED = 'BLOCKED';

export type EchoContractPackageInstallStatus =
  | typeof ECHO_CONTRACT_PACKAGE_INSTALL_INSTALLED
  | typeof ECHO_CONTRACT_PACKAGE_INSTALL_BLOCKED;

export interface EchoContractQueryObserverInstallRequest {
  readonly queryName: string;
  readonly observerPlanId: string;
}

export interface EchoContractPackageInstallRequest {
  readonly packageId: string;
  readonly packageVersion: string;
  readonly schemaId: string;
  readonly artifactId: string;
  readonly codecId: string;
  readonly mutationOperationNames: readonly string[];
  readonly queryOperationNames: readonly string[];
  readonly queryObservers: readonly EchoContractQueryObserverInstallRequest[];
}

export interface EchoContractPackageInstallResult {
  readonly status: EchoContractPackageInstallStatus;
  readonly packageId: string;
  readonly message?: string;
}

export interface EchoContractPackageHostPort {
  installContractPackage(
    request: EchoContractPackageInstallRequest,
  ): EchoContractPackageInstallResult;
}
