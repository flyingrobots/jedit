export const COUNTER_TEMPLATE_PACKAGE_ID = 'counter.template';
export const COUNTER_TEMPLATE_INCREMENT_OPERATION = 'incrementCounter';
export const COUNTER_TEMPLATE_VALUE_QUERY = 'counterValue';

export interface CounterTemplatePackageDescriptor {
  readonly packageId: typeof COUNTER_TEMPLATE_PACKAGE_ID;
  readonly mutationOperationNames: readonly [typeof COUNTER_TEMPLATE_INCREMENT_OPERATION];
  readonly queryOperationNames: readonly [typeof COUNTER_TEMPLATE_VALUE_QUERY];
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
