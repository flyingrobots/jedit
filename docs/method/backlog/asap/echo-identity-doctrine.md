---
title: echo-identity-doctrine
lane: asap
owner: jedit architecture
priority: high
keywords:
  - identity
  - echo
  - content-addressing
  - worldline
  - binding
  - basis
acceptance_criteria:
  - `docs/design/echo-identity-doctrine.md` exists and is treated as canonical for identity semantics in this repo.
  - The doctrine is linked from `ARCHITECTURE.md`, `BEARING.md`, and `docs/echo-application-hosting-guide.md`.
  - "Same-content, different-path" preserves `ContentRef` while not forcing semantic sameness of local context.
  - Two empty files can share genesis bytes but have distinct `WorldlineId`.
  - Rename preserves `WorldlineId` while re-associating local binding/path.
  - Copy creates a new `WorldlineId`, reuses current content snapshot, and records `derived_from` history.
  - Import behavior supports at least `inspect`, `fork`, and `adopt` and policy survives reopen.
  - Local anchor resolution is scoped as `(NamespaceId, AnchorId) -> LocalPath` (or `(ImportInstanceId, AnchorId) -> LocalPath`), never `AnchorId -> LocalPath`.
  - WSC exports capture provenance claims and local binding hints without requiring ambient fields inside canonical hashes.
  - WSC provenance scope is explicit (complete package or horizon-bounded with listed external tails).
---

# echo-identity-doctrine

This is the execution lock for the doctrine discussed in the design freeze.

## What to implement

- Add a canonical identity policy document in `docs/design/echo-identity-doctrine.md`.
- Ensure planning and architecture docs point to that policy so the team cannot miss
  it in day-to-day work.
- Enforce implementation policy:
  - values are `ContentRef`/`RecordRef` hashed from canonical bytes,
  - logical things get declared IDs,
  - names are binding slots,
  - views are Basis slices,
  - import of history is explicit about `inspect`/`fork`/`adopt`.
- Model rename and copy as distinct operations:
  - Rename keeps the same `WorldlineId` and updates binding/path slot.
  - Copy creates a fresh `WorldlineId`, reuses current content state, and records
    `derived_from` lineage to the source worldline tick.
- Model anchor-locality with an explicit scope key:
  - `LocalAnchorBinding = (NamespaceId | ImportInstanceId, AnchorId) -> LocalPath`.
- Make export provenance explicit:
  - complete exports and horizon-bounded exports are both valid; horizon-bounded
    exports must enumerate provenance gaps and prevent replay-accuracy false claims.

## Acceptance matrix

- [ ] Same-content/different-path test: path is not treated as semantic truth.
- [ ] Two empty files share genesis hash but not worldline identity.
- [ ] Rename preserves `WorldlineId` across local slot/path reassociation.
- [ ] Copy creates a new `WorldlineId` and emits `derived_from` links.
- [ ] Local anchor resolution keys include namespace/import context.
- [ ] WSC roundtrip test confirms portable slices do not accidentally inherit local
  machine or install fields.
- [ ] Re-open + imported-worldline tests verify import policy persistence.
- [ ] WSC provenance horizon handling (complete vs bounded) is explicit and machine-checkable.

## Why this card exists

If this is not locked in now, future work re-invites:
- conflating `RecordRef` and document identity,
- treating `path` as semantic truth,
- and shipping ambient coordinates into canonical payloads.
