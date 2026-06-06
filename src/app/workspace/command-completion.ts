import {
  INLINE_COMPLETION_ITEM_KIND,
  type InlineCompletionItem,
} from "../../ui/inline-completion-popup.js";
import type { WorkspaceCommandLineState } from "./command-line.js";

export interface WorkspaceCommandDescriptor {
  readonly id: string;
  readonly name: string;
  readonly aliases: readonly string[];
  readonly detail: string;
}

interface CommandNameCompletionContext {
  readonly query: string;
  readonly replacementStart: number;
  readonly replacementEnd: number;
}

const VIM_COMMAND_PROVIDER_ID = "vim-command";
const COMMAND_COMPLETION_EMPTY_QUERY = "";
const COMMAND_COMPLETION_FIRST_INDEX = 0;

const WORKSPACE_COMMAND_DESCRIPTORS = [
  {
    id: "command:edit",
    name: "edit",
    aliases: ["e"],
    detail: "Open a file",
  },
  {
    id: "command:write",
    name: "write",
    aliases: ["w"],
    detail: "Write the current file",
  },
  {
    id: "command:quit",
    name: "quit",
    aliases: ["q"],
    detail: "Quit jedit",
  },
  {
    id: "command:wq",
    name: "wq",
    aliases: ["x"],
    detail: "Write and quit",
  },
] satisfies readonly WorkspaceCommandDescriptor[];

export function workspaceCommandDescriptors(): readonly WorkspaceCommandDescriptor[] {
  return WORKSPACE_COMMAND_DESCRIPTORS;
}

export function workspaceCommandCompletionItems(
  commandLine: Pick<WorkspaceCommandLineState, "input" | "cursorIndex">,
): readonly InlineCompletionItem[] {
  const context = commandNameCompletionContext(commandLine);
  if (context == null) {
    return [];
  }

  return WORKSPACE_COMMAND_DESCRIPTORS.filter((descriptor) =>
    descriptorMatchesQuery(descriptor, context.query),
  ).map((descriptor) => commandCompletionItem(descriptor, context));
}

export function selectedWorkspaceCommandCompletionItem(
  commandLine: Pick<
    WorkspaceCommandLineState,
    "input" | "cursorIndex" | "selectedCompletionIndex"
  >,
): InlineCompletionItem | undefined {
  const items = workspaceCommandCompletionItems(commandLine);
  return items[selectedWorkspaceCommandCompletionIndex(commandLine, items.length)];
}

export function selectedWorkspaceCommandCompletionIndex(
  commandLine: Pick<WorkspaceCommandLineState, "selectedCompletionIndex">,
  completionCount: number,
): number {
  return Math.max(
    COMMAND_COMPLETION_FIRST_INDEX,
    Math.min(
      Math.max(COMMAND_COMPLETION_FIRST_INDEX, completionCount - 1),
      commandLine.selectedCompletionIndex,
    ),
  );
}

function commandCompletionItem(
  descriptor: WorkspaceCommandDescriptor,
  context: CommandNameCompletionContext,
): InlineCompletionItem {
  return {
    id: descriptor.id,
    label: descriptor.name,
    detail: commandCompletionDetail(descriptor),
    kind: INLINE_COMPLETION_ITEM_KIND.Command,
    providerId: VIM_COMMAND_PROVIDER_ID,
    replacement: {
      start: context.replacementStart,
      end: context.replacementEnd,
      text: descriptor.name,
    },
  };
}

function commandCompletionDetail(
  descriptor: WorkspaceCommandDescriptor,
): string {
  return descriptor.aliases.length === 0
    ? descriptor.detail
    : `${descriptor.detail} (${descriptor.aliases.join(", ")})`;
}

function descriptorMatchesQuery(
  descriptor: WorkspaceCommandDescriptor,
  query: string,
): boolean {
  const normalized = query.toLowerCase();
  return (
    normalized === COMMAND_COMPLETION_EMPTY_QUERY ||
    descriptor.name.startsWith(normalized) ||
    descriptor.aliases.some((alias) => alias.startsWith(normalized))
  );
}

function commandNameCompletionContext(
  commandLine: Pick<WorkspaceCommandLineState, "input" | "cursorIndex">,
): CommandNameCompletionContext | undefined {
  const input = commandLine.input;
  const cursorIndex = Math.max(
    COMMAND_COMPLETION_FIRST_INDEX,
    Math.min(input.length, commandLine.cursorIndex),
  );
  const replacementStart = firstCommandNameIndex(input);
  const replacementEnd = commandNameEndIndex(input, replacementStart);

  if (cursorIndex < replacementStart || cursorIndex > replacementEnd) {
    return undefined;
  }

  const query = input.slice(replacementStart, cursorIndex);
  return /\s/.test(query)
    ? undefined
    : {
        query,
        replacementStart,
        replacementEnd,
      };
}

function firstCommandNameIndex(input: string): number {
  const match = /\S/.exec(input);
  return match?.index ?? input.length;
}

function commandNameEndIndex(input: string, start: number): number {
  const rest = input.slice(start);
  const whitespaceIndex = rest.search(/\s/);
  return whitespaceIndex < 0 ? input.length : start + whitespaceIndex;
}
