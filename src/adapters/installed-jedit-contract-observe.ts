import { createJeditContractQueryObserverRegistry } from '../app/jedit-contract-query-observers.js';
import {
  CAUSAL_LINE_DIFF_OPERATION,
  JEDIT_TRANSPORT_STATUS_OK,
  TEXT_WINDOW_OPERATION,
  WHY_RANGE_OPERATION,
  WORLDLINE_SNAPSHOT_OPERATION,
  type JeditObserveRequest,
  type JeditObserveResponse,
} from './jedit-echo-optic-codec.js';

export { createJeditContractQueryObserverRegistry };
export type { DisposableJeditLineIndexStore } from '../app/jedit-contract-query-observers.js';

export function executeInstalledJeditObserve(
  observers: ReturnType<typeof createJeditContractQueryObserverRegistry>,
  request: JeditObserveRequest,
): JeditObserveResponse {
  switch (request.operationName) {
    case WORLDLINE_SNAPSHOT_OPERATION:
      return {
        status: JEDIT_TRANSPORT_STATUS_OK,
        operationName: WORLDLINE_SNAPSHOT_OPERATION,
        envelope: observers.observeWorldlineSnapshot(request),
      };
    case TEXT_WINDOW_OPERATION:
      return {
        status: JEDIT_TRANSPORT_STATUS_OK,
        operationName: TEXT_WINDOW_OPERATION,
        envelope: observers.observeTextWindow(request),
      };
    case CAUSAL_LINE_DIFF_OPERATION:
      return {
        status: JEDIT_TRANSPORT_STATUS_OK,
        operationName: CAUSAL_LINE_DIFF_OPERATION,
        envelope: observers.observeCausalLineDiff(request),
      };
    case WHY_RANGE_OPERATION:
      return {
        status: JEDIT_TRANSPORT_STATUS_OK,
        operationName: WHY_RANGE_OPERATION,
        envelope: observers.observeWhyRange(request),
      };
  }
}
