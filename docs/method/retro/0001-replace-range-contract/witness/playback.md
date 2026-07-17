---
title: "Playback Witness"
---

Date: 2026-04-13

This cycle delivered the first executable `ReplaceRange` seam for the future
text kernel.

> **Retired:** This playback records a historical full-string implementation,
> not the current architecture. The referenced source and tests were deleted
> when Jim stopped simulating text authority and Echo admission in TypeScript.
> The commands below are preserved as historical evidence and do not run at
> the current tree.

## Human Playback

Status: Verified by the human operator on 2026-04-13.

### How to execute this playback

Quick local verification from the repo root:

```sh
npm run build
node --test spec/replace-range.contract.spec.mjs tests/replace-range-cycle.spec.mjs
npm run quality
```

Sandbox verification in an isolated copy when you do not want to use the live
working tree:

```sh
export JEDIT_SANDBOX="$(mktemp -d /tmp/jedit-replace-range-playback.XXXXXX)"
rsync -a --delete --exclude node_modules --exclude dist ./ "$JEDIT_SANDBOX"/
cd "$JEDIT_SANDBOX"
npm ci
npm run build
node --test spec/replace-range.contract.spec.mjs tests/replace-range-cycle.spec.mjs
npm run quality
```

Expected outcome:

- build exits `0`
- the focused ReplaceRange contract tests pass
- the quality gate exits `0`
- the design and runtime files below match the stated human claims

### ReplaceRange is named as the first kernel seam in this cycle.

Yes.

Suggested inspection:

- [replace-range-contract.md](../../../design/0001-replace-range-contract/replace-range-contract.md)
- [text-edit-algebra.md](../../../../design/text-edit-algebra.md)
- [verification.md](./verification.md)

Suggested commands:

```sh
sed -n '1,80p' docs/design/0001-replace-range-contract/replace-range-contract.md
sed -n '1,120p' docs/design/text-edit-algebra.md
```

What to confirm:

- the hill names `ReplaceRange` as the first explicit seam
- the design treats it as current repo truth, not a future placeholder

### This cycle pins down insert/materialization, delete-by-empty-fragment, and logical no-op.

Yes.

Suggested inspection:

- [replace-range-contract.md](../../../design/0001-replace-range-contract/replace-range-contract.md)
- [historical replace-range.contract.spec.mjs](https://github.com/flyingrobots/jedit/blob/e93b2e1a138a762d7a33da6179d3ad8b8b2a9c6e/spec/replace-range.contract.spec.mjs)
- [verification.md](./verification.md)

Suggested commands:

```sh
sed -n '20,70p' docs/design/0001-replace-range-contract/replace-range-contract.md
sed -n '1,220p' spec/replace-range.contract.spec.mjs
```

What to confirm:

- the design names insert/materialization, delete-by-empty-fragment, and no-op
- the executable spec asserts those same three behaviors

### This cycle limits scope to the minimal ReplaceRange seam.

Yes.

Suggested inspection:

- [replace-range-contract.md](../../../design/0001-replace-range-contract/replace-range-contract.md)
- [historical text-edit-contract.ts](https://github.com/flyingrobots/jedit/blob/e93b2e1a138a762d7a33da6179d3ad8b8b2a9c6e/src/domain/text-edit-contract.ts)
- [verification.md](./verification.md)

Suggested commands:

```sh
sed -n '35,95p' docs/design/0001-replace-range-contract/replace-range-contract.md
sed -n '1,220p' src/domain/text-edit-contract.ts
```

What to confirm:

- the non-goals exclude anchors, strands, admission, and rope persistence
- the runtime file exposes only the minimal seam needed for this slice

### This cycle makes accessibility, localization, and agent inspectability explicit.

Yes.

Suggested inspection:

- [replace-range-contract.md](../../../design/0001-replace-range-contract/replace-range-contract.md)

Suggested commands:

```sh
sed -n '55,95p' docs/design/0001-replace-range-contract/replace-range-contract.md
```

What to confirm:

- accessibility and assistive reading are named explicitly
- localization and directionality are named explicitly
- agent inspectability and explainability are named explicitly

## Agent Playback

### ReplaceRange insertion satisfies the materialization law.

Yes.

Evidence:

- [historical replace-range.contract.spec.mjs](https://github.com/flyingrobots/jedit/blob/e93b2e1a138a762d7a33da6179d3ad8b8b2a9c6e/spec/replace-range.contract.spec.mjs) asserted the insertion case directly.
- [historical text-edit-contract.ts](https://github.com/flyingrobots/jedit/blob/e93b2e1a138a762d7a33da6179d3ad8b8b2a9c6e/src/domain/text-edit-contract.ts) implemented replacement by byte-range splice and materialization.
- [verification.md](./verification.md) captures the passing contract suite.

### ReplaceRange deletion is replacement by the empty fragment.

Yes.

Evidence:

- [historical replace-range.contract.spec.mjs](https://github.com/flyingrobots/jedit/blob/e93b2e1a138a762d7a33da6179d3ad8b8b2a9c6e/spec/replace-range.contract.spec.mjs) asserted deletion via `emptyFragment()`.
- [historical text-edit-contract.ts](https://github.com/flyingrobots/jedit/blob/e93b2e1a138a762d7a33da6179d3ad8b8b2a9c6e/src/domain/text-edit-contract.ts) applied the same replacement primitive to deletion.
- [verification.md](./verification.md) captures the passing contract suite.

### ReplaceRange returns the same root and no receipt for a logical no-op.

Yes.

Evidence:

- [historical replace-range.contract.spec.mjs](https://github.com/flyingrobots/jedit/blob/e93b2e1a138a762d7a33da6179d3ad8b8b2a9c6e/spec/replace-range.contract.spec.mjs) asserted the no-op case directly.
- [historical text-edit-contract.ts](https://github.com/flyingrobots/jedit/blob/e93b2e1a138a762d7a33da6179d3ad8b8b2a9c6e/src/domain/text-edit-contract.ts) compared replaced bytes against inserted bytes and returned the original root with no receipt when they matched.
- [verification.md](./verification.md) captures the passing contract suite.

### The runtime contract stays a minimal ReplaceRange seam rather than a full rope engine.

Yes.

Evidence:

- [historical replace-range-cycle.spec.mjs](https://github.com/flyingrobots/jedit/blob/e93b2e1a138a762d7a33da6179d3ad8b8b2a9c6e/tests/replace-range-cycle.spec.mjs) checked the constrained export surface.
- [historical text-edit-contract.ts](https://github.com/flyingrobots/jedit/blob/e93b2e1a138a762d7a33da6179d3ad8b8b2a9c6e/src/domain/text-edit-contract.ts) exposed only the minimal root, range, fragment, and receipt seam.
- [replace-range-contract.md](../../../design/0001-replace-range-contract/replace-range-contract.md) keeps rope storage, anchors, strands, and admission out of scope.

### The workspace satisfies build, quality, and the ReplaceRange contract suite.

Yes.

Evidence:

- [verification.md](./verification.md) captures passing `npm test` output and clean drift output.
- [historical replace-range-cycle.spec.mjs](https://github.com/flyingrobots/jedit/blob/e93b2e1a138a762d7a33da6179d3ad8b8b2a9c6e/tests/replace-range-cycle.spec.mjs) asserted the workspace-level verification surface.

## Outcome

Agent and human playback are both evidenced and complete.
