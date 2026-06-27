import {
  FileEntryKinds,
  type FileEntry,
} from '../../ports/file-system.js';
import { FocusPanes } from '../../ui/panel-focus.js';
import type {
  EditorTrustPreflightObservation,
  EditorTrustPreflightProbe,
} from './editor-trust-preflight.js';
import {
  PREFLIGHT_DEFAULT_EDITED_READING_TEXT,
  PREFLIGHT_DEFAULT_EXPORT_TEXT,
  PREFLIGHT_DEFAULT_FILE_NAME,
  PREFLIGHT_DEFAULT_FILE_PATH,
  PREFLIGHT_DEFAULT_READING_TEXT,
  PREFLIGHT_FIRST_INDEX,
  PREFLIGHT_ONE,
} from './editor-trust-preflight-runtime-fixtures.js';
import {
  createPreflightRuntimeHarness,
  preflightActiveCommandLine,
  preflightEditorFocusedModel,
  preflightSavedText,
  type PreflightRuntimeHarness,
} from './editor-trust-preflight-runtime-harness.js';
import type { WorkspaceModel } from './model.js';
import { WorkspaceTextAuthorityKinds } from './workspace-text-authority.js';

const SECOND_FILE_NAME = 'other.md';
const SECOND_FILE_PATH = '/repo/other.md';
const FIRST_BUFFER_ID = 'buffer:first';
const SECOND_BUFFER_ID = 'buffer:second';
const SECOND_SELECTED_INDEX = 1;
const ZERO_OPEN_EDITORS = 0;
const SEARCH_TEXT = 'alpha beta alpha';
const INSERT_KEY = 'X';
const INSERT_KEY_LOWER = 'i';
const ESCAPE_KEY = 'escape';
const ENTER_KEY = 'enter';
const QUIT_KEY = 'q';
const SLASH_KEY = '/';
const QUESTION_KEY = '?';
const SAVE_KEY = 's';
const COMMAND_QUIT_FORCE = 'q!';

export function createEditorTrustPreflightRuntimeProbe(): EditorTrustPreflightProbe {
  return Object.freeze({
    observe: observeEditorTrustPreflight,
  });
}

async function observeEditorTrustPreflight(): Promise<EditorTrustPreflightObservation> {
  return {
    ...(await observeOpenEditSaveAndQuit()),
    dirtyFileSwitchBlocked: await observeDirtyFileSwitchBlocked(),
    ...(await observeSearchEntry()),
    hasMultipleOpenBuffers: await observeMultipleOpenBuffers(),
  };
}

async function observeOpenEditSaveAndQuit(): Promise<
  Pick<
    EditorTrustPreflightObservation,
    | 'openUsesProductionAuthority'
    | 'editUsesProductionAuthority'
    | 'saveExportsProductionText'
    | 'diskOutputVerified'
    | 'quitRequiresConfirmation'
    | 'forceQuitAvailable'
    | 'dirtyStateTracked'
    | 'dirtyQuitHasDirtySpecificGuard'
  >
> {
  const observed = await runOpenEditSaveAndQuitScenario();

  return {
    openUsesProductionAuthority: observed.harness.calls.open.length === PREFLIGHT_ONE,
    editUsesProductionAuthority: observed.harness.calls.insert.length === PREFLIGHT_ONE,
    saveExportsProductionText:
      observed.harness.calls.export.length === PREFLIGHT_ONE &&
      observed.harness.calls.checkpoint.length === PREFLIGHT_ONE,
    diskOutputVerified: preflightSavedText(observed.harness) === PREFLIGHT_DEFAULT_EXPORT_TEXT,
    quitRequiresConfirmation: observed.quitRequiresConfirmation,
    forceQuitAvailable: observed.forceQuitAvailable,
    dirtyStateTracked: dirtyStateTracked(observed.dirtyModel),
    dirtyQuitHasDirtySpecificGuard: dirtyQuitUsesSpecificGuard(
      observed.dirtyModel,
      observed.harness.model,
    ),
  };
}

async function runOpenEditSaveAndQuitScenario() {
  const harness = createPreflightRuntimeHarness({
    readings: [PREFLIGHT_DEFAULT_READING_TEXT, PREFLIGHT_DEFAULT_EDITED_READING_TEXT],
    exportText: PREFLIGHT_DEFAULT_EXPORT_TEXT,
  });
  await harness.runFirst(await harness.key(ENTER_KEY));
  harness.setModel(preflightEditorFocusedModel(harness.model));
  await harness.key(INSERT_KEY_LOWER);
  await harness.runFirst(await harness.key(INSERT_KEY, { shift: true }));
  await harness.key(ESCAPE_KEY);
  const dirtyModel = harness.model;
  const quitCommands = await harness.key(QUIT_KEY);
  const quitRequiresConfirmation =
    harness.model.quitConfirmOpen && quitCommands.length === PREFLIGHT_FIRST_INDEX;
  harness.setModel({
    ...dirtyModel,
    commandLine: preflightActiveCommandLine(COMMAND_QUIT_FORCE),
  });
  const forceQuitCommands = await harness.key(ENTER_KEY);
  const forceQuitAvailable =
    !harness.model.quitConfirmOpen && forceQuitCommands.length === PREFLIGHT_ONE;
  harness.setModel(dirtyModel);
  const saveCommands = await harness.key(SAVE_KEY, { ctrl: true });
  await harness.runAll(saveCommands);
  return {
    harness,
    dirtyModel,
    quitRequiresConfirmation,
    forceQuitAvailable,
  };
}

async function observeDirtyFileSwitchBlocked(): Promise<boolean> {
  const harness = createPreflightRuntimeHarness({
    entries: preflightTwoFileEntries(),
    hostLinesByPath: new Map([
      [PREFLIGHT_DEFAULT_FILE_PATH, ['first']],
      [SECOND_FILE_PATH, ['second']],
    ]),
    bufferIdByKey: new Map([
      [PREFLIGHT_DEFAULT_FILE_PATH, FIRST_BUFFER_ID],
      [SECOND_FILE_PATH, SECOND_BUFFER_ID],
    ]),
    readings: ['first', 'dirty first', 'second'],
  });
  await harness.runFirst(await harness.key(ENTER_KEY));
  harness.setModel(preflightEditorFocusedModel(harness.model));
  await harness.key(INSERT_KEY_LOWER);
  await harness.runFirst(await harness.key(INSERT_KEY, { shift: true }));
  harness.setModel({
    ...harness.model,
    focusPane: FocusPanes.Files,
    fileDrawerOpen: true,
    selectedIndex: SECOND_SELECTED_INDEX,
  });
  await harness.key(ENTER_KEY);

  return !(
    harness.model.textAuthority.kind === WorkspaceTextAuthorityKinds.PendingOpen &&
    harness.model.textAuthority.filePath === SECOND_FILE_PATH
  );
}

async function observeSearchEntry(): Promise<
  Pick<
    EditorTrustPreflightObservation,
    'slashSearchEntryAvailable' | 'questionSearchEntryAvailable'
  >
> {
  const slashHarness = await createOpenedEditorHarness();
  await slashHarness.key(SLASH_KEY);
  const questionHarness = await createOpenedEditorHarness();
  await questionHarness.key(QUESTION_KEY);

  return {
    slashSearchEntryAvailable: searchEntryAvailable(slashHarness.model),
    questionSearchEntryAvailable: searchEntryAvailable(questionHarness.model),
  };
}

async function observeMultipleOpenBuffers(): Promise<boolean> {
  const harness = await createOpenedEditorHarness();
  const openEditorCount = harness.model.editor == null
    ? ZERO_OPEN_EDITORS
    : PREFLIGHT_ONE;
  return openEditorCount > PREFLIGHT_ONE;
}

async function createOpenedEditorHarness(): Promise<PreflightRuntimeHarness> {
  const harness = createPreflightRuntimeHarness({
    readings: [SEARCH_TEXT],
  });
  await harness.runFirst(await harness.key(ENTER_KEY));
  harness.setModel(preflightEditorFocusedModel(harness.model));
  return harness;
}

function preflightTwoFileEntries(): readonly FileEntry[] {
  return [
    {
      kind: FileEntryKinds.File,
      name: PREFLIGHT_DEFAULT_FILE_NAME,
      path: PREFLIGHT_DEFAULT_FILE_PATH,
    },
    {
      kind: FileEntryKinds.File,
      name: SECOND_FILE_NAME,
      path: SECOND_FILE_PATH,
    },
  ];
}

function dirtyStateTracked(model: WorkspaceModel): boolean {
  return (
    model.textAuthority.kind === WorkspaceTextAuthorityKinds.Opened &&
    model.textAuthority.dirty &&
    model.editor?.dirty === true
  );
}

function dirtyQuitUsesSpecificGuard(
  dirtyModel: WorkspaceModel,
  forceQuitModel: WorkspaceModel,
): boolean {
  return dirtyModel.quitConfirmOpen && forceQuitModel.quitConfirmOpen;
}

function searchEntryAvailable(model: WorkspaceModel): boolean {
  return model.commandLine.active || model.editor?.lastSearch?.pattern != null;
}
