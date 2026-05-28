export const COUNTER_TEMPLATE_PACKAGE_ID = 'counter.template';
export const COUNTER_TEMPLATE_PACKAGE_VERSION = '0.1.0-template';
export const COUNTER_TEMPLATE_SCHEMA_ID = 'contracts/fixtures/counter.graphql';
export const COUNTER_TEMPLATE_ARTIFACT_ID = 'src/app/echo-hosting-counter-template.ts';
export const COUNTER_TEMPLATE_CODEC_ID = 'counter-template-json-v1';
export const COUNTER_TEMPLATE_INCREMENT_OPERATION = 'incrementCounter';
export const COUNTER_TEMPLATE_VALUE_QUERY = 'counterValue';

export interface CounterTemplateQueryObserverDescriptor {
  readonly queryName: typeof COUNTER_TEMPLATE_VALUE_QUERY;
  readonly observerPlanId: string;
}

export interface CounterTemplatePackageDescriptor {
  readonly packageId: typeof COUNTER_TEMPLATE_PACKAGE_ID;
  readonly packageVersion: typeof COUNTER_TEMPLATE_PACKAGE_VERSION;
  readonly schemaId: typeof COUNTER_TEMPLATE_SCHEMA_ID;
  readonly artifactId: typeof COUNTER_TEMPLATE_ARTIFACT_ID;
  readonly codecId: typeof COUNTER_TEMPLATE_CODEC_ID;
  readonly mutationOperationNames: readonly [typeof COUNTER_TEMPLATE_INCREMENT_OPERATION];
  readonly queryOperationNames: readonly [typeof COUNTER_TEMPLATE_VALUE_QUERY];
  readonly queryObservers: readonly [CounterTemplateQueryObserverDescriptor];
}

export interface CounterTemplateState {
  readonly value: number;
}

export interface CounterTemplateStatePort {
  readState(): CounterTemplateState;
  writeState(state: CounterTemplateState): CounterTemplateState;
}

export interface CounterTemplateIncrementInput {
  readonly amount: number;
}

export interface CounterTemplateReceipt {
  readonly receiptId: string;
  readonly value: number;
}

export interface CounterTemplateReading {
  readonly readingId: string;
  readonly value: number;
}
