import { FocusPanes } from '../../ui/panel-focus.js';
import { createWorkspaceRuntime, WorkspaceInputMessageTypes } from './runtime.js';
import type { WorkspaceCommandLineState } from './command-line.js';
import type { WorkspaceModel } from './model.js';
import type {
  WorkspaceRuntime,
  WorkspaceRuntimeResult,
} from './workspace-runtime-dependencies.js';
import type { WorkspaceMsg } from './msg.js';
import {
  PREFLIGHT_FIRST_INDEX,
  PREFLIGHT_NOW_MS,
  createPreflightProductionTextCalls,
  createPreflightRuntimeDependencies,
  type PreflightProductionTextCalls,
  type PreflightRuntimeHarnessOptions,
  type PreflightSavedFile,
} from './editor-trust-preflight-runtime-fixtures.js';

const TYPEOF_OBJECT = 'object';
const MESSAGE_TYPE_PROPERTY = 'type';

export type {
  PreflightProductionTextCalls,
  PreflightRuntimeHarnessOptions,
  PreflightSavedFile,
};

interface PreflightRuntimeHarnessState {
  readonly calls: PreflightProductionTextCalls;
  readonly savedFiles: readonly PreflightSavedFile[];
  readonly runtime: WorkspaceRuntime;
  model: WorkspaceModel;
}

export interface PreflightRuntimeHarness {
  readonly calls: PreflightProductionTextCalls;
  readonly savedFiles: readonly PreflightSavedFile[];
  readonly runtime: WorkspaceRuntime;
  readonly model: WorkspaceModel;
  readonly setModel: (model: WorkspaceModel) => void;
  readonly key: (
    key: string,
    modifiers?: {
      readonly ctrl?: boolean;
      readonly alt?: boolean;
      readonly shift?: boolean;
    },
  ) => Promise<WorkspaceRuntimeResult[1]>;
  readonly run: (
    command: WorkspaceRuntimeResult[1][number],
  ) => Promise<WorkspaceRuntimeResult[1]>;
  readonly runFirst: (
    commands: WorkspaceRuntimeResult[1],
  ) => Promise<WorkspaceRuntimeResult[1]>;
}

type WorkspaceCommand = WorkspaceRuntimeResult[1][number];
type WorkspaceCommandEmit = Parameters<WorkspaceCommand>[0];
type WorkspaceCommandCapabilities = Parameters<WorkspaceCommand>[1];
type WorkspaceCommandResult = Awaited<ReturnType<WorkspaceCommand>>;

export function createPreflightRuntimeHarness(
  options: PreflightRuntimeHarnessOptions = {},
): PreflightRuntimeHarness {
  const state = createPreflightRuntimeHarnessState(options);
  return {
    calls: state.calls,
    savedFiles: state.savedFiles,
    runtime: state.runtime,
    get model() {
      return state.model;
    },
    setModel(nextModel) {
      state.model = nextModel;
    },
    key: (key, modifiers = {}) => updateHarnessKey(state, key, modifiers),
    run: (command) => runHarnessCommand(state, command),
    runFirst: (commands) => runFirstHarnessCommand(state, commands),
  };
}

function createPreflightRuntimeHarnessState(
  options: PreflightRuntimeHarnessOptions,
): PreflightRuntimeHarnessState {
  const savedFiles: PreflightSavedFile[] = [];
  const calls = createPreflightProductionTextCalls();
  const runtime = createWorkspaceRuntime(
    createPreflightRuntimeDependencies(options, calls, savedFiles),
  );
  const [initialModel] = runtime.init();
  let model: WorkspaceModel = {
    ...initialModel,
    fileDrawerOpen: true,
    focusPane: FocusPanes.Files,
  };
  return {
    calls,
    savedFiles,
    runtime,
    model,
  };
}

export function preflightEditorFocusedModel(model: WorkspaceModel): WorkspaceModel {
  return {
    ...model,
    focusPane: FocusPanes.Editor,
    fileDrawerOpen: false,
  };
}

export function preflightActiveCommandLine(
  input: string,
): WorkspaceCommandLineState {
  return {
    active: true,
    input,
    cursorIndex: input.length,
    anchorCursorIndex: PREFLIGHT_FIRST_INDEX,
    selectedCompletionIndex: PREFLIGHT_FIRST_INDEX,
  };
}

export function preflightSavedText(harness: PreflightRuntimeHarness): string {
  return harness.savedFiles.map((file) => file.lines.join('\n')).join('\n');
}

const noopEmit: WorkspaceCommandEmit = (_msg: WorkspaceMsg): void => {
  return undefined;
};

function preflightCmdCapabilities(): WorkspaceCommandCapabilities {
  return {
    onPulse: () => ({ dispose: () => undefined }),
    sleep: async () => undefined,
    defer: async () => undefined,
    now: () => PREFLIGHT_NOW_MS,
  };
}

function keyMessage(
  key: string,
  modifiers: {
    readonly ctrl?: boolean;
    readonly alt?: boolean;
    readonly shift?: boolean;
  },
) {
  return {
    type: WorkspaceInputMessageTypes.Key,
    key,
    ctrl: modifiers.ctrl === true,
    alt: modifiers.alt === true,
    shift: modifiers.shift === true,
  };
}

function isWorkspaceMsgResult(
  result: WorkspaceCommandResult,
): result is WorkspaceMsg {
  return isObjectResult(result) && MESSAGE_TYPE_PROPERTY in result;
}

function isObjectResult(
  result: WorkspaceCommandResult,
): result is Extract<WorkspaceCommandResult, object> {
  return result != null && typeof result === TYPEOF_OBJECT;
}

async function updateHarnessKey(
  state: PreflightRuntimeHarnessState,
  key: string,
  modifiers: {
    readonly ctrl?: boolean;
    readonly alt?: boolean;
    readonly shift?: boolean;
  },
): Promise<WorkspaceRuntimeResult[1]> {
  const [nextModel, commands] = state.runtime.update(
    keyMessage(key, modifiers),
    state.model,
  );
  state.model = nextModel;
  return commands;
}

async function runHarnessCommand(
  state: PreflightRuntimeHarnessState,
  command: WorkspaceCommand,
): Promise<WorkspaceRuntimeResult[1]> {
  const message = await command(noopEmit, preflightCmdCapabilities());
  if (!isWorkspaceMsgResult(message)) {
    return [];
  }
  const [nextModel, commands] = state.runtime.update(message, state.model);
  state.model = nextModel;
  return commands;
}

async function runFirstHarnessCommand(
  state: PreflightRuntimeHarnessState,
  commands: WorkspaceRuntimeResult[1],
): Promise<WorkspaceRuntimeResult[1]> {
  const command = commands[PREFLIGHT_FIRST_INDEX];
  return command == null ? [] : runHarnessCommand(state, command);
}
