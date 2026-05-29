// SPDX-License-Identifier: Apache-2.0
// RED-phase spec for src/adapters/jedit-mutation-envelope-codec.ts.
//
// This is Slice A of the EINT cutover: an additive pair of functions that
// encode a (operationName, vars) tuple into an EINT envelope using the
// Wesley-generated rope codec, and decode an EINT envelope back into a
// discriminated union. No transport or optic-client changes here.
//
// The envelope wire layout is locked by spec/eint.spec.mjs and pinned in
// echo/crates/echo-wasm-abi/tests/jedit_rope_cross_boundary_eint.rs. The op
// ids are locked by spec/rope-op-ids.spec.mjs and pinned in
// wesley/crates/wesley-core/src/domain/operation.rs.

import assert from 'node:assert/strict';
import test from 'node:test';

import {
    OP_CREATE_BUFFER_WORLDLINE,
    OP_CREATE_CHECKPOINT,
    OP_REPLACE_RANGE_AS_TICK,
} from '../dist/generated/jedit/rope.codec.generated.js';
import {
    UnknownMutationOpIdError,
    decodeJeditMutationIntentEnvelope,
    encodeJeditMutationIntentEnvelope,
} from '../dist/adapters/jedit-mutation-envelope-codec.js';
import {
    CREATE_BUFFER_WORLDLINE_OPERATION,
    CREATE_CHECKPOINT_OPERATION,
    REPLACE_RANGE_AS_TICK_OPERATION,
} from '../dist/adapters/jedit-echo-optic-codec.js';
import { packIntentV1 } from '../dist/transport/eint.js';

function readU32Le(bytes, offset) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    return view.getUint32(offset, /* littleEndian */ true);
}

function assertEintHeader(bytes, opId) {
    assert.deepEqual(
        Array.from(bytes.subarray(0, 4)),
        [0x45, 0x49, 0x4e, 0x54],
        'EINT magic must be first four bytes',
    );
    assert.equal(readU32Le(bytes, 4), opId, 'op_id LE must be in bytes 4-7');
}

test('encode envelope — createBufferWorldline', async t => {
    await t.test('produces EINT magic + OP_CREATE_BUFFER_WORLDLINE op id', () => {
        const bytes = encodeJeditMutationIntentEnvelope({
            operationName: CREATE_BUFFER_WORLDLINE_OPERATION,
            vars: {
                input: {
                    bufferKey: 'demo.txt',
                    initialText: null,
                    projectionPath: null,
                    createInitialCheckpoint: null,
                },
            },
        });
        assertEintHeader(bytes, OP_CREATE_BUFFER_WORLDLINE);
    });

    await t.test('vars_len matches encoded vars length', () => {
        const bytes = encodeJeditMutationIntentEnvelope({
            operationName: CREATE_BUFFER_WORLDLINE_OPERATION,
            vars: {
                input: {
                    bufferKey: 'a',
                    initialText: 'hello',
                    projectionPath: null,
                    createInitialCheckpoint: true,
                },
            },
        });
        const varsLen = readU32Le(bytes, 8);
        assert.equal(bytes.byteLength, 12 + varsLen);
    });
});

test('encode envelope — replaceRangeAsTick', async t => {
    await t.test('produces EINT magic + OP_REPLACE_RANGE_AS_TICK op id', () => {
        const bytes = encodeJeditMutationIntentEnvelope({
            operationName: REPLACE_RANGE_AS_TICK_OPERATION,
            vars: {
                input: {
                    worldlineId: 'wl-001',
                    baseHeadId: 'hd-001',
                    startByte: 0,
                    endByte: 5,
                    insertText: 'world',
                    author: null,
                },
            },
        });
        assertEintHeader(bytes, OP_REPLACE_RANGE_AS_TICK);
    });
});

test('encode envelope — createCheckpoint', async t => {
    await t.test('produces EINT magic + OP_CREATE_CHECKPOINT op id', () => {
        const bytes = encodeJeditMutationIntentEnvelope({
            operationName: CREATE_CHECKPOINT_OPERATION,
            vars: {
                input: {
                    worldlineId: 'wl-001',
                    kind: 'MANUAL_SAVE',
                    label: 'before refactor',
                },
            },
        });
        assertEintHeader(bytes, OP_CREATE_CHECKPOINT);
    });
});

test('decode envelope — roundtrips every mutation', async t => {
    const cases = [
        {
            name: 'createBufferWorldline',
            mutation: {
                operationName: CREATE_BUFFER_WORLDLINE_OPERATION,
                vars: {
                    input: {
                        bufferKey: 'roundtrip.txt',
                        initialText: 'hi',
                        projectionPath: '/src',
                        createInitialCheckpoint: false,
                    },
                },
            },
            expectedOpId: OP_CREATE_BUFFER_WORLDLINE,
        },
        {
            name: 'replaceRangeAsTick',
            mutation: {
                operationName: REPLACE_RANGE_AS_TICK_OPERATION,
                vars: {
                    input: {
                        worldlineId: 'wl-7',
                        baseHeadId: 'hd-7',
                        startByte: 10,
                        endByte: 20,
                        insertText: 'replacement',
                        author: 'james',
                    },
                },
            },
            expectedOpId: OP_REPLACE_RANGE_AS_TICK,
        },
        {
            name: 'createCheckpoint',
            mutation: {
                operationName: CREATE_CHECKPOINT_OPERATION,
                vars: {
                    input: {
                        worldlineId: 'wl-99',
                        kind: 'AUTO_SAVE',
                        label: null,
                    },
                },
            },
            expectedOpId: OP_CREATE_CHECKPOINT,
        },
    ];

    for (const { name, mutation, expectedOpId } of cases) {
        await t.test(`${name} roundtrips through envelope`, () => {
            const bytes = encodeJeditMutationIntentEnvelope(mutation);
            const decoded = decodeJeditMutationIntentEnvelope(bytes);
            assert.equal(decoded.opId, expectedOpId, 'opId mismatch');
            assert.equal(decoded.operationName, mutation.operationName);
            assert.deepEqual(decoded.vars, mutation.vars);
        });
    }
});

test('decode envelope — unknown op id throws UnknownMutationOpIdError', async t => {
    await t.test('op id that does not name a mutation throws typed error', () => {
        // Fabricate an EINT with a non-mutation op id. 0xdeadbeef is not
        // OP_CREATE_BUFFER_WORLDLINE / OP_REPLACE_RANGE_AS_TICK /
        // OP_CREATE_CHECKPOINT, so the decoder should refuse it.
        const bogus = packIntentV1(0xdeadbeef, new Uint8Array([0]));
        assert.throws(() => decodeJeditMutationIntentEnvelope(bogus), UnknownMutationOpIdError);
    });

    await t.test('error carries the offending op id', () => {
        const bogus = packIntentV1(0xdeadbeef, new Uint8Array([0]));
        try {
            decodeJeditMutationIntentEnvelope(bogus);
            assert.fail('expected UnknownMutationOpIdError');
        } catch (error) {
            assert.ok(error instanceof UnknownMutationOpIdError);
            assert.equal(error.opId, 0xdeadbeef);
        }
    });
});

test('decode envelope — malformed bytes propagate EINT errors', async t => {
    await t.test('buffer shorter than 12 bytes throws EintEnvelopeError', async () => {
        const { EintEnvelopeError } = await import('../dist/transport/eint.js');
        assert.throws(() => decodeJeditMutationIntentEnvelope(new Uint8Array(5)), EintEnvelopeError);
    });
});
