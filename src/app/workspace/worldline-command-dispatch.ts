import type { Cmd } from '@flyingrobots/bijou-tui';
import { FocusPanes } from '../../ui/panel-focus.js';
import { closeWorkspaceCommandLine, invalidateWorkspaceCommandLine } from './command-line.js';
import { withFocusPane } from './focus.js';
import type { WorkspaceModel } from './model.js';
import type { WorkspaceMsg } from './msg.js';
import { WorkspaceCommandNames } from './workspace-command-names.js';
import {
  admitWorkspaceBraid,
  applyTtdCommand,
  createWorkspaceStrand,
  previewWorkspaceBraid,
  switchWorkspaceStrand,
  WorkspaceHistoryDrawerViews,
} from './worldline-state.js';

type KeyBindingResult = [WorkspaceModel, Cmd<WorkspaceMsg>[]];

export interface ParsedWorldlineWorkspaceCommand {
  readonly name: string;
  readonly argument: string;
}

const STRAND_SUBCOMMAND_NEW = 'new';
const STRAND_SUBCOMMAND_SWITCH = 'switch';
const STRAND_SUBCOMMAND_LIST = 'list';
const STRAND_NEW_FROM_HERE = 'from here';
const BRAID_SUBCOMMAND_VIEW = 'view';
const BRAID_SUBCOMMAND_PREVIEW = 'preview';
const BRAID_SUBCOMMAND_ADMIT = 'admit';
const COMMAND_ARGUMENT_SEPARATOR_PATTERN = /\s+/;
const EMPTY_TOKEN_COUNT = 0;
const SINGLE_TOKEN_COUNT = 1;
const PAIR_TOKEN_COUNT = 2;

export function dispatchWorldlineCommand(
  model: WorkspaceModel,
  command: ParsedWorldlineWorkspaceCommand,
): KeyBindingResult | undefined {
  if (isTimeTravelDebuggerCommand(command.name)) {
    return dispatchTimeTravelDebuggerCommand(model, command.argument);
  }
  if (isStrandCommand(command.name)) {
    return dispatchStrandCommand(model, command.argument);
  }
  return isBraidCommand(command.name)
    ? dispatchBraidCommand(model, command.argument)
    : undefined;
}

function dispatchTimeTravelDebuggerCommand(
  model: WorkspaceModel,
  argument: string,
): KeyBindingResult {
  const result = applyTtdCommand(model.worldline, argument);
  return result.worldline != null
    ? [
      {
        ...closeWorkspaceCommandLine(model),
        worldline: result.worldline,
      },
      [],
    ]
    : [invalidateWorkspaceCommandLine(model), []];
}

function dispatchStrandCommand(
  model: WorkspaceModel,
  argument: string,
): KeyBindingResult {
  const tokens = commandArgumentTokens(argument);
  const subcommand = tokens[0];
  if (subcommand === STRAND_SUBCOMMAND_LIST && tokens.length === SINGLE_TOKEN_COUNT) {
    return [openWorldlineGraphView(closeWorkspaceCommandLine(model)), []];
  }
  if (subcommand === STRAND_SUBCOMMAND_SWITCH && tokens.length === PAIR_TOKEN_COUNT) {
    return dispatchStrandSwitchCommand(model, tokens);
  }
  return subcommand === STRAND_SUBCOMMAND_NEW
    ? dispatchStrandNewCommand(model, tokens)
    : [invalidateWorkspaceCommandLine(model), []];
}

function dispatchBraidCommand(
  model: WorkspaceModel,
  argument: string,
): KeyBindingResult {
  const tokens = commandArgumentTokens(argument);
  const subcommand = tokens[0];
  if (subcommand === BRAID_SUBCOMMAND_VIEW && tokens.length === SINGLE_TOKEN_COUNT) {
    return [openWorldlineGraphView(closeWorkspaceCommandLine(model)), []];
  }
  if (subcommand === BRAID_SUBCOMMAND_PREVIEW && tokens.length <= PAIR_TOKEN_COUNT) {
    return dispatchBraidPreviewCommand(model, tokens);
  }
  return subcommand === BRAID_SUBCOMMAND_ADMIT && tokens.length <= PAIR_TOKEN_COUNT
    ? dispatchBraidAdmitCommand(model, tokens)
    : [invalidateWorkspaceCommandLine(model), []];
}

function dispatchStrandSwitchCommand(
  model: WorkspaceModel,
  tokens: readonly string[],
): KeyBindingResult {
  const name = tokens[1];
  const worldline = name == null
    ? undefined
    : switchWorkspaceStrand(model.worldline, name);
  return worldline == null
    ? [invalidateWorkspaceCommandLine(model), []]
    : [openWorldlineGraphModel(model, worldline), []];
}

function dispatchStrandNewCommand(
  model: WorkspaceModel,
  tokens: readonly string[],
): KeyBindingResult {
  return [
    openWorldlineGraphModel(
      model,
      createWorkspaceStrand(model.worldline, strandNameFromNewCommand(tokens)),
    ),
    [],
  ];
}

function dispatchBraidPreviewCommand(
  model: WorkspaceModel,
  tokens: readonly string[],
): KeyBindingResult {
  const worldline = previewWorkspaceBraid(model.worldline, tokens[1]);
  return worldline == null
    ? [invalidateWorkspaceCommandLine(model), []]
    : [openWorldlineGraphModel(model, worldline), []];
}

function dispatchBraidAdmitCommand(
  model: WorkspaceModel,
  tokens: readonly string[],
): KeyBindingResult {
  const worldline = admitWorkspaceBraid(model.worldline, tokens[1]);
  return worldline == null
    ? [invalidateWorkspaceCommandLine(model), []]
    : [openWorldlineGraphModel(model, worldline), []];
}

function openWorldlineGraphModel(
  model: WorkspaceModel,
  worldline: WorkspaceModel['worldline'],
): WorkspaceModel {
  return openWorldlineGraphView({
    ...closeWorkspaceCommandLine(model),
    worldline,
  });
}

function openWorldlineGraphView(model: WorkspaceModel): WorkspaceModel {
  return withFocusPane({
    ...model,
    historyDrawerOpen: true,
    historyDrawerProgress: 1,
    historyDrawerView: WorkspaceHistoryDrawerViews.Worldlines,
  }, FocusPanes.History);
}

function commandArgumentTokens(argument: string): readonly string[] {
  const trimmed = argument.trim();
  return trimmed.length === EMPTY_TOKEN_COUNT
    ? []
    : trimmed.split(COMMAND_ARGUMENT_SEPARATOR_PATTERN);
}

function strandNameFromNewCommand(tokens: readonly string[]): string | undefined {
  const name = tokens.slice(SINGLE_TOKEN_COUNT).join(' ');
  return name === STRAND_NEW_FROM_HERE ? undefined : name;
}

function isTimeTravelDebuggerCommand(name: string): boolean {
  return name === WorkspaceCommandNames.TimeTravelDebugger;
}

function isStrandCommand(name: string): boolean {
  return name === WorkspaceCommandNames.Strand;
}

function isBraidCommand(name: string): boolean {
  return name === WorkspaceCommandNames.Braid;
}
