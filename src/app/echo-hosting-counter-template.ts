export {
  COUNTER_TEMPLATE_ARTIFACT_ID,
  COUNTER_TEMPLATE_CODEC_ID,
  COUNTER_TEMPLATE_INCREMENT_OPERATION,
  COUNTER_TEMPLATE_PACKAGE_ID,
  COUNTER_TEMPLATE_PACKAGE_VERSION,
  COUNTER_TEMPLATE_SCHEMA_ID,
  COUNTER_TEMPLATE_VALUE_QUERY,
} from '../ports/echo-hosting-counter-template.js';
import {
  COUNTER_TEMPLATE_ARTIFACT_ID,
  COUNTER_TEMPLATE_CODEC_ID,
  COUNTER_TEMPLATE_INCREMENT_OPERATION,
  COUNTER_TEMPLATE_PACKAGE_ID,
  COUNTER_TEMPLATE_PACKAGE_VERSION,
  COUNTER_TEMPLATE_SCHEMA_ID,
  COUNTER_TEMPLATE_VALUE_QUERY,
  type CounterTemplateIncrementInput,
  type CounterTemplatePackageDescriptor,
  type CounterTemplateReading,
  type CounterTemplateReceipt,
  type CounterTemplateState,
  type CounterTemplateStatePort,
} from '../ports/echo-hosting-counter-template.js';
import type { EchoContractPackageInstallRequest } from '../ports/echo-contract-package-host.js';
import type { HashPort } from '../ports/hash.js';

const INITIAL_COUNTER_VALUE = 0;
const RECEIPT_ID_PREFIX = 'counter-receipt:';
const READING_ID_PREFIX = 'counter-reading:';
const OBSERVER_PLAN_SEGMENT = 'observer';
const QUERY_SEGMENT = 'query';

export function createCounterTemplatePackageDescriptor(): CounterTemplatePackageDescriptor {
  return {
    packageId: COUNTER_TEMPLATE_PACKAGE_ID,
    packageVersion: COUNTER_TEMPLATE_PACKAGE_VERSION,
    schemaId: COUNTER_TEMPLATE_SCHEMA_ID,
    artifactId: COUNTER_TEMPLATE_ARTIFACT_ID,
    codecId: COUNTER_TEMPLATE_CODEC_ID,
    mutationOperationNames: [COUNTER_TEMPLATE_INCREMENT_OPERATION],
    queryOperationNames: [COUNTER_TEMPLATE_VALUE_QUERY],
    queryObservers: [{
      queryName: COUNTER_TEMPLATE_VALUE_QUERY,
      observerPlanId: counterTemplateObserverPlanId(),
    }],
  };
}

export function createCounterTemplateInstallRequest(): EchoContractPackageInstallRequest {
  const descriptor = createCounterTemplatePackageDescriptor();
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

export function counterTemplateObserverPlanId(): string {
  return [
    COUNTER_TEMPLATE_PACKAGE_ID,
    QUERY_SEGMENT,
    COUNTER_TEMPLATE_VALUE_QUERY,
    OBSERVER_PLAN_SEGMENT,
  ].join('.');
}

export function createInMemoryCounterTemplateStatePort(): CounterTemplateStatePort {
  let state: CounterTemplateState = {
    value: INITIAL_COUNTER_VALUE,
  };

  return {
    readState() {
      return cloneState(state);
    },
    writeState(nextState) {
      state = cloneState(nextState);
      return cloneState(state);
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

function cloneState(state: CounterTemplateState): CounterTemplateState {
  return {
    value: state.value,
  };
}
