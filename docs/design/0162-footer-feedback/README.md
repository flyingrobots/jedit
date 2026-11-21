# Footer and explorer feedback witnesses

This gallery covers the accepted feedback after the original three-layout
witnesses: filled bold mode badges, muted ordinary status text, normal emphasis,
remembered filepath display, opaque Settings styling and a temporary explorer
filter prompt in the footer.

The native Bijou terminal loop used the production Echo host, an isolated Git
repository, WAL directory and injected `.jimrc`. PNGs render the captured terminal
cells with Menlo, including bold and underline. Font coverage differs by terminal;
Menlo lacks some title-scene braille glyphs in these artifact renders. The UI cell
colors, weights, positions and text come from the live application. The
[receipt](receipt.json) records input events, states, source commits and cell hashes.
The final Settings captures include the padding and border-foreground correction
at `c9ef3063`; the final filter capture includes shared pointer/prompt width at
`8a10e9a6`. Other captures are from `82060e45`.

| Behavior | Witness |
| --- | --- |
| `/alpha` owns the footer while the header identifies the filter | [100×32](feedback-filter-100x32.png), [final 60×16](feedback-final-filter-60x16.png) |
| Escape returns navigation and retains the query | [Navigation](feedback-nav-100x32.png) |
| Fully qualified paths after changing Filepaths in Settings | [Absolute display](feedback-absolute-100x32.png) |
| Normal mode uses a filled badge; modified state/count use normal foreground; path is muted | [Dark editor](feedback-editor-60x16.png), [light editor](feedback-editor-light-60x16.png) |
| Settings border, padding and selected row use explicit theme styles | [Final dark Settings](feedback-final-settings-dark-60x16.png), [final light Settings](feedback-final-settings-light-60x16.png) |
| Hidden footer appears temporarily for input and disappears on Escape | [Prompt](feedback-hidden-filter-60x16.png), [navigation](feedback-hidden-nav-60x16.png) |

The wide run changed Filepaths to Fully qualified and layout to Compact. The
narrow restart restored both from `.jimrc`. Native SGR mouse clicks placed the
filter caret, re-entered editing from the active-query header, and selected a list
item without opening it. Enter opened through the production Echo path; `iX`
produced a modified buffer and the emphasized count.

The light-theme inspection found unstyled padding and inherited border foreground
after the initial border-background fix. The regression test was expanded to all
drawer cells and explicit border foreground, then the final native Settings views
above confirmed the correction.

Validation: full local `npm run check` passed 892 tests with 880 passed, 12 existing
skips and zero failures. Quality reported no regressions. The focused UI/preference
set passed 49 tests. Coverage includes every built-in light/dark badge contrast,
normal emphasis versus muted text, opaque Settings cells, filepath save failure
and restart, raw JSON preservation, nested and linked Git worktree roots,
non-repository fallback, retained queries, Unicode caret clicks, list/preview
ownership and the one-row Compact viewport. Shard coverage assigns all 137 specs.
Final published-head CI is recorded on the PR.
