// SPDX-License-Identifier: Apache-2.0
// Cross-boundary fixture proof for the rope-schema EINT op ids.
//
// These literals MUST stay bytewise identical to:
//   wesley/crates/wesley-core/src/domain/operation.rs (stable_op_id pinned tests)
//   echo/crates/echo-wesley-gen/src/main.rs (stable_op_id_pinned test mod)
//
// If any number here drifts, the EINT envelope no longer routes correctly
// across the Rust/TypeScript boundary. The whole point of generating op ids
// from a Wesley schema is that this assertion can never become false silently.

import assert from 'node:assert/strict';
import test from 'node:test';

import {
    OP_CREATE_BUFFER_WORLDLINE,
    OP_CREATE_CHECKPOINT,
    OP_REPLACE_RANGE_AS_TICK,
    OP_TEXT_WINDOW,
    OP_WORLDLINE_SNAPSHOT,
} from '../dist/generated/jedit/rope.codec.generated.js';

test('rope op ids — pinned cross-language constants', async t => {
    await t.test('createBufferWorldline (mutation) op id matches Rust', () => {
        assert.equal(OP_CREATE_BUFFER_WORLDLINE, 2_519_122_874);
    });

    await t.test('replaceRangeAsTick (mutation) op id matches Rust', () => {
        assert.equal(OP_REPLACE_RANGE_AS_TICK, 3_329_158_538);
    });

    await t.test('createCheckpoint (mutation) op id matches Rust', () => {
        assert.equal(OP_CREATE_CHECKPOINT, 3_744_251_216);
    });

    await t.test('worldlineSnapshot (query) op id matches Rust', () => {
        assert.equal(OP_WORLDLINE_SNAPSHOT, 3_219_688_859);
    });

    await t.test('textWindow (query) op id matches Rust', () => {
        assert.equal(OP_TEXT_WINDOW, 2_414_231_278);
    });

    await t.test('all op ids are u32 and disjoint', () => {
        const ids = [
            OP_CREATE_BUFFER_WORLDLINE,
            OP_REPLACE_RANGE_AS_TICK,
            OP_CREATE_CHECKPOINT,
            OP_WORLDLINE_SNAPSHOT,
            OP_TEXT_WINDOW,
        ];
        for (const id of ids) {
            assert.ok(Number.isInteger(id), `op id ${id} must be integer`);
            assert.ok(id >= 0 && id <= 0xffffffff, `op id ${id} must fit in u32`);
        }
        assert.equal(new Set(ids).size, ids.length, 'op ids must be disjoint');
    });
});
