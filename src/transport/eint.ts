// SPDX-License-Identifier: Apache-2.0
// TypeScript mirror of echo_wasm_abi::pack_intent_v1 / unpack_intent_v1.
//
// EINT envelope wire layout:
//   "EINT" magic         (4 bytes)
//   op_id                (u32 LE, 4 bytes)
//   vars_len             (u32 LE, 4 bytes)
//   vars                 (vars_len bytes)
//
// op_id == 0xFFFFFFFF is reserved for privileged control intents
// (CONTROL_INTENT_V1_OP_ID); packIntentV1 rejects it. Control intents must
// use a dedicated packer once it is needed.

import { Writer } from '../codec.js';

const EINT_MAGIC = new Uint8Array([0x45, 0x49, 0x4e, 0x54]); // "EINT"
const ENVELOPE_HEADER_BYTES = 12;
const U32_MAX = 0xffffffff;

/** Reserved EINT op id used by privileged control intents. Matches Rust `u32::MAX`. */
export const CONTROL_INTENT_V1_OP_ID = U32_MAX;

/** Error raised by EINT envelope helpers when input bytes are malformed. */
export class EintEnvelopeError extends Error {
    public constructor(message: string) {
        super(message);
        this.name = 'EintEnvelopeError';
    }
}

/** Pack an EINT v1 envelope. Rejects the reserved control op id. */
export function packIntentV1(opId: number, vars: Uint8Array): Uint8Array {
    if (opId === CONTROL_INTENT_V1_OP_ID) {
        throw new EintEnvelopeError('op_id 0xFFFFFFFF is reserved for control intents');
    }
    if (!Number.isInteger(opId) || opId < 0 || opId > U32_MAX) {
        throw new EintEnvelopeError(`op_id ${opId} is not a u32`);
    }
    if (vars.byteLength > U32_MAX) {
        throw new EintEnvelopeError(`vars length ${vars.byteLength} does not fit in u32`);
    }
    const w = new Writer();
    w.writeBytes(EINT_MAGIC);
    w.writeU32Le(opId);
    w.writeU32Le(vars.byteLength);
    w.writeBytes(vars);
    return w.finish();
}

/** Unpacked EINT v1 envelope. */
export interface UnpackedIntent {
    readonly opId: number;
    readonly vars: Uint8Array;
}

/** Unpack an EINT v1 envelope. Throws EintEnvelopeError on malformed input. */
export function unpackIntentV1(bytes: Uint8Array): UnpackedIntent {
    if (bytes.byteLength < ENVELOPE_HEADER_BYTES) {
        throw new EintEnvelopeError(
            `envelope too short: ${bytes.byteLength} < ${ENVELOPE_HEADER_BYTES}`,
        );
    }
    for (let i = 0; i < EINT_MAGIC.length; i++) {
        if (bytes[i] !== EINT_MAGIC[i]) {
            throw new EintEnvelopeError('missing "EINT" magic header');
        }
    }
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const opId = view.getUint32(4, /* littleEndian */ true);
    const varsLen = view.getUint32(8, /* littleEndian */ true);
    const varsEnd = ENVELOPE_HEADER_BYTES + varsLen;
    if (varsEnd > bytes.byteLength) {
        const remaining = bytes.byteLength - ENVELOPE_HEADER_BYTES;
        throw new EintEnvelopeError(`vars_len ${varsLen} exceeds remaining bytes ${remaining}`);
    }
    return { opId, vars: bytes.subarray(ENVELOPE_HEADER_BYTES, varsEnd) };
}
