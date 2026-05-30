// Fixture vector tests for src/codec.ts.
//
// These tests prove that the TypeScript Writer/Reader produces identical byte
// sequences to the Rust codec (echo-wasm-abi::codec). Fixture vectors are
// golden bytes computed from the Rust implementation and checked here.
//
// Phase 3 of 0024-universal-le-binary-codec.
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';

const REPO_ROOT = process.cwd();
const CODEC_PATH = pathToFileURL(path.join(REPO_ROOT, 'dist', 'codec.js'));

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

/** Hex-encode a Uint8Array for readable assertion messages. */
function hex(bytes) {
    return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join(' ');
}

/** Round-trip: write then read, return the decoded value. */
function rt(write, read) {
    const { Writer, Reader } = rt._mod;
    const w = new Writer();
    write(w);
    const buf = w.finish();
    const r = new Reader(buf);
    return { value: read(r), bytes: buf };
}
rt._mod = null;

// ---------------------------------------------------------------------------
// tests
// ---------------------------------------------------------------------------

await test('codec primitives', async t => {
    const mod = await import(CODEC_PATH);
    rt._mod = mod;
    const { Writer, Reader, canonicalizeF32 } = mod;

    // ── u8 ────────────────────────────────────────────────────────────────

    await t.test('u8 roundtrip zero', () => {
        const { value } = rt(w => w.writeU8(0), r => r.readU8());
        assert.equal(value, 0);
    });

    await t.test('u8 roundtrip 255', () => {
        const { value } = rt(w => w.writeU8(255), r => r.readU8());
        assert.equal(value, 255);
    });

    // ── range checks (fail-fast on invalid integer inputs) ─────────────────

    await t.test('writeU8 rejects negative', () => {
        const w = new Writer();
        assert.throws(() => w.writeU8(-1), /out of range|u8/i);
    });

    await t.test('writeU8 rejects > 255', () => {
        const w = new Writer();
        assert.throws(() => w.writeU8(256), /out of range|u8/i);
    });

    await t.test('writeU8 rejects non-integer', () => {
        const w = new Writer();
        assert.throws(() => w.writeU8(1.5), /out of range|u8/i);
    });

    await t.test('writeU16Le rejects > 65535', () => {
        const w = new Writer();
        assert.throws(() => w.writeU16Le(65536), /out of range|u16/i);
    });

    await t.test('writeU32Le rejects > u32 max', () => {
        const w = new Writer();
        assert.throws(() => w.writeU32Le(0x1_0000_0000), /out of range|u32/i);
    });

    await t.test('writeU32Le rejects negative', () => {
        const w = new Writer();
        assert.throws(() => w.writeU32Le(-1), /out of range|u32/i);
    });

    await t.test('writeI32Le rejects > i32 max', () => {
        const w = new Writer();
        assert.throws(() => w.writeI32Le(0x8000_0000), /out of range|i32/i);
    });

    await t.test('writeI32Le rejects < i32 min', () => {
        const w = new Writer();
        assert.throws(() => w.writeI32Le(-0x8000_0001), /out of range|i32/i);
    });

    await t.test('writeI32Le rejects non-integer', () => {
        const w = new Writer();
        assert.throws(() => w.writeI32Le(0.5), /out of range|i32/i);
    });

    // ── u32 ───────────────────────────────────────────────────────────────

    await t.test('u32 wire bytes — 0x01020304 is little-endian', () => {
        const w = new Writer();
        w.writeU32Le(0x01020304);
        assert.deepEqual(w.finish(), new Uint8Array([0x04, 0x03, 0x02, 0x01]));
    });

    await t.test('u32 roundtrip max', () => {
        const { value } = rt(w => w.writeU32Le(0xffffffff), r => r.readU32Le());
        assert.equal(value, 0xffffffff);
    });

    // ── i32 ───────────────────────────────────────────────────────────────

    await t.test('i32 wire bytes — 0x01020304 is little-endian', () => {
        const w = new Writer();
        w.writeI32Le(0x01020304);
        assert.deepEqual(w.finish(), new Uint8Array([0x04, 0x03, 0x02, 0x01]));
    });

    await t.test('i32 roundtrip zero', () => {
        const { value } = rt(w => w.writeI32Le(0), r => r.readI32Le());
        assert.equal(value, 0);
    });

    await t.test('i32 roundtrip negative', () => {
        const { value } = rt(w => w.writeI32Le(-1), r => r.readI32Le());
        assert.equal(value, -1);
    });

    await t.test('i32 roundtrip min', () => {
        const { value } = rt(w => w.writeI32Le(-2147483648), r => r.readI32Le());
        assert.equal(value, -2147483648);
    });

    await t.test('i32 roundtrip max', () => {
        const { value } = rt(w => w.writeI32Le(2147483647), r => r.readI32Le());
        assert.equal(value, 2147483647);
    });

    // ── f32 canonicalization ──────────────────────────────────────────────

    await t.test('canonicalizeF32: NaN → 0x7fc00000', () => {
        const w = new Writer();
        w.writeF32Le(NaN);
        const buf = w.finish();
        // LE bytes of 0x7fc00000 = [0x00, 0x00, 0xc0, 0x7f]
        assert.deepEqual(
            buf,
            new Uint8Array([0x00, 0x00, 0xc0, 0x7f]),
            `got: ${hex(buf)}`,
        );
    });

    await t.test('canonicalizeF32: subnormal → +0.0', () => {
        // Smallest positive subnormal as f32 = bit pattern 0x00000001.
        // DataView.setFloat32 with this value in JS: pass the f64 that narrows
        // to exactly f32 subnormal 0x00000001.
        // JavaScript: the closest f64 to 0x00000001 (as f32) is ~1.4e-45.
        const subnormalBits32 = 0x00000001;
        // Reconstruct as JS number via DataView
        const tmp = new DataView(new ArrayBuffer(4));
        tmp.setUint32(0, subnormalBits32, false);
        const subnormalF32 = tmp.getFloat32(0, false);
        assert(subnormalF32 < 1e-38, 'sanity: should be subnormal magnitude');

        const canonical = canonicalizeF32(subnormalF32);
        assert.equal(canonical, 0, `expected +0.0, got ${canonical}`);
    });

    await t.test('canonicalizeF32: -0.0 → +0.0', () => {
        const canonical = canonicalizeF32(-0);
        // +0 and -0 are equal under ===; distinguish via 1/-0 sign
        assert.equal(1 / canonical, Infinity, 'expected +0.0, got -0.0');
    });

    await t.test('canonicalizeF32: +Infinity unchanged', () => {
        const canonical = canonicalizeF32(Infinity);
        assert.equal(canonical, Infinity);
    });

    await t.test('canonicalizeF32: normal value 1.5 unchanged', () => {
        const canonical = canonicalizeF32(1.5);
        assert.equal(canonical, 1.5);
    });

    await t.test('f32 roundtrip normal value 1.5', () => {
        const { value } = rt(w => w.writeF32Le(1.5), r => r.readF32Le());
        assert.equal(value, 1.5);
    });

    await t.test('f32 roundtrip NaN canonicalizes to 0x7fc00000', () => {
        const { value } = rt(w => w.writeF32Le(NaN), r => r.readF32Le());
        // Check the bit pattern via DataView
        const tmp = new DataView(new ArrayBuffer(4));
        tmp.setFloat32(0, value, false);
        const bits = tmp.getUint32(0, false);
        assert.equal(bits, 0x7fc00000, `expected canonical NaN bits, got 0x${bits.toString(16)}`);
    });

    await t.test('f32 roundtrip -0.0 canonicalizes to +0.0', () => {
        const { value } = rt(w => w.writeF32Le(-0), r => r.readF32Le());
        assert.equal(1 / value, Infinity, 'expected +0.0');
    });

    // ── bool ──────────────────────────────────────────────────────────────

    await t.test('bool wire bytes', () => {
        const w = new Writer();
        w.writeBool(0);
        w.writeBool(1);
        assert.deepEqual(w.finish(), new Uint8Array([0x00, 0x01]));
    });

    await t.test('bool roundtrip false', () => {
        const { value } = rt(w => w.writeBool(0), r => r.readBool());
        assert.equal(value, false);
    });

    await t.test('bool roundtrip true', () => {
        const { value } = rt(w => w.writeBool(1), r => r.readBool());
        assert.equal(value, true);
    });

    await t.test('bool invalid tag throws CodecError', () => {
        const { CodecError } = mod;
        const r = new Reader(new Uint8Array([0x02]));
        assert.throws(() => r.readBool(), CodecError);
    });

    // ── string ────────────────────────────────────────────────────────────

    await t.test('string roundtrip empty', () => {
        const { value } = rt(w => w.writeString(''), r => r.readString());
        assert.equal(value, '');
    });

    await t.test('string roundtrip ascii', () => {
        const { value } = rt(w => w.writeString('hello'), r => r.readString());
        assert.equal(value, 'hello');
    });

    await t.test('string roundtrip utf-8 multibyte', () => {
        const { value } = rt(w => w.writeString('café'), r => r.readString());
        assert.equal(value, 'café');
    });

    await t.test('string wire bytes — u32 LE length prefix', () => {
        const w = new Writer();
        w.writeString('hi');
        // length=2 LE → [0x02, 0x00, 0x00, 0x00], then 'h'=0x68, 'i'=0x69
        assert.deepEqual(
            w.finish(),
            new Uint8Array([0x02, 0x00, 0x00, 0x00, 0x68, 0x69]),
        );
    });

    await t.test('string invalid utf-8 bytes throw CodecError', () => {
        const { CodecError } = mod;
        // Manually build: u32 LE length=1, then 0xff (invalid UTF-8 byte)
        const w = new Writer();
        w.writeU32Le(1);
        w.writeU8(0xff);
        const r = new Reader(w.finish());
        assert.throws(() => r.readString(), CodecError);
    });

        // ── option ────────────────────────────────────────────────────────────

    await t.test('option None wire byte is 0x00', () => {
        const w = new Writer();
        w.writeOption(null, (w, v) => w.writeU32Le(v));
        assert.deepEqual(w.finish(), new Uint8Array([0x00]));
    });

    await t.test('option Some roundtrip u32', () => {
        const { value } = rt(
            w => w.writeOption(999, (w, v) => w.writeU32Le(v)),
            r => r.readOption(r => r.readU32Le()),
        );
        assert.equal(value, 999);
    });

    await t.test('option None roundtrip returns null', () => {
        const { value } = rt(
            w => w.writeOption(null, (w, v) => w.writeU32Le(v)),
            r => r.readOption(r => r.readU32Le()),
        );
        assert.equal(value, null);
    });

    await t.test('option Some string roundtrip', () => {
        const { value } = rt(
            w => w.writeOption('world', (w, v) => w.writeString(v)),
            r => r.readOption(r => r.readString()),
        );
        assert.equal(value, 'world');
    });

    // ── list ──────────────────────────────────────────────────────────────

    await t.test('list empty wire is 4 zero bytes', () => {
        const w = new Writer();
        w.writeList([], (w, v) => w.writeU32Le(v));
        assert.deepEqual(w.finish(), new Uint8Array([0x00, 0x00, 0x00, 0x00]));
    });

    await t.test('list roundtrip 3 u32 elements', () => {
        const { value } = rt(
            w => w.writeList([1, 2, 3], (w, v) => w.writeU32Le(v)),
            r => r.readList(r => r.readU32Le()),
        );
        assert.deepEqual(value, [1, 2, 3]);
    });

    await t.test('list roundtrip strings', () => {
        const { value } = rt(
            w => w.writeList(['alpha', 'beta', 'gamma'], (w, v) => w.writeString(v)),
            r => r.readList(r => r.readString()),
        );
        assert.deepEqual(value, ['alpha', 'beta', 'gamma']);
    });

    // ── golden fixture vectors ─────────────────────────────────────────────
    // These byte sequences were generated from the Rust codec and are pinned
    // here. Any change to the encoding table is a breaking change.

    await t.test('golden: i32(-1) LE = ff ff ff ff', () => {
        const w = new Writer();
        w.writeI32Le(-1);
        assert.deepEqual(w.finish(), new Uint8Array([0xff, 0xff, 0xff, 0xff]));
    });

    await t.test('golden: i32(256) LE = 00 01 00 00', () => {
        const w = new Writer();
        w.writeI32Le(256);
        assert.deepEqual(w.finish(), new Uint8Array([0x00, 0x01, 0x00, 0x00]));
    });

    await t.test('golden: f32(1.0) LE = 00 00 80 3f', () => {
        // f32 1.0 = 0x3f800000 → LE bytes [0x00, 0x00, 0x80, 0x3f]
        const w = new Writer();
        w.writeF32Le(1.0);
        assert.deepEqual(w.finish(), new Uint8Array([0x00, 0x00, 0x80, 0x3f]));
    });

    await t.test('golden: bool(false) = 00, bool(true) = 01', () => {
        const wf = new Writer();
        wf.writeBool(0);
        assert.deepEqual(wf.finish(), new Uint8Array([0x00]));

        const wt = new Writer();
        wt.writeBool(1);
        assert.deepEqual(wt.finish(), new Uint8Array([0x01]));
    });

    await t.test('golden: option(Some(42u32)) = 01 2a 00 00 00', () => {
        const w = new Writer();
        w.writeOption(42, (w, v) => w.writeU32Le(v));
        // 0x01 = present, 42 = 0x0000002a → LE [0x2a, 0x00, 0x00, 0x00]
        assert.deepEqual(
            w.finish(),
            new Uint8Array([0x01, 0x2a, 0x00, 0x00, 0x00]),
        );
    });

    await t.test('golden: list([1u32, 2u32]) = 02000000 01000000 02000000', () => {
        const w = new Writer();
        w.writeList([1, 2], (w, v) => w.writeU32Le(v));
        assert.deepEqual(
            w.finish(),
            new Uint8Array([
                0x02, 0x00, 0x00, 0x00, // count=2
                0x01, 0x00, 0x00, 0x00, // 1
                0x02, 0x00, 0x00, 0x00, // 2
            ]),
        );
    });
});
