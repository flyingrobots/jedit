# Echo History Drawer

## Status

Implemented as a first interactive drawer slice. Worldline jump is intentionally
designed but not implemented until jedit has a port that can ask Echo for a
bounded historical basis and reproject the editor from that basis.

## User Experience Claim

`ctrl+h` opens a right-side Echo History drawer. The drawer is for a person
editing in jedit, not for raw Echo runtime debugging. It lists the Echo activity
that jedit can explain in workspace terms:

- file opens that returned a bounded reading;
- edit submissions that returned receipts;
- bounded reads that refreshed the editor cache;
- exports and checkpoints from save;
- obstructions from the same flows.

Rows are sorted by tick id when evidence carries one, otherwise by local
admission sequence. The selected row is visible with the same marker language as
other jedit drawers, and `j`/`k` plus page keys move selection while the drawer
owns focus.

## Controls

- `ctrl+h`: open or close Echo History.
- `esc`: close Echo History when it owns focus.
- `tab`: cycle through visible workspace panes.
- `j`/`k`, arrows, page up, page down: move the selected history row.

`ctrl+h` is a workspace command. If a Vim-like normal-mode command is pending,
opening History moves focus out of the editor and clears the pending motion.
That avoids leaving an armed edit command behind while the user is inspecting
evidence.

## Evidence Model

The drawer stores `EchoHistoryEntry` values in `WorkspaceModel`. Each entry has:

- `sequence`: local admission order;
- `tickId`: parsed from `tick:*` or receipt-shaped evidence when available;
- `kind`: open, edit, read, export, or checkpoint;
- `status`: opened, applied, observed, exported, checkpointed, or obstructed;
- `evidenceId`: receipt, reading, checkpoint, or other citable id;
- `summary`: path or obstruction message.

This is deliberately a jedit optic over Echo evidence, not a complete Echo
activity log. A future lower-level Echo activity inspector can exist, but this
drawer should remain the editor-facing receipt trail.

## Bijou Breakpoints

The drawer participates in the same surface composition path as Files and
Graft. Files stay left aligned. Graft and History stack on the right, with
History at the outer edge and Graft immediately to its left.

When all drawers are open, layout preserves a minimum editor region instead of
allowing drawers to consume the whole terminal. At narrow supported widths,
drawer widths scale down together. Below the workspace minimum terminal size,
jedit continues to show the existing small-terminal notice.

## Worldline Jump Design

The intended next experience is:

1. Select a history row.
2. Press Enter.
3. jedit asks a port for a bounded historical reading at that evidence basis.
4. The editor reprojects that reading without mutating current Echo history.
5. The footer clearly marks that the editor is viewing a historical basis.

That needs a real basis-navigation port and footer/view posture before it should
ship. A no-op Enter binding would make the drawer feel more complete than it is,
so the first slice exposes selection only.

## Verification

The implementation is covered by focused specs for:

- `ctrl+h` opening History and clearing pending normal-mode motion;
- history rows populated from production text-session open/edit/export/checkpoint
  results;
- drawer rendering of evidence ids and summaries;
- focus cycling and active-edge painting for History;
- layout behavior with Files, Graft, and History at narrow Bijou breakpoints;
- footer mode, hints, and context for the History drawer.
