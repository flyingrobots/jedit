// SPDX-License-Identifier: Apache-2.0
// RED-phase tests for src/generated/jedit/rope.codec.generated.ts.
//
// These tests will FAIL until the Wesley le-binary-typescript emitter is
// implemented and the generation script is run against contracts/jedit/rope.graphql.
//
// The byte vectors below are derived from the Rust echo-wesley-gen Encode impls
// (stack/echo-le-binary-codec) and serve as cross-boundary fixture proofs.
//
// Part of 0024-universal-le-binary-codec Phase 5.

import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';

const REPO_ROOT = process.cwd();
const ROPE_CODEC_PATH = pathToFileURL(
    path.join(REPO_ROOT, 'dist', 'generated', 'jedit', 'rope.codec.generated.js'),
);

// ---------------------------------------------------------------------------
// module load — will throw if the file doesn't exist yet (RED phase)
// ---------------------------------------------------------------------------

let mod;
try {
    mod = await import(ROPE_CODEC_PATH);
} catch (err) {
    // Emit a single failing test so the test runner reports the gap clearly.
    // We do NOT call process.exit(...) here: process.exit terminates the
    // process synchronously, which can short-circuit node:test before the
    // registered test runs and turn a missing generated artifact into a
    // false-green run. Let node:test own termination — when this test
    // throws, the runner sets exit code 1 on its own.
    test('rope.codec.generated.ts must exist (run Wesley le-binary-typescript emitter)', () => {
        throw new Error(
            `rope.codec.generated.js not found. Run:\n` +
            `  node scripts/run-wesley-tool.mjs cli emit le-binary-typescript ` +
            `--schema contracts/jedit/rope.graphql ` +
            `--out src/generated/jedit/rope.codec.generated.ts\n` +
            `Original error: ${String(err)}`,
        );
    });
}

// ---------------------------------------------------------------------------
// helpers

/**
 * Encode a u32 as 4 little-endian bytes regardless of platform endianness.
 *
 * Uint32Array#buffer reflects platform byte order — using it to build
 * "expected" wire bytes assumes the host is little-endian, which is true
 * on x86/arm64 dev machines but is not a portable guarantee. DataView
 * with the littleEndian flag is the portable way to force LE bytes.
 */
function u32LeBytes(value) {
    const buf = new ArrayBuffer(4);
    new DataView(buf).setUint32(0, value, /* littleEndian */ true);
    return new Uint8Array(buf);
}
// ---------------------------------------------------------------------------

function hex(bytes) {
    return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join(' ');
}

// ---------------------------------------------------------------------------
// Enum codecs
// ---------------------------------------------------------------------------

await test('rope codec — enums', async t => {
    const { encodeAnchorBias, decodeAnchorBias } = mod;

    await t.test('AnchorBias LEFT → discriminant 0, u32 LE [00 00 00 00]', () => {
        const bytes = encodeAnchorBias('LEFT');
        assert.deepEqual(
            Array.from(bytes),
            [0x00, 0x00, 0x00, 0x00],
            `got: ${hex(bytes)}`,
        );
    });

    await t.test('AnchorBias RIGHT → discriminant 1, u32 LE [01 00 00 00]', () => {
        const bytes = encodeAnchorBias('RIGHT');
        assert.deepEqual(
            Array.from(bytes),
            [0x01, 0x00, 0x00, 0x00],
            `got: ${hex(bytes)}`,
        );
    });

    await t.test('AnchorBias roundtrip LEFT', () => {
        const bytes = encodeAnchorBias('LEFT');
        assert.equal(decodeAnchorBias(bytes), 'LEFT');
    });

    await t.test('AnchorBias roundtrip RIGHT', () => {
        const bytes = encodeAnchorBias('RIGHT');
        assert.equal(decodeAnchorBias(bytes), 'RIGHT');
    });

    await t.test('AnchorBias invalid discriminant throws CodecError', async () => {
        const { Writer, CodecError } = await import(
            pathToFileURL(path.join(REPO_ROOT, 'dist', 'codec.js')).href
        );
        const w = new Writer();
        w.writeU32Le(99); // out-of-range
        assert.throws(() => decodeAnchorBias(w.finish()), CodecError);
    });
});

await test('rope codec — CheckpointKind enum', async t => {
    const { encodeCheckpointKind, decodeCheckpointKind } = mod;

    // INITIAL=0, MANUAL_SAVE=1, AUTO_SAVE=2 (SDL declaration order)
    await t.test('INITIAL → 0', () => {
        assert.deepEqual(Array.from(encodeCheckpointKind('INITIAL')), [0x00, 0x00, 0x00, 0x00]);
    });

    await t.test('MANUAL_SAVE → 1', () => {
        assert.deepEqual(Array.from(encodeCheckpointKind('MANUAL_SAVE')), [0x01, 0x00, 0x00, 0x00]);
    });

    await t.test('AUTO_SAVE → 2', () => {
        assert.deepEqual(Array.from(encodeCheckpointKind('AUTO_SAVE')), [0x02, 0x00, 0x00, 0x00]);
    });

    await t.test('CheckpointKind roundtrip all variants', () => {
        for (const v of ['INITIAL', 'MANUAL_SAVE', 'AUTO_SAVE']) {
            assert.equal(decodeCheckpointKind(encodeCheckpointKind(v)), v);
        }
    });
});

// ---------------------------------------------------------------------------
// createBufferWorldline vars
// ---------------------------------------------------------------------------

await test('rope codec — encodeCreateBufferWorldlineVars', async t => {
    const { encodeCreateBufferWorldlineVars, decodeCreateBufferWorldlineVars } = mod;

    await t.test('minimal: bufferKey only, all optionals null', () => {
        // Wire layout (le-binary-v1 field order matches SDL declaration order):
        //   bufferKey: String!  → u32 LE len + UTF-8 bytes
        //   initialText: String → 0x00 (null)
        //   projectionPath: String → 0x00 (null)
        //   createInitialCheckpoint: Boolean → 0x00 (null)
        const bytes = encodeCreateBufferWorldlineVars({
            input: {
                bufferKey: 'demo.txt',
                initialText: null,
                projectionPath: null,
                createInitialCheckpoint: null,
            },
        });

        // bufferKey "demo.txt" = 8 bytes; length prefix 08 00 00 00
        const keyBytes = new TextEncoder().encode('demo.txt');
        const expected = new Uint8Array([
            ...u32LeBytes(keyBytes.length), // u32 LE length
            ...keyBytes,          // "demo.txt"
            0x00,                 // initialText: null
            0x00,                 // projectionPath: null
            0x00,                 // createInitialCheckpoint: null
        ]);
        assert.deepEqual(bytes, expected, `got: ${hex(bytes)}`);
    });

    await t.test('with initialText and createInitialCheckpoint=true', () => {
        const bytes = encodeCreateBufferWorldlineVars({
            input: {
                bufferKey: 'a',
                initialText: 'hello',
                projectionPath: null,
                createInitialCheckpoint: true,
            },
        });

        const enc = new TextEncoder();
        const keyBytes = enc.encode('a');
        const textBytes = enc.encode('hello');
        const expected = new Uint8Array([
            ...u32LeBytes(keyBytes.length),
            ...keyBytes,
            0x01, // initialText present
            ...u32LeBytes(textBytes.length),
            ...textBytes,
            0x00, // projectionPath null
            0x01, // createInitialCheckpoint present
            0x01, // value = true
        ]);
        assert.deepEqual(bytes, expected, `got: ${hex(bytes)}`);
    });

    await t.test('roundtrip minimal', () => {
        const input = {
            input: {
                bufferKey: 'roundtrip.txt',
                initialText: null,
                projectionPath: null,
                createInitialCheckpoint: null,
            },
        };
        const decoded = decodeCreateBufferWorldlineVars(encodeCreateBufferWorldlineVars(input));
        assert.deepEqual(decoded, input);
    });

    await t.test('roundtrip with all fields present', () => {
        const input = {
            input: {
                bufferKey: 'full.ts',
                initialText: 'export const x = 1;',
                projectionPath: '/src',
                createInitialCheckpoint: false,
            },
        };
        const decoded = decodeCreateBufferWorldlineVars(encodeCreateBufferWorldlineVars(input));
        assert.deepEqual(decoded, input);
    });
});

// ---------------------------------------------------------------------------
// replaceRangeAsTick vars
// ---------------------------------------------------------------------------

await test('rope codec — encodeReplaceRangeAsTickVars', async t => {
    const { encodeReplaceRangeAsTickVars, decodeReplaceRangeAsTickVars } = mod;

    await t.test('roundtrip with all required fields', () => {
        const input = {
            input: {
                worldlineId: 'wl-001',
                baseHeadId: 'hd-001',
                startByte: 0,
                endByte: 5,
                insertText: 'world',
                author: null,
            },
        };
        const decoded = decodeReplaceRangeAsTickVars(encodeReplaceRangeAsTickVars(input));
        assert.deepEqual(decoded, input);
    });

    await t.test('roundtrip with optional author present', () => {
        const input = {
            input: {
                worldlineId: 'wl-002',
                baseHeadId: 'hd-002',
                startByte: 10,
                endByte: 20,
                insertText: 'replacement',
                author: 'james',
            },
        };
        const decoded = decodeReplaceRangeAsTickVars(encodeReplaceRangeAsTickVars(input));
        assert.deepEqual(decoded, input);
    });

    await t.test('startByte and endByte are i32 LE (check wire layout for byte 0)', () => {
        // startByte=0 → [00 00 00 00], endByte=1 → [01 00 00 00]
        const bytes = encodeReplaceRangeAsTickVars({
            input: {
                worldlineId: 'w',
                baseHeadId: 'b',
                startByte: 0,
                endByte: 1,
                insertText: '',
                author: null,
            },
        });
        // Find startByte after: len("w") + "w" + len("b") + "b" + insertText
        // worldlineId: 4+1=5, baseHeadId: 4+1=5, then startByte: 4 bytes
        const wBytes = new TextEncoder().encode('w').length;
        const bBytes = new TextEncoder().encode('b').length;
        const afterStrings = (4 + wBytes) + (4 + bBytes);
        const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
        const startByteValue = view.getInt32(afterStrings, /* LE */ true);
        assert.equal(startByteValue, 0, 'startByte should be 0');
    });
});

// ---------------------------------------------------------------------------
// createCheckpoint vars
// ---------------------------------------------------------------------------

await test('rope codec — encodeCreateCheckpointVars', async t => {
    const { encodeCreateCheckpointVars, decodeCreateCheckpointVars } = mod;

    await t.test('roundtrip with MANUAL_SAVE and label', () => {
        const input = {
            input: {
                worldlineId: 'wl-001',
                kind: 'MANUAL_SAVE',
                label: 'before refactor',
            },
        };
        const decoded = decodeCreateCheckpointVars(encodeCreateCheckpointVars(input));
        assert.deepEqual(decoded, input);
    });

    await t.test('roundtrip with AUTO_SAVE and no label', () => {
        const input = {
            input: {
                worldlineId: 'wl-001',
                kind: 'AUTO_SAVE',
                label: null,
            },
        };
        const decoded = decodeCreateCheckpointVars(encodeCreateCheckpointVars(input));
        assert.deepEqual(decoded, input);
    });
});

// ---------------------------------------------------------------------------
// query vars
// ---------------------------------------------------------------------------

await test('rope codec — worldlineSnapshot and textWindow vars', async t => {
    const { encodeWorldlineSnapshotVars, decodeWorldlineSnapshotVars,
            encodeTextWindowVars, decodeTextWindowVars } = mod;

    await t.test('worldlineSnapshot roundtrip', () => {
        const input = { input: { worldlineId: 'wl-001' } };
        assert.deepEqual(decodeWorldlineSnapshotVars(encodeWorldlineSnapshotVars(input)), input);
    });

    await t.test('textWindow roundtrip', () => {
        const input = {
            input: {
                worldlineId: 'wl-001',
                cursorLine: 5,
                viewportLineCount: 40,
                beforeLines: 10,
                afterLines: 10,
                maxBytes: 8192,
            },
        };
        assert.deepEqual(decodeTextWindowVars(encodeTextWindowVars(input)), input);
    });
});

await test('rope codec — top-level vars decoders reject trailing bytes', async t => {
  const {
    encodeCreateBufferWorldlineVars,
    decodeCreateBufferWorldlineVars,
    encodeReplaceRangeAsTickVars,
    decodeReplaceRangeAsTickVars,
    encodeCreateCheckpointVars,
    decodeCreateCheckpointVars,
    encodeWorldlineSnapshotVars,
    decodeWorldlineSnapshotVars,
    encodeTextWindowVars,
    decodeTextWindowVars,
  } = mod;
  // Replay/submission-identity invariant: vars decoders MUST reject any
  // payload that has bytes past the structurally-declared end. Otherwise
  // "canonical + garbage" could decode the canonical input and discard the
  // trailer, allowing two distinct submission byte strings to execute the
  // same mutation under different recorded submission IDs.

  await t.test('decodeCreateBufferWorldlineVars rejects trailing byte', () => {
    const canonical = encodeCreateBufferWorldlineVars({
      input: { bufferKey: 'a', initialText: null, projectionPath: null, createInitialCheckpoint: null },
    });
    const padded = new Uint8Array(canonical.byteLength + 1);
    padded.set(canonical, 0);
    padded[canonical.byteLength] = 0xff;
    assert.throws(() => decodeCreateBufferWorldlineVars(padded), /trailing/);
  });

  await t.test('decodeReplaceRangeAsTickVars rejects trailing byte', () => {
    const canonical = encodeReplaceRangeAsTickVars({
      input: { worldlineId: 'wl', baseHeadId: 'h', startByte: 0, endByte: 0, insertText: '', author: null },
    });
    const padded = new Uint8Array(canonical.byteLength + 1);
    padded.set(canonical, 0);
    padded[canonical.byteLength] = 0xff;
    assert.throws(() => decodeReplaceRangeAsTickVars(padded), /trailing/);
  });

  await t.test('decodeCreateCheckpointVars rejects trailing byte', () => {
    const canonical = encodeCreateCheckpointVars({
      input: { worldlineId: 'wl', kind: 'MANUAL_SAVE', label: null },
    });
    const padded = new Uint8Array(canonical.byteLength + 1);
    padded.set(canonical, 0);
    padded[canonical.byteLength] = 0xff;
    assert.throws(() => decodeCreateCheckpointVars(padded), /trailing/);
  });

  await t.test('decodeWorldlineSnapshotVars rejects trailing byte', () => {
    const canonical = encodeWorldlineSnapshotVars({
      input: { worldlineId: 'wl' },
    });
    const padded = new Uint8Array(canonical.byteLength + 1);
    padded.set(canonical, 0);
    padded[canonical.byteLength] = 0xff;
    assert.throws(() => decodeWorldlineSnapshotVars(padded), /trailing/);
  });

  await t.test('decodeTextWindowVars rejects trailing byte', () => {
    const canonical = encodeTextWindowVars({
      input: {
        worldlineId: 'wl',
        cursorLine: 0,
        viewportLineCount: 10,
        beforeLines: 1,
        afterLines: 1,
        maxBytes: 1024,
      },
    });
    const padded = new Uint8Array(canonical.byteLength + 1);
    padded.set(canonical, 0);
    padded[canonical.byteLength] = 0xff;
    assert.throws(() => decodeTextWindowVars(padded), /trailing/);
  });
});
