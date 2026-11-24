// SPDX-License-Identifier: Apache-2.0 OR LicenseRef-MIND-UCAL-1.0
// © James Ross Ω FLYING•ROBOTS <https://github.com/flyingrobots>
// The shape of one hand-written row and terse constructors for basis specs.
import { BranchSpec, BufferSpec, HeadSpec, LeafSpec, NodeOverrides, utf8 } from './fixture-basis.mts';
import type { Bytes, TreeSpec } from './fixture-basis.mts';
import type { Check, Outcome } from './outcomes.mts';
import type { EdgeKind } from './schema-2-facts.mts';

export type Mapping = 'carry' | 'counterpart' | 'addition';

export type BasisRef = 'canonical' | { readonly other: number } | { readonly canonicalOf: string } | Bytes;

export class InvocationSpec {
  readonly buffer: string | Bytes;
  readonly basis: BasisRef;
  readonly start: bigint;
  readonly end: bigint;
  readonly replacement: Bytes;
  constructor(range: readonly [bigint, bigint], replacement: Bytes, options: { buffer?: string | Bytes;
    basis?: BasisRef } = {}) {
    [this.start, this.end] = range;
    this.replacement = replacement;
    this.buffer = options.buffer ?? '';
    this.basis = options.basis ?? 'canonical';
  }
}

/**
 * A committed row's specified result, all written by hand: the texts, the post-state leaf sizes in text
 * order, and basis leaves that must survive by identity.
 */
export class ExpectCommitted {
  readonly textBefore: Bytes;
  readonly textAfter: Bytes;
  readonly leafSizes: readonly number[];
  readonly mustShare: readonly Bytes[];
  constructor(texts: readonly [Bytes, Bytes], leafSizes: readonly number[], mustShare: readonly Bytes[] = []) {
    [this.textBefore, this.textAfter] = texts;
    this.leafSizes = leafSizes;
    this.mustShare = mustShare;
  }
}

/** An obstructed row's specified result, and later checks the fixture would also fail. */
export class ExpectObstructed {
  readonly outcome: Outcome;
  readonly check: Check;
  readonly competing: readonly Check[];
  constructor(outcome: Outcome, check: Check, competing: readonly Check[] = []) {
    this.outcome = outcome;
    this.check = check;
    this.competing = competing;
  }
}

/** An obligation that leaves the operation for another surface; it stays a gap until discharged there. */
export class MovedObligation {
  readonly surface: string;
  readonly obligation: string;
  readonly owner: string;
  constructor(surface: string, obligation: string, owner: string) {
    this.surface = surface;
    this.obligation = obligation;
    this.owner = owner;
  }
}

export class RowSpec {
  readonly id: string;
  readonly mapping: Mapping;
  readonly obligation: string;
  readonly retainedSemanticCode: string | null;
  readonly decision: string | null;
  readonly buffers: readonly BufferSpec[];
  readonly invocation: InvocationSpec;
  readonly expected: ExpectCommitted | ExpectObstructed;
  readonly moved: readonly MovedObligation[];
  constructor(header: { id: string; mapping: Mapping; obligation: string; semanticCode?: string; decision?: string;
    moved?: readonly MovedObligation[] }, buffers: readonly BufferSpec[], invocation: InvocationSpec,
  expected: ExpectCommitted | ExpectObstructed) {
    this.id = header.id;
    this.mapping = header.mapping;
    this.obligation = header.obligation;
    this.retainedSemanticCode = header.semanticCode ?? null;
    this.decision = header.decision ?? null;
    this.moved = header.moved ?? [];
    this.buffers = buffers;
    this.invocation = invocation.buffer === '' ? new InvocationSpec([invocation.start, invocation.end],
      invocation.replacement, { buffer: buffers[0]!.key, basis: invocation.basis }) : invocation;
    this.expected = expected;
  }
}

type Overrides = ConstructorParameters<typeof NodeOverrides>[0];

export function leaf(content: string | Bytes, overrides: Overrides = {}): LeafSpec {
  return new LeafSpec(typeof content === 'string' ? utf8(content) : content, new NodeOverrides(overrides));
}

export function branch(left: TreeSpec, right: TreeSpec | 'self', overrides: Overrides = {}): BranchSpec {
  return new BranchSpec(left, right, new NodeOverrides(overrides));
}

export function head(tree: TreeSpec | null, overrides: Overrides = {}): HeadSpec {
  return new HeadSpec(tree, new NodeOverrides(overrides));
}

export function claims(entries: Record<string, bigint>): ReadonlyMap<string, bigint> {
  return new Map(Object.entries(entries));
}

export function buffer(key: string, canonical: HeadSpec,
  options: ConstructorParameters<typeof BufferSpec>[2] = {}): BufferSpec {
  return new BufferSpec(key, canonical, options);
}

export function invoke(start: bigint, end: bigint, replacement: string | Bytes,
  options: { buffer?: string | Bytes; basis?: BasisRef } = {}): InvocationSpec {
  return new InvocationSpec([start, end], typeof replacement === 'string' ? utf8(replacement) : replacement, options);
}

export type EdgeOverride = readonly (readonly [EdgeKind, TreeSpec | 'self'])[];
