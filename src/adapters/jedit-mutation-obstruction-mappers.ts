// SPDX-License-Identifier: Apache-2.0
// Shared mutation-obstruction mappers used by in-process transports so the
// wire-level / session-level obstruction shapes stay consistent.
//
// Two functions, two return shapes:
//
//   envelopeDecodeObstructedResponse → JeditIntentResponse (full response)
//     Returns the whole response because envelope decode fails BEFORE the
//     caller has any structured upstream context to compose an obstruction
//     into; the obstruction is the response.
//
//   sessionNotRegisteredObstruction → JeditTransportObstruction (just the
//     obstruction; the caller composes it into a response, attaching the
//     operationName they already know from the decoded envelope).

import {
  JEDIT_TRANSPORT_STATUS_OBSTRUCTED,
  type JeditIntentResponse,
  type JeditTransportObstruction,
} from './jedit-echo-optic-codec.js';
import type { JeditWorldlineSessionNotRegisteredError } from '../ports/jedit-worldline-session-port.js';

export const MUTATION_ENVELOPE_DECODE_ERROR_CODE = 'JEDIT_MUTATION_ENVELOPE_INVALID';
export const MUTATION_ENVELOPE_DECODE_RECOVERY = 'resubmit the intent using a valid EINT mutation envelope';
export const SESSION_NOT_REGISTERED_CODE = 'JEDIT_WORLDLINE_SESSION_NOT_REGISTERED';
export const SESSION_NOT_REGISTERED_RECOVERY = 'register the worldline session via the optic client before dispatching';

/**
 * Obstructed response for an envelope that failed to decode.
 *
 * `operationName` is intentionally OMITTED — decode failed before we knew
 * what the caller submitted. Consumers must branch on `obstruction.code`
 * (`JEDIT_MUTATION_ENVELOPE_INVALID`), not on operationName.
 */
export function envelopeDecodeObstructedResponse(error: Error | undefined): JeditIntentResponse {
  return {
    status: JEDIT_TRANSPORT_STATUS_OBSTRUCTED,
    obstruction: {
      code: MUTATION_ENVELOPE_DECODE_ERROR_CODE,
      message: error?.message ?? 'invalid mutation envelope',
      recovery: MUTATION_ENVELOPE_DECODE_RECOVERY,
    },
  };
}

/** Obstruction (not response) for a session lookup that failed. */
export function sessionNotRegisteredObstruction(
  error: JeditWorldlineSessionNotRegisteredError,
): JeditTransportObstruction {
  return {
    code: SESSION_NOT_REGISTERED_CODE,
    message: error.message,
    worldlineId: error.worldlineId,
    recovery: SESSION_NOT_REGISTERED_RECOVERY,
  };
}

export class JeditExhaustivenessError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'JeditExhaustivenessError';
  }
}

/**
 * Runtime + compile-time exhaustiveness guard. Used in `switch` statements
 * over discriminated unions so missing a variant fails at compile and at
 * runtime if the variant escapes type-checking somehow. Dumps the offending
 * value via a try/catch around JSON.stringify so the diagnostic identifies
 * which variant leaked through; cyclic objects and BigInt (which both make
 * JSON.stringify itself throw) fall back to String(value) so the intended
 * JeditExhaustivenessError still constructs.
 */
export function assertNever(value: never, message: string): never {
  throw new JeditExhaustivenessError(`${message}: ${describeValue(value)}`);
}

function describeValue(value: never): string {
  try {
    const rendered = JSON.stringify(value);
    if (rendered !== undefined) {
      return rendered;
    }
  } catch {
    // JSON.stringify throws on cyclic structures and BigInt; fall through
    // to the safe representation below.
  }
  try {
    return String(value);
  } catch {
    return '<unserializable value>';
  }
}
