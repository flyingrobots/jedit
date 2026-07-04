# Help And Discovery

Jim should teach available actions at the point where the user needs them.
Help should be specific enough for dogfooding, but not so large that it hides
the editor.

## Help Surfaces

Jim uses several help surfaces:

| Surface | Purpose |
| --- | --- |
| Footer hints | Always-visible mode-specific key reminders. |
| Command completions | Command names, aliases, and one-line descriptions. |
| Inline command help | Argument shape and focused-command details. |
| `:help` | Browseable help for commands and concepts. |
| `:why` | Causal explanation of a command or selected range. |
| Settings descriptions | Short explanations for preferences. |

## `:help`

`:help` should open help rather than only appearing as a completion item. The
help surface should be keyboard navigable and should include at least:

- command list;
- command argument syntax;
- common key bindings;
- settings overview;
- explanation of causal concepts such as tick, strand, braid, admit, and why.

For command-line use, `:help <command>` should eventually jump to the command's
help entry.

## Footer Hints

Footer hints are for short reminders, not manuals. They should name the active
mode and the next useful keys. Examples:

```text
NORMAL [i insert - o open line - ctrl+s save - ctrl+t theme]
COMMAND [tab accept - enter run - esc cancel]
SETTINGS [j/k move - enter change - f2 close - esc close]
```

When a surface owns focus, the footer should describe that surface.

## Command Details

Command suggestions should include enough detail to run the command correctly.
For commands with arguments, show the argument shape near the suggestion:

```text
edit     cmd  Open a file
         args: <path>
strand   cmd  Create, switch, or list copy-on-write strands
         args: list | switch <name> | new <name>
```

The exact command grammar belongs in implementation and tests. This page
records the UI expectation: do not make the user discover arguments by trial
and error.

## Implementation Map

| File | Responsibility |
| --- | --- |
| [`src/ui/help.ts`](../../../src/ui/help.ts) | Help surface rendering. |
| [`src/app/workspace/command-completion.ts`](../../../src/app/workspace/command-completion.ts) | Command completion and details. |
| [`src/ui/workspace-chrome.ts`](../../../src/ui/workspace-chrome.ts) | Footer hint rendering. |
| [`src/ui/why-inline-panel.ts`](../../../src/ui/why-inline-panel.ts) | Causal explanation panel rendering. |
