// SPDX-License-Identifier: Apache-2.0
// RED-phase spec for src/transport/eint.ts — the TypeScript mirror of
// echo_wasm_abi::pack_intent_v1 / unpack_intent_v1 (Rust).
//
// EINT envelope wire layout (matches echo-wasm-abi/src/lib.rs):
//   "EINT" magic (4 bytes)
//   op_id (u32 LE, 4 bytes)
//   vars_len (u32 LE, 4 bytes)
//   vars (vars_len bytes)
//
// op_id == 0xFFFFFFFF (CONTROL_INTENT_V1_OP_ID) is reserved and rejected
// by packIntentV1; control intents must use packControlIntentV1 (not in scope
// for this slice — added when the control path is needed).

import assert from 'node:assert/strict';
import test from 'node:test';

import {
    EintEnvelopeError,
    CONTROL_INTENT_V1_OP_ID,
    packIntentV1,
    unpackIntentV1,
} from '../dist/transport/eint.js';

test('EINT — packIntentV1', async t => {
    await t.test('empty vars produces 12-byte envelope: "EINT" + op_id LE + 0 length', () => {
        const bytes = packIntentV1(1, new Uint8Array(0));
        assert.deepEqual(
            Array.from(bytes),
            [
                0x45, 0x49, 0x4e, 0x54, // "EINT"
                0x01, 0x00, 0x00, 0x00, // op_id = 1, u32 LE
                0x00, 0x00, 0x00, 0x00, // vars_len = 0
            ],
        );
    });

    await t.test('op_id and vars_len both encode as u32 LE in the right slots', () => {
        const vars = new Uint8Array([0xaa, 0xbb, 0xcc]);
        const bytes = packIntentV1(0x01020304, vars);
        assert.deepEqual(
            Array.from(bytes),
            [
                0x45, 0x49, 0x4e, 0x54,       // "EINT"
                0x04, 0x03, 0x02, 0x01,       // op_id = 0x01020304 LE
                0x03, 0x00, 0x00, 0x00,       // vars_len = 3
                0xaa, 0xbb, 0xcc,             // vars
            ],
        );
    });

    await t.test('rejects the reserved control op id with EintEnvelopeError', () => {
        assert.throws(
            () => packIntentV1(CONTROL_INTENT_V1_OP_ID, new Uint8Array(0)),
            EintEnvelopeError,
        );
    });

    await t.test('CONTROL_INTENT_V1_OP_ID matches Rust u32::MAX', () => {
        assert.equal(CONTROL_INTENT_V1_OP_ID, 0xffffffff);
    });
});

test('EINT — unpackIntentV1', async t => {
    await t.test('unpacks (op_id, vars) for a well-formed envelope', () => {
        const bytes = packIntentV1(42, new Uint8Array([1, 2, 3, 4, 5]));
        const { opId, vars } = unpackIntentV1(bytes);
        assert.equal(opId, 42);
        assert.deepEqual(Array.from(vars), [1, 2, 3, 4, 5]);
    });

    await t.test('roundtrips through packIntentV1 for varied op_ids and payloads', () => {
        for (const opId of [0, 1, 7, 0xffff, 0x7fffffff, 0xfffffffe]) {
            const vars = new Uint8Array([opId & 0xff, (opId >>> 8) & 0xff]);
            const { opId: roundtripOp, vars: roundtripVars } = unpackIntentV1(
                packIntentV1(opId, vars),
            );
            assert.equal(roundtripOp, opId, `op_id ${opId} should roundtrip`);
            assert.deepEqual(Array.from(roundtripVars), Array.from(vars));
        }
    });

    await t.test('throws EintEnvelopeError when buffer is shorter than 12 bytes', () => {
        assert.throws(() => unpackIntentV1(new Uint8Array(11)), EintEnvelopeError);
    });

    await t.test('throws EintEnvelopeError on missing "EINT" magic', () => {
        const bytes = packIntentV1(1, new Uint8Array(0));
        bytes[0] = 0x00; // corrupt magic
        assert.throws(() => unpackIntentV1(bytes), EintEnvelopeError);
    });

    await t.test('throws EintEnvelopeError when vars_len exceeds remaining bytes', () => {
        const bytes = new Uint8Array([
            0x45, 0x49, 0x4e, 0x54,           // "EINT"
            0x01, 0x00, 0x00, 0x00,           // op_id = 1
            0xff, 0xff, 0xff, 0x7f,           // vars_len = 0x7fffffff (way too big)
        ]);
        assert.throws(() => unpackIntentV1(bytes), EintEnvelopeError);
    });

    await t.test('rejects trailing bytes after declared vars_len (replay determinism)', () => {
        // header + 1 var byte + 1 trailing byte. Two distinct byte strings
        // (with vs without trailing) must not both decode to the same envelope —
        // installed transport hashes the FULL bytes for submission identity, so
        // silently truncating trailing data would break the 1:1 evidence/replay
        // mapping for EINT intents.
        const bytes = new Uint8Array([
            0x45, 0x49, 0x4e, 0x54,           // "EINT"
            0x01, 0x00, 0x00, 0x00,           // op_id = 1
            0x01, 0x00, 0x00, 0x00,           // vars_len = 1
            0xaa,                             // declared var
            0xff,                             // trailing garbage that must be rejected
        ]);
        assert.throws(() => unpackIntentV1(bytes), EintEnvelopeError);
    });
});

test('EINT — cross-boundary parity with echo-wasm-abi::pack_intent_v1', async t => {
    // The hex literals in this block MUST match the bytes asserted by
    // crates/echo-wasm-abi/tests/jedit_rope_cross_boundary_eint.rs in the
    // echo repo. They are the cross-boundary contract for the EINT envelope.

    await t.test('op_id=1, vars=[0x01, 0x02, 0x03] → fixed byte vector', () => {
        const bytes = packIntentV1(1, new Uint8Array([0x01, 0x02, 0x03]));
        assert.deepEqual(
            Array.from(bytes),
            [
                0x45, 0x49, 0x4e, 0x54,       // "EINT"
                0x01, 0x00, 0x00, 0x00,       // op_id = 1
                0x03, 0x00, 0x00, 0x00,       // vars_len = 3
                0x01, 0x02, 0x03,             // vars
            ],
        );
    });

    await t.test('op_id=0xdeadbeef, empty vars → fixed byte vector', () => {
        const bytes = packIntentV1(0xdeadbeef, new Uint8Array(0));
        assert.deepEqual(
            Array.from(bytes),
            [
                0x45, 0x49, 0x4e, 0x54,       // "EINT"
                0xef, 0xbe, 0xad, 0xde,       // op_id = 0xdeadbeef LE
                0x00, 0x00, 0x00, 0x00,       // vars_len = 0
            ],
        );
    });
});
