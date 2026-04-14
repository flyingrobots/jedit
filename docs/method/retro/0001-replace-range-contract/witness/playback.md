---
title: "Playback Witness"
---

Date: 2026-04-13

This cycle delivered the first executable `ReplaceRange` seam for the future
text kernel.

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
- [TEXT_EDIT_ALGEBRA.md](../../../../TEXT_EDIT_ALGEBRA.md)
- [verification.md](./verification.md)

Suggested commands:

```sh
sed -n '1,80p' docs/design/0001-replace-range-contract/replace-range-contract.md
sed -n '1,120p' TEXT_EDIT_ALGEBRA.md
```

What to confirm:

- the hill names `ReplaceRange` as the first explicit seam
- the design treats it as current repo truth, not a future placeholder

### This cycle pins down insert/materialization, delete-by-empty-fragment, and logical no-op.

Yes.

Suggested inspection:

- [replace-range-contract.md](../../../design/0001-replace-range-contract/replace-range-contract.md)
- [replace-range.contract.spec.mjs](../../../../spec/replace-range.contract.spec.mjs)
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
- [text-edit-contract.ts](../../../../src/domain/text-edit-contract.ts)
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

- [replace-range.contract.spec.mjs](../../../../spec/replace-range.contract.spec.mjs) asserts the insertion case directly.
- [text-edit-contract.ts](../../../../src/domain/text-edit-contract.ts) implements replacement by byte-range splice and materialization.
- [verification.md](./verification.md) captures the passing contract suite.

### ReplaceRange deletion is replacement by the empty fragment.

Yes.

Evidence:

- [replace-range.contract.spec.mjs](../../../../spec/replace-range.contract.spec.mjs) asserts deletion via `emptyFragment()`.
- [text-edit-contract.ts](../../../../src/domain/text-edit-contract.ts) applies the same replacement primitive to deletion.
- [verification.md](./verification.md) captures the passing contract suite.

### ReplaceRange returns the same root and no receipt for a logical no-op.

Yes.

Evidence:

- [replace-range.contract.spec.mjs](../../../../spec/replace-range.contract.spec.mjs) asserts the no-op case directly.
- [text-edit-contract.ts](../../../../src/domain/text-edit-contract.ts) compares replaced bytes against inserted bytes and returns the original root with no receipt when they match.
- [verification.md](./verification.md) captures the passing contract suite.

### The runtime contract stays a minimal ReplaceRange seam rather than a full rope engine.

Yes.

Evidence:

- [tests/replace-range-cycle.spec.mjs](../../../../tests/replace-range-cycle.spec.mjs) checks the constrained export surface.
- [text-edit-contract.ts](../../../../src/domain/text-edit-contract.ts) exposes only the minimal root, range, fragment, and receipt seam.
- [replace-range-contract.md](../../../design/0001-replace-range-contract/replace-range-contract.md) keeps rope storage, anchors, strands, and admission out of scope.

### The workspace satisfies build, quality, and the ReplaceRange contract suite.

Yes.

Evidence:

- [verification.md](./verification.md) captures passing `npm test` output and clean drift output.
- [tests/replace-range-cycle.spec.mjs](../../../../tests/replace-range-cycle.spec.mjs) asserts the workspace-level verification surface.

## Outcome

Agent and human playback are both evidenced and complete.
