// Challenge tests for the flat cut machine and the two height lemmas behind
// its bound. They sample trees and offsets; passing them is evidence, not a
// proof. See docs/design/0159-edict-rope-representation.md (Flat cut bound).
import assert from 'node:assert/strict';
import test from 'node:test';
import { height, NewBranch, NewLeaf, RopeBuilder } from '../../../tests/support/replace-range-schema-2/rope-build.mts';
import { flatCut, flatCutBound } from './flat-cut-model.mts';

const MAX_HEIGHT = 14;
const builder = new RopeBuilder({ expand: () => { throw new Error('every node here is fresh'); } });
const leaf = (size) => new NewLeaf(new Uint8Array(size).fill(0x61));
const length = (rope) => (rope === null ? 0n : rope instanceof NewLeaf ? BigInt(rope.bytes.length) : rope.byteLength);

// A deterministic generator, so a failure names a reproducible case.
function random(seed) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}

function perfect(h, size = 3) {
  return h === 1 ? leaf(size) : new NewBranch(perfect(h - 1, size), perfect(h - 1, size));
}
function fibonacci(h, leftHeavy) {
  if (h === 1) return leaf(2);
  if (h === 2) return new NewBranch(leaf(2), leaf(3));
  const [taller, shorter] = [fibonacci(h - 1, leftHeavy), fibonacci(h - 2, leftHeavy)];
  return leftHeavy ? new NewBranch(taller, shorter) : new NewBranch(shorter, taller);
}
// Random AVL trees grown by the join under test, from leaves of random sizes.
function grown(next, leaves) {
  let rope = null;
  for (let index = 0; index < leaves; index += 1) rope = builder.join(rope, leaf(1 + Math.floor(next() * 5)));
  return rope;
}

function trees() {
  const next = random(296);
  const out = [];
  for (let h = 1; h <= MAX_HEIGHT; h += 1) out.push(perfect(h), fibonacci(h, true), fibonacci(h, false));
  for (let count = 0; count < 40; count += 1) {
    const rope = grown(next, 2 + Math.floor(next() * 400));
    if (height(rope) <= BigInt(MAX_HEIGHT)) out.push(rope);
  }
  return out;
}

function offsets(rope, next) {
  const total = length(rope);
  const picks = new Set([0n, 1n, total - 1n, total, total / 2n]);
  for (let count = 0; count < 12; count += 1) picks.add(BigInt(Math.floor(next() * Number(total + 1n))));
  return [...picks].filter((offset) => offset >= 0n && offset <= total);
}

// Shape, lengths and heights in order; equal shapes mean the same reconstruction.
function shape(rope) {
  if (rope === null) return '-';
  if (rope instanceof NewLeaf) return `L${rope.bytes.length}`;
  return `(${shape(rope.left)} ${shape(rope.right)} h${rope.height})`;
}

test('the flat machine reproduces prefix and suffix within its literal bound', () => {
  const next = random(14);
  for (const rope of trees()) {
    const h = Number(height(rope));
    for (const offset of offsets(rope, next)) {
      for (const keepLeft of [true, false]) {
        const expected = keepLeft ? builder.prefix(rope, offset) : builder.suffix(rope, offset);
        const run = flatCut(builder, rope, offset, keepLeft, flatCutBound(h));
        assert.ok(run.finished, `h=${h} offset=${offset} keepLeft=${keepLeft}: ${run.rounds} rounds`);
        assert.ok(run.rounds <= flatCutBound(MAX_HEIGHT));
        assert.equal(shape(run.rope), shape(expected), `h=${h} offset=${offset} keepLeft=${keepLeft}`);
      }
    }
  }
});

test('a run cut short reports an unfinished machine, never a result', () => {
  const rope = perfect(8);
  const run = flatCut(builder, rope, length(rope) / 2n + 1n, true, 3);
  assert.equal(run.finished, false);
});

// Lemma 1: join(l, r) has height at most max(height(l), height(r)) + 1.
test('lemma 1 challenge: a join is at most one level taller than its taller input', () => {
  const next = random(1);
  const pool = trees();
  for (let count = 0; count < 400; count += 1) {
    const [l, r] = [pool[Math.floor(next() * pool.length)], pool[Math.floor(next() * pool.length)]];
    const joined = builder.join(l, r);
    const taller = height(l) > height(r) ? height(l) : height(r);
    assert.ok(height(joined) <= taller + 1n, `${height(l)} ⋈ ${height(r)} -> ${height(joined)}`);
  }
});

// Lemma 2: a prefix or suffix of a tree of height c has height at most c + 1.
test('lemma 2 challenge: a prefix or suffix is at most one level taller than its tree', () => {
  const next = random(2);
  for (const rope of trees()) {
    for (const offset of offsets(rope, next)) {
      for (const cut of [builder.prefix(rope, offset), builder.suffix(rope, offset)]) {
        if (cut !== null) assert.ok(height(cut) <= height(rope) + 1n, `${height(rope)} -> ${height(cut)}`);
      }
    }
  }
});
