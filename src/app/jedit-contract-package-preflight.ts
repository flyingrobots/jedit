import {
  JEDIT_HOT_TEXT_MUTATION_OPERATION_NAMES,
  JEDIT_HOT_TEXT_QUERY_OPERATION_NAMES,
  jeditHotTextContractPackage,
  type JeditContractPackageDescriptor,
} from './jedit-contract-package.js';

export const JEDIT_PACKAGE_PREFLIGHT_READY = 'READY';
export const JEDIT_PACKAGE_PREFLIGHT_BLOCKED = 'BLOCKED';
export const JEDIT_PACKAGE_REQUEST_SUPPORTED = 'SUPPORTED';
export const JEDIT_PACKAGE_REQUEST_UNSUPPORTED_MUTATION = 'UNSUPPORTED_MUTATION';
export const JEDIT_PACKAGE_REQUEST_UNSUPPORTED_QUERY = 'UNSUPPORTED_QUERY';

const DUPLICATE_MUTATION_CODE = 'DUPLICATE_MUTATION';
const DUPLICATE_QUERY_CODE = 'DUPLICATE_QUERY';
const MISSING_MUTATION_CODE = 'MISSING_MUTATION';
const MISSING_QUERY_CODE = 'MISSING_QUERY';
const MUTATION_REQUEST_KIND = 'MUTATION';
const QUERY_REQUEST_KIND = 'QUERY';

export type JeditPackagePreflightStatus =
  | typeof JEDIT_PACKAGE_PREFLIGHT_READY
  | typeof JEDIT_PACKAGE_PREFLIGHT_BLOCKED;

export type JeditPackagePreflightIssueCode =
  | typeof DUPLICATE_MUTATION_CODE
  | typeof DUPLICATE_QUERY_CODE
  | typeof MISSING_MUTATION_CODE
  | typeof MISSING_QUERY_CODE;

export type JeditPackageOperationRequestKind =
  | typeof MUTATION_REQUEST_KIND
  | typeof QUERY_REQUEST_KIND;

export type JeditPackageOperationSupport =
  | typeof JEDIT_PACKAGE_REQUEST_SUPPORTED
  | typeof JEDIT_PACKAGE_REQUEST_UNSUPPORTED_MUTATION
  | typeof JEDIT_PACKAGE_REQUEST_UNSUPPORTED_QUERY;

export interface JeditPackagePreflightIssue {
  readonly code: JeditPackagePreflightIssueCode;
  readonly operationName: string;
}

export interface JeditPackagePreflightResult {
  readonly status: JeditPackagePreflightStatus;
  readonly issues: readonly JeditPackagePreflightIssue[];
}

export interface JeditPackageOperationRequest {
  readonly kind: JeditPackageOperationRequestKind;
  readonly operationName: string;
}

export function preflightJeditContractPackageInstall(
  descriptor: JeditContractPackageDescriptor = jeditHotTextContractPackage(),
): JeditPackagePreflightResult {
  const issues = [
    ...missingRequiredIssues(MISSING_MUTATION_CODE, descriptor.mutationOperationNames, JEDIT_HOT_TEXT_MUTATION_OPERATION_NAMES),
    ...missingRequiredIssues(MISSING_QUERY_CODE, descriptor.queryOperationNames, JEDIT_HOT_TEXT_QUERY_OPERATION_NAMES),
    ...duplicateIssues(DUPLICATE_MUTATION_CODE, descriptor.mutationOperationNames),
    ...duplicateIssues(DUPLICATE_QUERY_CODE, descriptor.queryOperationNames),
  ];

  return {
    status: issues.length === 0 ? JEDIT_PACKAGE_PREFLIGHT_READY : JEDIT_PACKAGE_PREFLIGHT_BLOCKED,
    issues,
  };
}

export function classifyJeditPackageOperationRequest(
  request: JeditPackageOperationRequest,
  descriptor: JeditContractPackageDescriptor = jeditHotTextContractPackage(),
): JeditPackageOperationSupport {
  if (request.kind === MUTATION_REQUEST_KIND) {
    return includesOperation(descriptor.mutationOperationNames, request.operationName)
      ? JEDIT_PACKAGE_REQUEST_SUPPORTED
      : JEDIT_PACKAGE_REQUEST_UNSUPPORTED_MUTATION;
  }

  return includesOperation(descriptor.queryOperationNames, request.operationName)
    ? JEDIT_PACKAGE_REQUEST_SUPPORTED
    : JEDIT_PACKAGE_REQUEST_UNSUPPORTED_QUERY;
}

export function jeditMutationOperationRequest(
  operationName: string,
): JeditPackageOperationRequest {
  return {
    kind: MUTATION_REQUEST_KIND,
    operationName,
  };
}

export function jeditQueryOperationRequest(
  operationName: string,
): JeditPackageOperationRequest {
  return {
    kind: QUERY_REQUEST_KIND,
    operationName,
  };
}

function missingRequiredIssues(
  code: JeditPackagePreflightIssueCode,
  available: readonly string[],
  required: readonly string[],
): readonly JeditPackagePreflightIssue[] {
  return required
    .filter((operationName) => !includesOperation(available, operationName))
    .map((operationName) => ({
      code,
      operationName,
    }));
}

function duplicateIssues(
  code: JeditPackagePreflightIssueCode,
  values: readonly string[],
): readonly JeditPackagePreflightIssue[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) {
      duplicates.add(value);
    }
    seen.add(value);
  }
  return [...duplicates].map((operationName) => ({
    code,
    operationName,
  }));
}

function includesOperation(values: readonly string[], operationName: string): boolean {
  return values.includes(operationName);
}
