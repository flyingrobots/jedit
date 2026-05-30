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
import { createInMemoryJeditWorldlineSessionPort } from './in-memory-jedit-worldline-session-port.js';
import {
  JeditWorldlineSessionNotRegisteredError,
  type JeditWorldlineSessionPort,
} from '../ports/jedit-worldline-session-port.js';
import {
  assertNever,
  envelopeDecodeObstructedResponse,
  sessionNotRegisteredObstruction,
} from './jedit-mutation-obstruction-mappers.js';

export type DecodedEnvelope =
  | { readonly status: 'ok'; readonly decoded: DecodedJeditMutationIntent }
  | { readonly status: 'obstructed'; readonly response: JeditIntentResponse };

export type ResolvedIntent =
  | { readonly status: 'ok'; readonly request: JeditIntentRequest }
  | { readonly status: 'obstructed'; readonly response: JeditIntentResponse };

export interface JeditEintBridge {
  readonly sessionPort: JeditWorldlineSessionPort;
  /**
   * Decode the EINT envelope. Used by the installed transport so it can
   * check package-installed status (and emit a faithful obstructed
   * response keyed off the decoded operationName) BEFORE attempting
   * session resolution. Decoupling these two stages lets diagnostic
   * obstructions surface the more fundamental failure first.
   */
  decodeEnvelope(intentBytes: Uint8Array): DecodedEnvelope;
  /**
   * Resolve the session for a previously-decoded mutation envelope.
   * Looks up by `decoded.vars.input.worldlineId` for mutations that
   * carry a session; `createBufferWorldline` does not consult the port.
   */
  resolveSession(decoded: DecodedJeditMutationIntent): ResolvedIntent;
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
    decodeEnvelope(intentBytes) {
      return decodeEnvelopeInternal(intentBytes);
    },
    resolveSession(decoded) {
      return resolveSessionInternal(sessionPort, decoded);
    },
  };
}

function decodeEnvelopeInternal(intentBytes: Uint8Array): DecodedEnvelope {
  try {
    return { status: 'ok', decoded: decodeJeditMutationIntentEnvelope(intentBytes) };
  } catch (error) {
    return {
      status: 'obstructed',
      response: envelopeDecodeObstructedResponse(error instanceof Error ? error : undefined),
    };
  }
}

function resolveSessionInternal(
  sessionPort: JeditWorldlineSessionPort,
  decoded: DecodedJeditMutationIntent,
): ResolvedIntent {
  try {
    return { status: 'ok', request: buildHandlerRequestFromEnvelope(sessionPort, decoded) };
  } catch (error) {
    if (error instanceof JeditWorldlineSessionNotRegisteredError) {
      return obstructed({
        status: JEDIT_TRANSPORT_STATUS_OBSTRUCTED,
        operationName: decoded.operationName,
        obstruction: sessionNotRegisteredObstruction(error),
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
    default:
      return assertNever(decoded, 'Unsupported decoded mutation intent');
  }
}

function obstructed(response: JeditIntentResponse): ResolvedIntent {
  return { status: 'obstructed', response };
}
