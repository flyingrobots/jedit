export {
  COUNTER_TEMPLATE_INCREMENT_OPERATION,
  COUNTER_TEMPLATE_PACKAGE_ID,
  COUNTER_TEMPLATE_VALUE_QUERY,
} from '../ports/echo-hosting-counter-template.js';
import {
  COUNTER_TEMPLATE_INCREMENT_OPERATION,
  COUNTER_TEMPLATE_PACKAGE_ID,
  COUNTER_TEMPLATE_VALUE_QUERY,
  type CounterTemplateIncrementInput,
  type CounterTemplatePackageDescriptor,
  type CounterTemplateReading,
  type CounterTemplateReceipt,
  type CounterTemplateState,
  type CounterTemplateStatePort,
} from '../ports/echo-hosting-counter-template.js';
import type { HashPort } from '../ports/hash.js';

const INITIAL_COUNTER_VALUE = 0;
const RECEIPT_ID_PREFIX = 'counter-receipt:';
const READING_ID_PREFIX = 'counter-reading:';

export function createCounterTemplatePackageDescriptor(): CounterTemplatePackageDescriptor {
  return {
    packageId: COUNTER_TEMPLATE_PACKAGE_ID,
    mutationOperationNames: [COUNTER_TEMPLATE_INCREMENT_OPERATION],
    queryOperationNames: [COUNTER_TEMPLATE_VALUE_QUERY],
  };
}

export function createInMemoryCounterTemplateStatePort(): CounterTemplateStatePort {
  let state: CounterTemplateState = {
    value: INITIAL_COUNTER_VALUE,
  };

  return {
    readState() {
      return state;
    },
    writeState(nextState) {
      state = nextState;
      return state;
    },
  };
}

export function incrementCounterTemplate(
  statePort: CounterTemplateStatePort,
  input: CounterTemplateIncrementInput,
  hash: HashPort,
): CounterTemplateReceipt {
  const nextState = statePort.writeState({
    value: statePort.readState().value + input.amount,
  });
  return {
    receiptId: `${RECEIPT_ID_PREFIX}${hash.sha256Hex(nextState.value.toString())}`,
    value: nextState.value,
  };
}

export function observeCounterTemplateValue(
  statePort: CounterTemplateStatePort,
  hash: HashPort,
): CounterTemplateReading {
  const state = statePort.readState();
  return {
    readingId: `${READING_ID_PREFIX}${hash.sha256Hex(state.value.toString())}`,
    value: state.value,
  };
}
