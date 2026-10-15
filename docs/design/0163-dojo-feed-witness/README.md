# Dojo Feed runtime witnesses

These images render captured cells from the native Bijou terminal loop with the
production Echo host. The fixture contains only synthetic local text. No board
connection or real feed data was used.

| Capture | What was exercised |
| --- | --- |
| [Wide dark](wide-dark-100x32.png) | F4 opened the waiting drawer at 100x32. |
| [Unsaved editor](editor-dark-100x32.png) | F4 from Insert mode; x and j were consumed; mouse close restored the unsaved buffer. |
| [Narrow dark](narrow-dark-60x12.png) | Pinned title, state, close and scroll hints at minimum supported size. |
| [Narrow scrolled](narrow-scrolled-60x12.png) | Mouse wheel moved scroll 0 to 3; End reached 9; controls stayed pinned. |
| [Arabic light](rtl-light-60x16.png) | Localized state aligned right; source address retained literal order. |

`receipt.json` records dimensions and captured-cell digests. The images use
Menlo with Apple Symbols and Geeza Pro fallbacks. They show individual terminal
cells; Arabic glyph shaping depends on the actual terminal and is not certified
by this rasterization.

Reproduce after `npm run build`:

```sh
node scripts/dojo-feed-witness.mjs
DOJO_FEED_WITNESS_LOCALE=ar DOJO_FEED_WITNESS_LIGHT=1 node scripts/dojo-feed-witness.mjs
```

The helper creates an isolated temporary fixture and preferences file, starts
the real application and writes key/mouse events plus frames into that fixture.
Its path is available at `/tmp/jim-dojo-feed-witness-directory.txt`.
Press F4; j/k or wheel scroll; F4/Esc or the close hint dismisses. Ctrl+C exits.
For the editor case, Ctrl+B, `/example`, Esc, Enter opens the fixture file;
`iX` makes it dirty, then F4, x, j and a click on the close hint verify isolation.

Validation: the full local check passed 902 tests, with 890 passes and 12 existing
skips. After the final scroll-hint refinement, all seven focused drawer/routing
tests and the quality gate passed again. Shard coverage includes all 139 specs.
Hosted exact-head validation is recorded in PR #347.
