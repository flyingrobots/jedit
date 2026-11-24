// Executable model of the flat prefix/suffix state machine in
// rope/src/Flat.edict. One call to `step` is one fold round, so the round
// count it reports is the count the authored fold's literal bound must cover.
// Construction reuses rope-build.mts (branches and rotations), so a result
// that differs from RopeBuilder.prefix/suffix is a defect in the machine.
import { height, NewBranch, NewLeaf, RopeBuilder } from '../../../tests/support/replace-range-schema-2/rope-build.mts';
import type { Rope } from '../../../tests/support/replace-range-schema-2/rope-build.mts';

/** The authored fold bound for one cut at input height h. */
export function flatCutBound(h: number): number {
  return 2 * h + 4 * (h + 1);
}

type Phase = 'descend' | 'pop' | 'join-down' | 'join-up' | 'done';
type Frame = { node: Rope; wentRight: boolean };
type Spine = { node: Rope; sibling: Rope };

class Machine {
  phase: Phase = 'descend';
  readonly path: Frame[] = [];
  remaining = 0;
  cur: Rope;
  offset: bigint;
  carry: Rope | null = null;
  // Join sub-state: the tall tree's inner spine, the short tree and which side is taller.
  spine: Spine[] = [];
  jremaining = 0;
  jcur: Rope | null = null;
  jshort: Rope | null = null;
  leftTaller = false;
  readonly builder: RopeBuilder;
  readonly keepLeft: boolean;
  constructor(builder: RopeBuilder, root: Rope, offset: bigint, keepLeft: boolean) {
    this.builder = builder;
    this.keepLeft = keepLeft;
    this.cur = root;
    this.offset = offset;
  }
  len(rope: Rope): bigint {
    return rope instanceof NewLeaf ? BigInt(rope.bytes.length) : rope.byteLength;
  }
  step(): void {
    if (this.phase === 'descend') this.descend();
    else if (this.phase === 'pop') this.pop();
    else if (this.phase === 'join-down') this.joinDown();
    else if (this.phase === 'join-up') this.joinUp();
  }
  finishDescent(carry: Rope | null): void {
    this.carry = carry;
    this.remaining = this.path.length;
    this.phase = 'pop';
  }
  descend(): void {
    const b = this.builder;
    const edge = this.keepLeft ? this.offset === 0n : this.offset === this.len(this.cur);
    const whole = this.keepLeft ? this.offset === this.len(this.cur) : this.offset === 0n;
    if (edge) return this.finishDescent(null);
    if (whole) return this.finishDescent(this.cur);
    if (b.isLeaf(this.cur)) {
      const bytes = b.leafBytes(this.cur);
      const at = Number(this.offset);
      return this.finishDescent(new NewLeaf(this.keepLeft ? bytes.subarray(0, at) : bytes.subarray(at)));
    }
    const [left, right] = b.children(this.cur);
    const goLeft = this.keepLeft ? this.offset <= this.len(left) : this.offset < this.len(left);
    this.path.push({ node: this.cur, wentRight: !goLeft });
    if (goLeft) this.cur = left;
    else [this.cur, this.offset] = [right, this.offset - this.len(left)];
  }
  // One frame per round: skip it, or join its sibling with the carry.
  pop(): void {
    if (this.remaining === 0) {
      this.phase = 'done';
      return;
    }
    const frame = this.path[this.remaining - 1]!;
    const joins = this.keepLeft ? frame.wentRight : !frame.wentRight;
    if (!joins) {
      this.remaining -= 1;
      return;
    }
    const [left, right] = this.builder.children(frame.node);
    const [l, r] = this.keepLeft ? [left, this.carry] : [this.carry, right];
    this.startJoin(l, r);
  }
  startJoin(l: Rope | null, r: Rope | null): void {
    if (l === null || r === null) return this.endJoin(l ?? r);
    const skew = height(l) - height(r);
    if (skew >= -1n && skew <= 1n) return this.endJoin(new NewBranch(l, r));
    this.leftTaller = skew > 1n;
    [this.jcur, this.jshort] = this.leftTaller ? [l, r] : [r, l];
    this.spine = [];
    this.phase = 'join-down';
  }
  endJoin(result: Rope | null): void {
    this.carry = result;
    this.remaining -= 1;
    this.phase = 'pop';
  }
  // joinRight/joinLeft descent: one spine level, or the base, per round.
  joinDown(): void {
    const b = this.builder;
    const [left, right] = b.children(this.jcur!);
    const [outer, inner] = this.leftTaller ? [left, right] : [right, left];
    if (height(inner) <= height(this.jshort!) + 1n) {
      const joined = this.leftTaller ? new NewBranch(inner, this.jshort!) : new NewBranch(this.jshort!, inner);
      const fits = height(joined) <= height(outer) + 1n;
      this.carry = this.leftTaller
        ? (fits ? new NewBranch(outer, joined) : b.rotateLeft(new NewBranch(outer, b.rotateRight(joined))))
        : (fits ? new NewBranch(joined, outer) : b.rotateRight(new NewBranch(b.rotateLeft(joined), outer)));
      this.jremaining = this.spine.length;
      this.phase = 'join-up';
      return;
    }
    this.spine.push({ node: this.jcur!, sibling: outer });
    this.jcur = inner;
  }
  // One spine level rebuilt per round; the last also finishes the frame.
  joinUp(): void {
    const b = this.builder;
    if (this.jremaining === 0) return this.endJoin(this.carry);
    const { sibling } = this.spine[this.jremaining - 1]!;
    const joined = this.carry!;
    const result = this.leftTaller ? new NewBranch(sibling, joined) : new NewBranch(joined, sibling);
    const fits = height(joined) <= height(sibling) + 1n;
    this.carry = fits ? result : (this.leftTaller ? b.rotateLeft(result) : b.rotateRight(result));
    this.jremaining -= 1;
  }
}

export type FlatCut = { rope: Rope | null; rounds: number; finished: boolean };

/** Runs the machine for at most `bound` rounds; an unfinished run reports `finished: false`. */
export function flatCut(builder: RopeBuilder, root: Rope, offset: bigint, keepLeft: boolean, bound: number): FlatCut {
  const machine = new Machine(builder, root, offset, keepLeft);
  let rounds = 0;
  while (machine.phase !== 'done' && rounds < bound) {
    machine.step();
    rounds += 1;
  }
  return { rope: machine.carry, rounds, finished: machine.phase === 'done' };
}
