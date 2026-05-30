// SPDX-License-Identifier: Apache-2.0
// Shared mutation-obstruction mappers used by both in-process transports
// (`installed-jedit-eint-bridge.ts` and `fake-echo-jedit-optic-transport.ts`)
// so the wire-level / session-level obstruction shapes stay consistent.

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
 * runtime if the variant escapes type-checking somehow.
 */
export function assertNever(value: never, message: string): never {
  throw new JeditExhaustivenessError(`${message}: ${String(value)}`);
}
