// SPDX-License-Identifier: Apache-2.0
// EINT envelope → handler-request bridge for jedit's in-process transports.
//
// Encapsulates decoding the EINT envelope, looking up the worldline session
// via the session port, and turning failures (envelope decode, session not
// registered) into obstructed responses. Keeps `installed-jedit-contract-
// echo-transport.ts` focused on package/ticketed-work/handler-invocation
// concerns and bounded by the quality gate's complexity / import / line caps.

import {
  CREATE_BUFFER_WORLDLINE_OPERATION,
  CREATE_CHECKPOINT_OPERATION,
  decodeJeditMutationIntentEnvelope,
  JEDIT_INTENT_REQUEST_KIND,
  JEDIT_TRANSPORT_STATUS_OBSTRUCTED,
  REPLACE_RANGE_AS_TICK_OPERATION,
  type DecodedJeditMutationIntent,
  type JeditIntentRequest,
  type JeditIntentResponse,
} from './jedit-echo-optic-codec.js';
import {
  createInMemoryJeditWorldlineSessionPort,
  JeditWorldlineSessionNotRegisteredError,
  type JeditWorldlineSessionPort,
} from './in-memory-jedit-worldline-session-port.js';

const MUTATION_ENVELOPE_DECODE_ERROR_CODE = 'JEDIT_MUTATION_ENVELOPE_INVALID';
const MUTATION_ENVELOPE_DECODE_RECOVERY = 'resubmit the intent using a valid EINT mutation envelope';
const SESSION_NOT_REGISTERED_CODE = 'JEDIT_WORLDLINE_SESSION_NOT_REGISTERED';
const SESSION_NOT_REGISTERED_RECOVERY = 'register the worldline session via the optic client before dispatching';

export type ResolvedIntent =
  | { readonly status: 'ok'; readonly request: JeditIntentRequest }
  | { readonly status: 'obstructed'; readonly response: JeditIntentResponse };

export interface JeditEintBridge {
  readonly sessionPort: JeditWorldlineSessionPort;
  resolveIntent(intentBytes: Uint8Array): ResolvedIntent;
}

export interface CreateJeditEintBridgeOptions {
  readonly sessionPort?: JeditWorldlineSessionPort;
}

export function createInstalledJeditEintBridge(
  options: CreateJeditEintBridgeOptions = {},
): JeditEintBridge {
  const sessionPort = options.sessionPort ?? createInMemoryJeditWorldlineSessionPort();
  return {
    sessionPort,
    resolveIntent(intentBytes) {
      return resolveIntentInternal(sessionPort, intentBytes);
    },
  };
}

function resolveIntentInternal(
  sessionPort: JeditWorldlineSessionPort,
  intentBytes: Uint8Array,
): ResolvedIntent {
  let decoded: DecodedJeditMutationIntent;
  try {
    decoded = decodeJeditMutationIntentEnvelope(intentBytes);
  } catch (error) {
    return obstructed(envelopeDecodeObstructedResponse(error instanceof Error ? error : undefined));
  }
  try {
    return { status: 'ok', request: buildHandlerRequestFromEnvelope(sessionPort, decoded) };
  } catch (error) {
    if (error instanceof JeditWorldlineSessionNotRegisteredError) {
      return obstructed({
        status: JEDIT_TRANSPORT_STATUS_OBSTRUCTED,
        operationName: decoded.operationName,
        obstruction: {
          code: SESSION_NOT_REGISTERED_CODE,
          message: error.message,
          worldlineId: error.worldlineId,
          recovery: SESSION_NOT_REGISTERED_RECOVERY,
        },
      });
    }
    throw error;
  }
}

function buildHandlerRequestFromEnvelope(
  sessionPort: JeditWorldlineSessionPort,
  decoded: DecodedJeditMutationIntent,
): JeditIntentRequest {
  const kind = JEDIT_INTENT_REQUEST_KIND;
  switch (decoded.operationName) {
    case CREATE_BUFFER_WORLDLINE_OPERATION:
      return { kind, operationName: decoded.operationName, input: decoded.vars.input };
    case REPLACE_RANGE_AS_TICK_OPERATION: {
      const session = sessionPort.getSession(decoded.vars.input.worldlineId);
      return { kind, operationName: decoded.operationName, session, input: decoded.vars.input };
    }
    case CREATE_CHECKPOINT_OPERATION: {
      const session = sessionPort.getSession(decoded.vars.input.worldlineId);
      return { kind, operationName: decoded.operationName, session, input: decoded.vars.input };
    }
  }
}

function envelopeDecodeObstructedResponse(error: Error | undefined): JeditIntentResponse {
  return {
    status: JEDIT_TRANSPORT_STATUS_OBSTRUCTED,
    // EINT decode failed before we know the operationName; consumers branch on
    // obstruction.code (JEDIT_MUTATION_ENVELOPE_INVALID), not operationName.
    operationName: CREATE_BUFFER_WORLDLINE_OPERATION,
    obstruction: {
      code: MUTATION_ENVELOPE_DECODE_ERROR_CODE,
      message: error?.message ?? 'invalid mutation envelope',
      recovery: MUTATION_ENVELOPE_DECODE_RECOVERY,
    },
  };
}

function obstructed(response: JeditIntentResponse): ResolvedIntent {
  return { status: 'obstructed', response };
}
