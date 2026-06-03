# Echo Identity Doctrine

Date: 2026-05-31

This is the canonical short doctrine for how identity, scope, and transport
interact in the Echo text-history model. It is intentionally boring.

## Core rule

Identity is always decomposed before hashing.

- **Values** are immutable. They are content-addressed (`ContentRef` / `RecordRef`).
- **Things** are logical entities. They are declared (`WorldlineId`,
  `SessionId`, `AnchorId`, `NamespaceId`, `BindingId`, `PrincipalRef`).
- **Names** are bindings. They are local resolution context.
- **Views** are Basis. They are query shapes over records, not storage units.

`RecordRef` proves bytes. `WorldlineId` proves identity of a logical document.
They are not the same thing.

## Invariants

1. **Two different files can share bytes without sharing a worldline**
   - Two empty docs can have identical initial rope content and still get distinct
     `WorldlineId`.
   - `worldlineCreated` records are separate because the declared `worldlineId`
     differs.

2. **No ambient data in hashed bytes**
   - `paths`, `SystemTime`, host name, uid/gid, `$USER`, `$PWD`, install path,
     and machine IDs must not alter hashed payloads.
   - If a field is meaningful only to local observation (display path, edit host,
     local annotations), it belongs in binding/annotation layers outside payload
     hash scope.

3. **Rename and copy are different identity operations**
   - Rename keeps `WorldlineId` unchanged and moves the same worldline to a new
     local binding/path slot.
   - Copy mints a new `WorldlineId` and reuses the source content snapshot as
     initial state, while recording provenance:
     `derived_from: <sourceWorldlineId>@<tickRef>`.

4. **Canonical portability over portability hacks**
   - Portable intent/history transport is by byte hashes for immutable records + declared IDs for named entities.
   - `Import`/`Inspect` behavior does not rewrite canonical payloads.

5. **Basis is a view, never storage**
   - Basis decides what slice is observed:
     one file, one session, a time interval, a principal slice, etc.
   - Basis does not choose where bytes are stored.

## Required typed shape

- `RecordRef = blake3(canonical_record_bytes)`
- `WorldlineId` etc. = random 256 (or public-key derived for principals)
- `BindingRef` = stable logical slot reference
- `Binding` = local resolution of `BindingRef` (never globally hashed as truth)
- `LocalAnchorBinding = (NamespaceId | ImportInstanceId, AnchorId) -> LocalPath`
- `BasisRef = blake3(canonical_basis_spec)`
- `WSC` = selected `Basis + closure + records + local binding hints`

## Import policy (must be explicit)

WSC transport must encode intent, not assume silent continuation:

- `inspect` (default): read-only observation until write.
- `fork`  : first write forks a derived logical worldline.
- `adopt` : first write continues the imported logical worldline.

The policy belongs with the import binding so defaults persist on reopen.

## WSC provenance completeness

WSC exports are always explicit:

- Complete export: all referenced parents and bindings are included.
- Horizon-bounded export: includes a declared provenance boundary and the list of
  required-but-omitted references that would be needed for full replay.

No export may claim full replay if it leaves dangling references.

## Non-negotiables

1. Values are hashed for dedup and replay.
2. Things keep declared identity even when bytes move.
3. Names are rebased per machine/workspace policy.
4. App-facing boundaries must never expose runtime coordinates as source-of-truth.
5. Local anchor resolution is scoped:
   `(NamespaceId, AnchorId) -> LocalPath` or `(ImportInstanceId, AnchorId) -> LocalPath`.
6. Rename and copy remain distinct even when snapshots are byte-identical.

## Acceptance checkpoints for this doctrine

- [ ] Same-content, different-path records keep `ContentRef` identical but preserve
  declared worldline distinction.
- [ ] Two empty buffers can coexist with shared genesis content but distinct
  `WorldlineId`.
- [ ] Rename preserves logical identity (`WorldlineId`) and changes only binding/path.
- [ ] Copy mints a new `WorldlineId`, reuses current content snapshot, and
  records `derived_from` to source lineage.
- [ ] Imported WSC can be opened, forked, or adopted without changing transport
  payload bytes.
- [ ] Local anchor resolution is scoped by namespace/import instance, never `AnchorId -> LocalPath`.
- [ ] WSC provenance completeness vs horizon-bounded partials are explicitly declared.
- [ ] Replay remains deterministic under the same canonical bytes + declared IDs.

## Reference

Canonical source for implementation and policy follow-on:
[ARCHITECTURE.md](../ARCHITECTURE.md),
[docs/method/backlog/asap/echo-identity-doctrine.md](../method/backlog/asap/echo-identity-doctrine.md),
[docs/echo-application-hosting-guide.md](../echo-application-hosting-guide.md).
