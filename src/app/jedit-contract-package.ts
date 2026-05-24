import {
  mutationCreateBufferWorldlineOperation,
  mutationCreateCheckpointOperation,
  mutationReplaceRangeAsTickOperation,
  queryTextWindowOperation,
  queryWorldlineSnapshotOperation,
} from '../generated/jedit/hot-text-runtime.wesley.generated.js';

export const JEDIT_HOT_TEXT_PACKAGE_ID = 'jedit.hot-text-runtime';
export const JEDIT_HOT_TEXT_PACKAGE_VERSION = '0.1.0-release-gate';
export const JEDIT_HOT_TEXT_SCHEMA_ID = 'contracts/jedit/hot-text-runtime.graphql';
export const JEDIT_HOT_TEXT_ARTIFACT_ID = 'src/generated/jedit/hot-text-runtime.wesley.generated.ts';
export const JEDIT_HOT_TEXT_CODEC_ID = 'jedit-hot-text-runtime-json-v1';

const OBSERVER_PLAN_SEGMENT = 'observer';
const QUERY_SEGMENT = 'query';

export const JEDIT_HOT_TEXT_MUTATION_OPERATION_NAMES = [
  mutationCreateBufferWorldlineOperation.fieldName,
  mutationReplaceRangeAsTickOperation.fieldName,
  mutationCreateCheckpointOperation.fieldName,
] as const;

export const JEDIT_HOT_TEXT_QUERY_OPERATION_NAMES = [
  queryWorldlineSnapshotOperation.fieldName,
  queryTextWindowOperation.fieldName,
] as const;

export type JeditHotTextMutationOperationName =
  (typeof JEDIT_HOT_TEXT_MUTATION_OPERATION_NAMES)[number];
export type JeditHotTextMutationOperationNames =
  readonly JeditHotTextMutationOperationName[];
export type JeditHotTextRequiredMutationOperationNames =
  typeof JEDIT_HOT_TEXT_MUTATION_OPERATION_NAMES;

export type JeditHotTextQueryOperationName =
  (typeof JEDIT_HOT_TEXT_QUERY_OPERATION_NAMES)[number];
export type JeditHotTextQueryOperationNames =
  readonly JeditHotTextQueryOperationName[];
export type JeditHotTextRequiredQueryOperationNames =
  typeof JEDIT_HOT_TEXT_QUERY_OPERATION_NAMES;

export interface JeditContractQueryObserverDescriptor {
  readonly queryName: JeditHotTextQueryOperationName;
  readonly observerPlanId: string;
}

export interface JeditContractPackageDescriptor {
  readonly packageId: string;
  readonly packageVersion: string;
  readonly schemaId: string;
  readonly artifactId: string;
  readonly codecId: string;
  readonly mutationOperationNames: JeditHotTextMutationOperationNames;
  readonly queryOperationNames: JeditHotTextQueryOperationNames;
  readonly queryObservers: readonly JeditContractQueryObserverDescriptor[];
}

export const JEDIT_HOT_TEXT_CONTRACT_PACKAGE: JeditContractPackageDescriptor = Object.freeze({
  packageId: JEDIT_HOT_TEXT_PACKAGE_ID,
  packageVersion: JEDIT_HOT_TEXT_PACKAGE_VERSION,
  schemaId: JEDIT_HOT_TEXT_SCHEMA_ID,
  artifactId: JEDIT_HOT_TEXT_ARTIFACT_ID,
  codecId: JEDIT_HOT_TEXT_CODEC_ID,
  mutationOperationNames: JEDIT_HOT_TEXT_MUTATION_OPERATION_NAMES,
  queryOperationNames: JEDIT_HOT_TEXT_QUERY_OPERATION_NAMES,
  queryObservers: Object.freeze(
    JEDIT_HOT_TEXT_QUERY_OPERATION_NAMES.map((queryName) => Object.freeze({
      queryName,
      observerPlanId: jeditQueryObserverPlanId(queryName),
    })),
  ),
});

export function jeditHotTextContractPackage(): JeditContractPackageDescriptor {
  return JEDIT_HOT_TEXT_CONTRACT_PACKAGE;
}

export function jeditQueryObserverPlanId(
  queryName: JeditHotTextQueryOperationName,
): string {
  return [
    JEDIT_HOT_TEXT_PACKAGE_ID,
    QUERY_SEGMENT,
    queryName,
    OBSERVER_PLAN_SEGMENT,
  ].join('.');
}
