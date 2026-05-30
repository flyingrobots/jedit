// SPDX-License-Identifier: Apache-2.0
// EINT envelope → handler-request bridge for jedit's in-process transports.
//
// Encapsulates decoding the EINT envelope, looking up the worldline session
// via the session port, and turning failures (envelope decode, session not
// registered) into obstructed responses. Keeps `installed-jedit-contract-
// echo-transport.ts` focused on package/ticketed-work/handler-invocation
// concerns and bounded by the quality gate's complexity / import / line caps.

import {
  decodeJeditMutationIntentEnvelope,
  JEDIT_INTENT_REQUEST_KIND,
  JEDIT_TRANSPORT_STATUS_OBSTRUCTED,
  type DecodedJeditMutationIntent,
  type JeditIntentRequest,
  type JeditIntentResponse,
} from './jedit-echo-optic-codec.js';
import {
  OP_CREATE_BUFFER_WORLDLINE,
  OP_CREATE_CHECKPOINT,
  OP_REPLACE_RANGE_AS_TICK,
} from '../generated/jedit/rope.codec.generated.js';
import {
  JeditWorldlineSessionNotRegisteredError,
  type JeditWorldlineSessionPort,
} from '../ports/jedit-worldline-session-port.js';
// Re-exported so transport factories that wire the bridge can also
// construct the default in-memory port from one import statement (keeps
// installed-jedit-contract-echo-transport.ts under the quality-gate
// import cap).
export { createInMemoryJeditWorldlineSessionPort } from './in-memory-jedit-worldline-session-port.js';
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
  /**
   * Required — the bridge will NOT construct a private fallback port if
   * this is undefined. The shared-session-port invariant is the whole
   * point of Slice B; a private fallback hides DI mistakes behind a
   * spurious SESSION_NOT_REGISTERED obstruction emitted at dispatch time
   * instead of failing fast at construction.
   */
  readonly sessionPort: JeditWorldlineSessionPort;
}

export class JeditEintBridgeDependencyError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'JeditEintBridgeDependencyError';
  }
}

export function createInstalledJeditEintBridge(
  options: CreateJeditEintBridgeOptions,
): JeditEintBridge {
  // Reject undefined at runtime as well as at the type level — TS bypasses
  // (e.g. JS callers, `as unknown` casts) must still fail loudly here.
  if (options === undefined || options.sessionPort === undefined) {
    throw new JeditEintBridgeDependencyError(
      'createInstalledJeditEintBridge: options.sessionPort is required (no private fallback)',
    );
  }
  const { sessionPort } = options;
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
  // Dispatch on the numeric opId (stable wire discriminant), not on the
  // operationName string. The decoded value carries both, but opId is the
  // single source of truth from the envelope boundary; switching on the
  // string would create two tags that can drift.
  const kind = JEDIT_INTENT_REQUEST_KIND;
  switch (decoded.opId) {
    case OP_CREATE_BUFFER_WORLDLINE:
      return { kind, operationName: decoded.operationName, input: decoded.vars.input };
    case OP_REPLACE_RANGE_AS_TICK: {
      const session = sessionPort.getSession(decoded.vars.input.worldlineId);
      return { kind, operationName: decoded.operationName, session, input: decoded.vars.input };
    }
    case OP_CREATE_CHECKPOINT: {
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
