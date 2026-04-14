---
title: "Verification Witness for Cycle 2"
---

# Verification Witness for Cycle 2

This witness proves that `anchor-transform-semantics` now carries the required
behavior and adheres to the repo invariants.

## Test Results

```text

> test
> node --test spec/**/*.spec.mjs tests/**/*.spec.mjs

✔ A left-biased point anchor stays before inserted text at its byte (3160.906667ms)
✔ A right-biased point anchor moves after inserted text at its byte (2872.463ms)
✔ A point anchor after a replacement shifts by the replacement byte delta (2699.159333ms)
✔ A point anchor inside a deleted span collapses to the replacement start (1847.179417ms)
✔ quality gate holds the current baseline without regression (988.007666ms)
✔ ReplaceRange inserts a fragment and satisfies the materialization law (2989.810125ms)
✔ ReplaceRange deletes a range when given the empty fragment (3062.696625ms)
✔ ReplaceRange returns the same root and no receipt for a logical no-op (2594.167084ms)
✔ Anchor transforms are defined in terms of logical ReplaceRange receipts rather than rope maintenance. (3.543333ms)
✔ This cycle pins down left-bias, right-bias, forward shift, and collapse semantics for point anchors. (0.308125ms)
✔ This cycle limits scope to point anchors over ReplaceRange receipts. (0.163542ms)
✔ This cycle makes accessibility, localization, and agent inspectability explicit. (0.12725ms)
✔ A left-biased point anchor stays before inserted text at its byte. (3263.788916ms)
✔ A right-biased point anchor moves after inserted text at its byte. (0.109417ms)
✔ A point anchor after a replacement shifts by the replacement byte delta. (0.108458ms)
✔ A point anchor inside a deleted span collapses to the replacement start. (0.081708ms)
✔ The runtime contract stays a minimal point-anchor seam rather than a full anchor system. (1.971959ms)
✔ The workspace satisfies build, quality, and the anchor transform contract suite. (3924.367416ms)
✔ ReplaceRange is named as the first kernel seam in this cycle. (1.124042ms)
✔ This cycle pins down insert/materialization, delete-by-empty-fragment, and logical no-op. (0.233042ms)
✔ This cycle limits scope to the minimal ReplaceRange seam. (0.142625ms)
✔ This cycle makes accessibility, localization, and agent inspectability explicit. (0.141542ms)
✔ ReplaceRange insertion satisfies the materialization law. (3032.772917ms)
✔ ReplaceRange deletion is replacement by the empty fragment. (0.321666ms)
✔ ReplaceRange returns the same root and no receipt for a logical no-op. (0.217084ms)
✔ The runtime contract stays a minimal ReplaceRange seam rather than a full rope engine. (1.092875ms)
✔ The workspace satisfies build, quality, and the ReplaceRange contract suite. (3915.977083ms)
ℹ tests 27
ℹ suites 0
ℹ pass 27
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 10747.689792

```

## Drift Results

```text
No playback-question drift found.
Scanned 1 active cycle, 10 playback questions, 19 test descriptions.
Search basis: exact normalized match in tests/**/*.test.* and tests/**/*.spec.* descriptions.

```

## Manual Verification

- [x] Automated capture completed successfully.
