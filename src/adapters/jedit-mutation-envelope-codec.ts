// SPDX-License-Identifier: Apache-2.0
// EINT envelope codec for jedit mutation intents.
//
// This is Slice A of the EINT cutover. It is additive: it does not change
// any existing transport behavior. It exposes a pair of functions that the
// optic-client cutover (Slice B) will use to swap the JSON wire for the
// Wesley-generated LE binary + EINT envelope wire that warp-wasm already
// expects on the input side.
//
// Wire layout:
//   packIntentV1(opId, encode<Op>Vars(vars))
//   where opId is the Wesley-generated OP_<NAME> constant, and
//   encode<Op>Vars is the matching generated codec.
//
// See jedit/spec/jedit-mutation-envelope-codec.spec.mjs for the contract.

import {
    CREATE_BUFFER_WORLDLINE_OPERATION,
    CREATE_CHECKPOINT_OPERATION,
    REPLACE_RANGE_AS_TICK_OPERATION,
} from './jedit-echo-optic-codec.js';
import {
    OP_CREATE_BUFFER_WORLDLINE,
    OP_CREATE_CHECKPOINT,
    OP_REPLACE_RANGE_AS_TICK,
    decodeCreateBufferWorldlineVars,
    decodeCreateCheckpointVars,
    decodeReplaceRangeAsTickVars,
    encodeCreateBufferWorldlineVars,
    encodeCreateCheckpointVars,
    encodeReplaceRangeAsTickVars,
    type CreateBufferWorldlineVars,
    type CreateCheckpointVars,
    type ReplaceRangeAsTickVars,
} from '../generated/jedit/rope.codec.generated.js';
import { packIntentV1, unpackIntentV1 } from '../transport/eint.js';

/** Discriminated union: each jedit mutation paired with its codec-shaped vars. */
export type JeditMutationEnvelopeInput =
    | {
        readonly operationName: typeof CREATE_BUFFER_WORLDLINE_OPERATION;
        readonly vars: CreateBufferWorldlineVars;
    }
    | {
        readonly operationName: typeof REPLACE_RANGE_AS_TICK_OPERATION;
        readonly vars: ReplaceRangeAsTickVars;
    }
    | {
        readonly operationName: typeof CREATE_CHECKPOINT_OPERATION;
        readonly vars: CreateCheckpointVars;
    };

/** Result of decoding an EINT envelope known to carry a jedit mutation. */
export type DecodedJeditMutationIntent =
    | {
        readonly opId: typeof OP_CREATE_BUFFER_WORLDLINE;
        readonly operationName: typeof CREATE_BUFFER_WORLDLINE_OPERATION;
        readonly vars: CreateBufferWorldlineVars;
    }
    | {
        readonly opId: typeof OP_REPLACE_RANGE_AS_TICK;
        readonly operationName: typeof REPLACE_RANGE_AS_TICK_OPERATION;
        readonly vars: ReplaceRangeAsTickVars;
    }
    | {
        readonly opId: typeof OP_CREATE_CHECKPOINT;
        readonly operationName: typeof CREATE_CHECKPOINT_OPERATION;
        readonly vars: CreateCheckpointVars;
    };

/** Raised when a decoded EINT envelope's op id is not a jedit mutation. */
export class UnknownMutationOpIdError extends Error {
    public readonly opId: number;

    public constructor(opId: number) {
        super(`op id ${opId} does not name a jedit mutation`);
        this.name = 'UnknownMutationOpIdError';
        this.opId = opId;
    }
}

/** Encode a jedit mutation as an EINT v1 envelope carrying LE binary vars. */
export function encodeJeditMutationIntentEnvelope(
    request: JeditMutationEnvelopeInput,
): Uint8Array {
    switch (request.operationName) {
        case CREATE_BUFFER_WORLDLINE_OPERATION:
            return packIntentV1(
                OP_CREATE_BUFFER_WORLDLINE,
                encodeCreateBufferWorldlineVars(request.vars),
            );
        case REPLACE_RANGE_AS_TICK_OPERATION:
            return packIntentV1(
                OP_REPLACE_RANGE_AS_TICK,
                encodeReplaceRangeAsTickVars(request.vars),
            );
        case CREATE_CHECKPOINT_OPERATION:
            return packIntentV1(
                OP_CREATE_CHECKPOINT,
                encodeCreateCheckpointVars(request.vars),
            );
        default:
            // Runtime guard: TS exhaustiveness already enforces this at
            // compile time, but if JeditMutationEnvelopeInput gains a variant
            // and this switch falls through, callers must not silently get
            // an undefined Uint8Array. assertNever lives in
            // jedit-mutation-obstruction-mappers; using it would couple this
            // module to an unrelated file, so we inline a tiny throw here.
            throw new UnsupportedEncodeOperationError(request);
    }
}

class UnsupportedEncodeOperationError extends Error {
    public constructor(value: never) {
        super(`encodeJeditMutationIntentEnvelope: unsupported request shape ${JSON.stringify(value)}`);
        this.name = 'UnsupportedEncodeOperationError';
    }
}

/**
 * Decode an EINT v1 envelope as a jedit mutation.
 *
 * Throws `EintEnvelopeError` (re-thrown from `unpackIntentV1`) for malformed
 * envelopes, and `UnknownMutationOpIdError` if the envelope's op id is not
 * one of the jedit mutation op ids.
 */
export function decodeJeditMutationIntentEnvelope(
    bytes: Uint8Array,
): DecodedJeditMutationIntent {
    const { opId, vars } = unpackIntentV1(bytes);
    switch (opId) {
        case OP_CREATE_BUFFER_WORLDLINE:
            return {
                opId: OP_CREATE_BUFFER_WORLDLINE,
                operationName: CREATE_BUFFER_WORLDLINE_OPERATION,
                vars: decodeCreateBufferWorldlineVars(vars),
            };
        case OP_REPLACE_RANGE_AS_TICK:
            return {
                opId: OP_REPLACE_RANGE_AS_TICK,
                operationName: REPLACE_RANGE_AS_TICK_OPERATION,
                vars: decodeReplaceRangeAsTickVars(vars),
            };
        case OP_CREATE_CHECKPOINT:
            return {
                opId: OP_CREATE_CHECKPOINT,
                operationName: CREATE_CHECKPOINT_OPERATION,
                vars: decodeCreateCheckpointVars(vars),
            };
        default:
            throw new UnknownMutationOpIdError(opId);
    }
}
