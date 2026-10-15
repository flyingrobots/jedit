# Inline explorer and preview syntax witnesses

These captures render Surface cells from the native Bijou terminal loop with
production Echo and the installed Graft parser. The fixture is synthetic local
TypeScript source. The committed helper reproduces the flow.

| Capture | Behavior |
| --- | --- |
| [Nested folders and colored source, 100x32](nested-syntax-dark-100x32.png) | Click expanded src/components; clicking panel.ts previewed 13 syntax spans. |
| [Filtered hierarchy, 100x32](filtered-nested-dark-100x32.png) | /panel retained src and components, selected panel.ts, and kept its colored preview. |
| [Collapsed folder, 100x32](collapsed-nested-dark-100x32.png) | Enter removed components' children and kept sibling main.ts visible. |
| [Minimum-size dark, 60x12](nested-syntax-dark-60x12.png) | Enter expanded both levels; selection/indentation and keyword/string/number colors fit. |
| [Arabic/light, 60x16](nested-syntax-light-rtl-60x16.png) | Localized preview label and footer, literal paths/source, themed syntax colors. |

Recorded native observations:

- The explorer cwd stayed identical across all wide-run operations.
- The selected preview contained 13 Graft syntax spans; textRequestId stayed 0
  and authority stayed none during folder operations and preview selection.
- Enter on the selected file then produced textRequestId 1, editor focus and
  opened authority through the production Echo path.
- Mouse expanded directories; keyboard Enter collapsed and reopened them.

The cell images use Menlo with Apple Symbols/Geeza Pro fallback fonts.
Arabic glyph shaping is terminal-dependent; this rasterization verifies cell
alignment and literal code/path order, not full Arabic shaping.
`receipt.json` records dimensions and captured-cell digests.

Reproduce after `npm run build`:

```sh
node scripts/explorer-inline-witness.mjs
JIM_EXPLORER_WITNESS_LOCALE=ar JIM_EXPLORER_WITNESS_LIGHT=1 node scripts/explorer-inline-witness.mjs
```

The helper writes synthetic files, isolated preferences and Echo WAL to a fresh
temporary directory. Its path is in `/tmp/jim-inline-tree-witness-directory.txt`.
Use Ctrl+B, then j Enter j Enter j to expand both levels and select panel.ts.
Clicking the same directory rows exercises pointer toggling. Type /panel to
filter; Esc exits filtering. Enter on the file opens it. Ctrl+C exits.

Validation: 47 focused explorer/Graft tests passed; the selection-index
correction then passed 24 focused navigation/tree/syntax tests. The final full
local check passed 907 tests: 895 passed, 12 existing skips, zero failures, and
no quality regressions. All 140 specs belong to CI shards. Hosted exact-head
checks are recorded in PR #349.
