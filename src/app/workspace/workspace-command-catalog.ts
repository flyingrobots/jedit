import { WorkspaceCommandNames } from "./workspace-command-names.js";

export interface WorkspaceCommandDescriptor {
  readonly id: string;
  readonly name: string;
  readonly aliases: readonly string[];
  readonly detail: string;
  readonly detailKey: string;
  readonly usage: string;
  readonly help: readonly string[];
  readonly requiresOpenFile?: boolean;
}

export interface WorkspaceCommandArgumentDescriptor {
  readonly id: string;
  readonly commandName: string;
  readonly previewCommandName?: string;
  readonly label: string;
  readonly detail: string;
  readonly replacementText: string;
  readonly help: readonly string[];
}

interface WorkspaceCommandArgumentDefinition {
  readonly id: string;
  readonly commandName: string;
  readonly previewCommandName?: string;
  readonly label: string;
  readonly detail: string;
  readonly replacementText: string;
  readonly help: readonly string[];
}

const COMMAND_DETAIL_KEYS = Object.freeze({
  Edit: "footer.command.details.edit",
  Write: "footer.command.details.write",
  Quit: "footer.command.details.quit",
  WriteQuit: "footer.command.details.wq",
  TimeTravelDebugger: "footer.command.details.ttd",
  Strand: "footer.command.details.strand",
  Braid: "footer.command.details.braid",
  Why: "footer.command.details.why",
  Help: "footer.command.details.help",
});
const COMMAND_HELP_TITLE = "Command help";
const UNKNOWN_COMMAND_HELP_PREFIX = "Unknown command:";

const WORKSPACE_COMMAND_DESCRIPTORS = [
  {
    id: "command:edit",
    name: WorkspaceCommandNames.Edit,
    aliases: [WorkspaceCommandNames.EditAlias],
    detail: "Open a file",
    detailKey: COMMAND_DETAIL_KEYS.Edit,
    usage: "edit <path>",
    help: ["Open a workspace file by path or visible file-list name."],
  },
  {
    id: "command:write",
    name: WorkspaceCommandNames.Write,
    aliases: [WorkspaceCommandNames.WriteAlias],
    detail: "Write the current file",
    detailKey: COMMAND_DETAIL_KEYS.Write,
    usage: "write",
    help: ["Materialize the current Echo-backed buffer to disk."],
    requiresOpenFile: true,
  },
  {
    id: "command:quit",
    name: WorkspaceCommandNames.Quit,
    aliases: [WorkspaceCommandNames.QuitAlias],
    detail: "Quit jedit",
    detailKey: COMMAND_DETAIL_KEYS.Quit,
    usage: "quit",
    help: ["Open the quit confirmation prompt."],
  },
  {
    id: "command:wq",
    name: WorkspaceCommandNames.WriteQuit,
    aliases: [WorkspaceCommandNames.WriteQuitAlias],
    detail: "Write and quit",
    detailKey: COMMAND_DETAIL_KEYS.WriteQuit,
    usage: "wq",
    help: ["Queue a save, then quit after the save can be trusted."],
    requiresOpenFile: true,
  },
  {
    id: "command:ttd",
    name: WorkspaceCommandNames.TimeTravelDebugger,
    aliases: [],
    detail: "Observe a causal tick without moving canonical head",
    detailKey: COMMAND_DETAIL_KEYS.TimeTravelDebugger,
    usage: "ttd <head|here|tick|+n|-n>",
    help: [
      "Unavailable until Echo installs the generated historical-observation operation.",
    ],
  },
  {
    id: "command:strand",
    name: WorkspaceCommandNames.Strand,
    aliases: [],
    detail: "Create, switch, or list copy-on-write strands",
    detailKey: COMMAND_DETAIL_KEYS.Strand,
    usage: "strand <list|new [name]|new from here|switch <name>>",
    help: [
      "Unavailable until Echo installs generated strand operations and observations.",
    ],
  },
  {
    id: "command:braid",
    name: WorkspaceCommandNames.Braid,
    aliases: [],
    detail: "View, preview, or admit braid candidates",
    detailKey: COMMAND_DETAIL_KEYS.Braid,
    usage: "braid <view|preview [strand]|admit [strand]>",
    help: [
      "Unavailable until Echo installs generated braid operations and observations.",
    ],
  },
  {
    id: "command:why",
    name: WorkspaceCommandNames.Why,
    aliases: [],
    detail: "Explain the last meaningful command",
    detailKey: COMMAND_DETAIL_KEYS.Why,
    usage: "why",
    help: [
      "Explain the last meaningful edit or the current range when no command event exists.",
      "The explanation stays anchored near the cursor until Escape or cursor movement.",
    ],
  },
  {
    id: "command:help",
    name: WorkspaceCommandNames.Help,
    aliases: [],
    detail: "Show command help",
    detailKey: COMMAND_DETAIL_KEYS.Help,
    usage: "help [command]",
    help: ["Show the command catalog or focused help for one command."],
  },
] satisfies readonly WorkspaceCommandDescriptor[];

const WORKSPACE_COMMAND_ARGUMENT_DESCRIPTORS = [
  argument({
    id: "ttd:head",
    commandName: WorkspaceCommandNames.TimeTravelDebugger,
    label: "head",
    detail: "Return to canonical head",
    replacementText: "head",
    help: ["Observe the canonical head again."],
  }),
  argument({
    id: "ttd:here",
    commandName: WorkspaceCommandNames.TimeTravelDebugger,
    label: "here",
    detail: "Keep current observer basis",
    replacementText: "here",
    help: ["Leave the current observed basis unchanged."],
  }),
  argument({
    id: "ttd:previous",
    commandName: WorkspaceCommandNames.TimeTravelDebugger,
    label: "-1",
    detail: "Observe previous causal tick",
    replacementText: "-1",
    help: ["Move the observer one causal tick back."],
  }),
  argument({
    id: "strand:list",
    commandName: WorkspaceCommandNames.Strand,
    label: "list",
    detail: "Show worldline graph",
    replacementText: "list",
    help: ["Open the worldline graph drawer."],
  }),
  argument({
    id: "strand:new-here",
    commandName: WorkspaceCommandNames.Strand,
    label: "new from here",
    detail: "Fork from current basis",
    replacementText: "new from here",
    help: ["Create a named strand from the current observer basis."],
  }),
  argument({
    id: "strand:switch-main",
    commandName: WorkspaceCommandNames.Strand,
    label: "switch main",
    detail: "Switch back to main",
    replacementText: "switch main",
    help: ["Switch the active worldline posture back to main."],
  }),
  argument({
    id: "braid:view",
    commandName: WorkspaceCommandNames.Braid,
    label: "view",
    detail: "Show braid/worldline graph",
    replacementText: "view",
    help: ["Open the worldline graph drawer."],
  }),
  argument({
    id: "braid:preview",
    commandName: WorkspaceCommandNames.Braid,
    label: "preview",
    detail: "Preview current strand braid",
    replacementText: "preview",
    help: ["Preview a braid candidate for the current strand."],
  }),
  argument({
    id: "braid:admit",
    commandName: WorkspaceCommandNames.Braid,
    label: "admit",
    detail: "Admit current braid preview",
    replacementText: "admit",
    help: ["Admit the current braid preview when one exists."],
  }),
] satisfies readonly WorkspaceCommandArgumentDescriptor[];

export function workspaceCommandDescriptors(): readonly WorkspaceCommandDescriptor[] {
  return WORKSPACE_COMMAND_DESCRIPTORS;
}

export function workspaceCommandArgumentDescriptors(
  commandName: string,
): readonly WorkspaceCommandArgumentDescriptor[] {
  const normalizedCommandName = normalizedWorkspaceCommandLookup(commandName);
  return WORKSPACE_COMMAND_ARGUMENT_DESCRIPTORS.filter((descriptor) =>
    descriptor.commandName === normalizedCommandName,
  );
}

export function workspaceCommandDescriptorByName(
  name: string,
): WorkspaceCommandDescriptor | undefined {
  const normalizedName = normalizedWorkspaceCommandLookup(name);
  return WORKSPACE_COMMAND_DESCRIPTORS.find((descriptor) =>
    descriptor.name === normalizedName ||
    descriptor.aliases.some((alias) => alias === normalizedName),
  );
}

export function workspaceCommandHelpTitle(name: string | undefined): string {
  if (name == null) {
    return COMMAND_HELP_TITLE;
  }
  const descriptor = workspaceCommandDescriptorByName(name);
  return descriptor == null ? COMMAND_HELP_TITLE : `:${descriptor.name}`;
}

export function workspaceCommandHelpLines(name: string | undefined): readonly string[] {
  const descriptor = name == null ? undefined : workspaceCommandDescriptorByName(name);
  if (descriptor != null) {
    return [
      `Usage: :${descriptor.usage}`,
      ...descriptor.help,
    ];
  }
  if (name != null) {
    return [`${UNKNOWN_COMMAND_HELP_PREFIX} ${name}`];
  }
  return WORKSPACE_COMMAND_DESCRIPTORS.map((command) =>
    `:${command.usage} - ${command.detail}`,
  );
}

function normalizedWorkspaceCommandLookup(name: string): string {
  return name.trim().toLowerCase();
}

function argument(
  definition: WorkspaceCommandArgumentDefinition,
): WorkspaceCommandArgumentDescriptor {
  return {
    id: `command-arg:${definition.id}`,
    commandName: definition.commandName,
    previewCommandName: definition.previewCommandName,
    label: definition.label,
    detail: definition.detail,
    replacementText: definition.replacementText,
    help: definition.help,
  };
}
