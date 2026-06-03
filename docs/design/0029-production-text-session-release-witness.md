# Production Text Session Release Witness

Status: active checkpoint for
[`0027-echo-hosted-production-cutover.md`](0027-echo-hosted-production-cutover.md)
slices 71-80.

This slice batch upgrades the Echo-hosted production text path from a narrow
controller to an agent/release witness:

```text
TextRuntimeProfile echoHosted
-> TextBufferSessionPort
-> ProductionTextSession
-> open/edit/checkpoint/read/export
-> retained evidence refs
-> local replay comparison
```

## What This Proves

- Filesystem save/export is a jedit-owned materialization concern, not Echo
  state mutation.
- Manual checkpoint posture goes through the jedit contract operation path.
- Agent tooling can run the production text session without lifecycle or tick
  authority.
- The witness reports receipt, checkpoint, reading, and export refs.
- Local replay compares deterministic semantic identity while explicitly
  declining durable replay claims.
- The release gate runs the production text witness and the production cutover
  static guard.

## What This Does Not Yet Prove

This checkpoint still does not claim the full interactive TUI event loop has no
legacy direct `EditorState.lines` path. Those paths are inventoried in
[`0028-production-text-authority-inventory.md`](0028-production-text-authority-inventory.md)
and remain the next cutover pressure:

- file-tree open;
- viewer key edit routing;
- source rendering;
- filesystem save/export key handling.

The distinction is deliberate. The production session path is now executable
and guarded; the next work is to make the interactive workspace consume it as
the only product authority path.

## Release Commands

```bash
npm run build
node scripts/jedit-production-text-session.mjs --json --text "hello Echo"
node scripts/jedit-production-text-session.mjs --json --replay-local
node scripts/jedit-production-cutover-guard.mjs
npm run release-gate:jedit-echo
```

## Non-Negotiables

- Echo still does not know text buffers, files, panes, cursors, selections, or
  exports.
- `TextBufferOptic` remains a jedit capability.
- The production TUI has no non-Echo text runtime profile; focused tests use
  direct fake-port injection when they need fixture behavior.
- Export is a reading/materialization over a jedit-owned basis.
- Hidden retry remains absent.
- Durable WSC replay remains post-slice-80.
