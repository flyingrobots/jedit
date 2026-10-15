# Selectable footer terminal witnesses

The question is whether three real arrangements can show focused-surface facts
and workspace counts while respecting modal input ownership and available rows.

The implementation was exercised through Bijou's native terminal loop with the
production Echo host at 100×32 and 60×16. Each run used an isolated temporary
workspace, WAL directory and injected `.jimrc` preferences file. Captures below
render the live application's terminal cells with Menlo. Terminal-specific font
rendering may differ. [The receipt](receipt.json) retains input events, model
observations, capture sizes and cell digests for implementation `fcb12be2`.

The flow was F2, four Down keys to Footer layout, Left/Right to choose, Escape
to close Settings, Ctrl+B, Ctrl+G, Tab, `/alpha`, Escape. All layouts retained
the filtered selection and read-only file preview. Restarting the native app
at the narrow size restored the Focused choice saved by the wide run. Native
mouse motion and a left click selected the filtered entry without entering
filter mode. Enter opened it through Echo; `iX`, Escape and `:edit ` showed a
modified buffer and completion popup above Compact's final-row input.

| Layout | 100×32 | 60×16 |
| --- | --- | --- |
| Focused + workspace | [Capture](focused-100x32.png) | [Capture](focused-60x16.png) |
| Per-pane + workspace | [Capture](per-pane-100x32.png) | [Capture](per-pane-60x16.png) |
| Compact | [Capture](compact-100x32.png) | [Capture](compact-60x16.png) |

[Compact command entry](compact-command-60x16.png) retains `1 modified` while
completion remains above `:edit`. [Mirror locale](compact-mirror-60x16.png)
exercises translated mode/status text while retaining literal file paths.
Compact's narrow capture shows an opened modified editor; the other layout
captures show the Files selection and preview before opening it.

Success required two rows for Focused/Per-pane, one for Compact, actual pane
boundaries in Per-pane, explicit Files NAV/FILTER ownership, retained global
counts, matching pointer/viewport geometry and a remembered choice after restart.
All were observed. At narrow widths, pane status clips identity before its owner
and relevant rank. The tests additionally cover all authored locales, save
failure feedback, malformed/duplicate JSON refusal, unrelated raw JSON and
large integer preservation, existing permissions, symlinks, application restart,
and the extra Compact list row's pointer mapping.

The witnesses cover the current single-viewer workspace with Files and Graft
drawers. They do not establish arbitrary split editing, semantic file search,
Git status aggregation or general settings replay. Those have no implementation
in this change. Other Appearance settings retain their existing session lifetime.
