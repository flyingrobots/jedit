---
title: "Playback Witness"
---

Date: 2026-04-13

This cycle delivered the first point-anchor transform seam over logical
`ReplaceRange` receipts.

## Human Playback

Status: Verified by the human operator on 2026-04-13.

### How to execute this playback

Quick local verification from the repo root:

```sh
npm run build
node --test spec/anchor-transform.contract.spec.mjs tests/anchor-transform-cycle.spec.mjs
npm run quality
```

Sandbox verification in an isolated copy when you do not want to use the live
working tree:

```sh
export EDDIT_SANDBOX="$(mktemp -d /tmp/eddit-anchor-transform-playback.XXXXXX)"
rsync -a --delete --exclude node_modules --exclude dist ./ "$EDDIT_SANDBOX"/
cd "$EDDIT_SANDBOX"
npm ci
npm run build
node --test spec/anchor-transform.contract.spec.mjs tests/anchor-transform-cycle.spec.mjs
npm run quality
```

Expected outcome:

- build exits `0`
- the focused anchor-transform contract tests pass
- the quality gate exits `0`
- the design and runtime files below match the stated human claims

### Anchor transforms are defined in terms of logical ReplaceRange receipts rather than rope maintenance.

Yes.

Suggested inspection:

- [anchor-transform-semantics.md](../../../design/0002-anchor-transform-semantics/anchor-transform-semantics.md)
- [anchor-transform-contract.ts](../../../../src/domain/anchor-transform-contract.ts)
- [verification.md](./verification.md)

Suggested commands:

```sh
sed -n '1,90p' docs/design/0002-anchor-transform-semantics/anchor-transform-semantics.md
sed -n '1,220p' src/domain/anchor-transform-contract.ts
```

What to confirm:

- the design defines semantics in terms of logical `ReplaceRange` receipts
- the runtime seam contains no rope-maintenance behavior

### This cycle pins down left-bias, right-bias, forward shift, and collapse semantics for point anchors.

Yes.

Suggested inspection:

- [anchor-transform-semantics.md](../../../design/0002-anchor-transform-semantics/anchor-transform-semantics.md)
- [anchor-transform.contract.spec.mjs](../../../../spec/anchor-transform.contract.spec.mjs)
- [verification.md](./verification.md)

Suggested commands:

```sh
sed -n '20,70p' docs/design/0002-anchor-transform-semantics/anchor-transform-semantics.md
sed -n '1,220p' spec/anchor-transform.contract.spec.mjs
```

What to confirm:

- the design names left-bias, right-bias, forward shift, and collapse
- the executable spec asserts those same four behaviors

### This cycle limits scope to point anchors over ReplaceRange receipts.

Yes.

Suggested inspection:

- [anchor-transform-semantics.md](../../../design/0002-anchor-transform-semantics/anchor-transform-semantics.md)
- [anchor-transform-contract.ts](../../../../src/domain/anchor-transform-contract.ts)
- [verification.md](./verification.md)

Suggested commands:

```sh
sed -n '30,100p' docs/design/0002-anchor-transform-semantics/anchor-transform-semantics.md
sed -n '1,220p' src/domain/anchor-transform-contract.ts
```

What to confirm:

- the non-goals exclude interval anchors, persistence, rope maintenance, and UI
- the runtime seam stays point-anchor only

### This cycle makes accessibility, localization, and agent inspectability explicit.

Yes.

Suggested inspection:

- [anchor-transform-semantics.md](../../../design/0002-anchor-transform-semantics/anchor-transform-semantics.md)

Suggested commands:

```sh
sed -n '55,100p' docs/design/0002-anchor-transform-semantics/anchor-transform-semantics.md
```

What to confirm:

- accessibility and assistive reading are named explicitly
- localization and directionality are named explicitly
- agent inspectability and explainability are named explicitly

## Agent Playback

### A left-biased point anchor stays before inserted text at its byte.

Yes.

Evidence:

- [anchor-transform.contract.spec.mjs](../../../../spec/anchor-transform.contract.spec.mjs) asserts the left-bias insertion behavior directly.
- [anchor-transform-contract.ts](../../../../src/domain/anchor-transform-contract.ts) keeps the anchor at the insertion byte when the bias is left.
- [verification.md](./verification.md) captures the passing contract suite.

### A right-biased point anchor moves after inserted text at its byte.

Yes.

Evidence:

- [anchor-transform.contract.spec.mjs](../../../../spec/anchor-transform.contract.spec.mjs) asserts the right-bias insertion behavior directly.
- [anchor-transform-contract.ts](../../../../src/domain/anchor-transform-contract.ts) advances the anchor by the inserted byte length when the bias is right.
- [verification.md](./verification.md) captures the passing contract suite.

### A point anchor after a replacement shifts by the replacement byte delta.

Yes.

Evidence:

- [anchor-transform.contract.spec.mjs](../../../../spec/anchor-transform.contract.spec.mjs) asserts the forward-shift case directly.
- [anchor-transform-contract.ts](../../../../src/domain/anchor-transform-contract.ts) applies the replacement byte delta to anchors after the replaced range.
- [verification.md](./verification.md) captures the passing contract suite.

### A point anchor inside a deleted span collapses to the replacement start.

Yes.

Evidence:

- [anchor-transform.contract.spec.mjs](../../../../spec/anchor-transform.contract.spec.mjs) asserts the deletion-collapse case directly.
- [anchor-transform-contract.ts](../../../../src/domain/anchor-transform-contract.ts) collapses anchors inside the replaced span to the replacement start.
- [verification.md](./verification.md) captures the passing contract suite.

### The runtime contract stays a minimal point-anchor seam rather than a full anchor system.

Yes.

Evidence:

- [tests/anchor-transform-cycle.spec.mjs](../../../../tests/anchor-transform-cycle.spec.mjs) checks the constrained export surface.
- [anchor-transform-contract.ts](../../../../src/domain/anchor-transform-contract.ts) exposes only the point-anchor and logical-receipt seam.
- [anchor-transform-semantics.md](../../../design/0002-anchor-transform-semantics/anchor-transform-semantics.md) keeps interval anchors, persistence, rope maintenance, and UI integration out of scope.

### The workspace satisfies build, quality, and the anchor transform contract suite.

Yes.

Evidence:

- [verification.md](./verification.md) captures passing `npm test` output and clean drift output.
- [tests/anchor-transform-cycle.spec.mjs](../../../../tests/anchor-transform-cycle.spec.mjs) asserts the workspace-level verification surface.

## Outcome

Agent and human playback are both evidenced and complete.
