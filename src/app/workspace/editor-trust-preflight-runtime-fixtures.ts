import path from 'node:path';
import type { EditorFilePort } from '../../ports/editor-file.js';
import {
  FileEntryKinds,
  type DirectoryAction,
  type FileEntry,
  type FileSystemPort,
} from '../../ports/file-system.js';
import type { GraftDiagnosticsPort } from '../../ports/graft-diagnostics.js';
import {
  GraftProjectionPostures,
  GraftProjectionSources,
  type GraftInfo,
  type GraftSessionPort,
} from '../../ports/graft-session.js';
import type { I18nLocaleOption, I18nPort } from '../../ports/i18n.js';
import {
  JEDIT_WSC_WORKSPACE_STORE_OBSTRUCTED,
  JEDIT_WSC_WORKSPACE_STORE_WRITTEN,
  type JeditWscWorkspaceEnvelope,
  type JeditWscWorkspaceStorePort,
} from '../../ports/jedit-wsc-workspace-store.js';
import type { SourceHighlighter } from '../../ports/source-highlighter.js';
import type { TitleSceneLoaderPort } from '../../ports/title-scene-loader.js';
import { resolveInitialJeditTheme } from '../../ui/jedit-themes.js';
import type { ProfilerTracePort } from '../raytracer-profiler.js';
import {
  type ProductionTextCheckpointRequest,
  type ProductionTextDeleteRequest,
  type ProductionTextExportRequest,
  type ProductionTextInsertRequest,
  type ProductionTextMultiRangeRequest,
  type ProductionTextOpenRequest,
  type ProductionTextReplaceRequest,
  type ProductionTextWindowRequest,
} from './production-text-session.js';
import { createPreflightProductionTextSession } from './editor-trust-preflight-production-text-fixture.js';
import type { WorkspaceRuntimeDependencies } from './workspace-runtime-dependencies.js';
import { createWorkspaceTextOperationSequencer } from './workspace-text-operation-sequencer.js';
import { WorkspaceMessageTypes } from './msg.js';

export const PREFLIGHT_NOW_MS = 42;
export const PREFLIGHT_COLUMNS = 100;
export const PREFLIGHT_ROWS = 24;
export const PREFLIGHT_WORKSPACE_ROOT = '/repo';
export const PREFLIGHT_DEFAULT_FILE_NAME = 'notes.md';
export const PREFLIGHT_DEFAULT_FILE_PATH = '/repo/notes.md';
export const PREFLIGHT_DEFAULT_BUFFER_ID = 'buffer:notes';
export const PREFLIGHT_DEFAULT_READING_TEXT = 'Echo opened text';
export const PREFLIGHT_DEFAULT_EDITED_READING_TEXT = 'Echo edited text';
export const PREFLIGHT_DEFAULT_EXPORT_TEXT = 'saved from Echo';
export const PREFLIGHT_FIRST_INDEX = 0;
export const PREFLIGHT_ONE = 1;

const DEFAULT_PROFILE_PATH = '/tmp/jedit-preflight-profile.json';
const DEFAULT_WORKSPACE_STORE_PATH = '/repo/.jedit/echo-wsc/envelopes';
const DEFAULT_LOCALE = 'en';
const DEFAULT_LOCALE_LABEL = 'English';
const DEFAULT_TEXT_START_BYTE = 0;
const WSC_OBSTRUCTION_CODE = 'preflight-wsc-obstructed';
const WSC_OBSTRUCTION_MESSAGE = 'preflight WSC store is read-only';
const DIRECTORY_ISSUE_TITLE = 'Preflight directory issue';
const GRAFT_DIAGNOSTICS_TITLE = 'Graft diagnostics';
const GRAFT_DIAGNOSTICS_SUMMARY = 'preflight diagnostics';
const GRAFT_INFO_RELATIVE_PATH = 'notes.md';
const TITLE_SCENE_FILE_MESSAGE =
  'preflight title scene file loading is unavailable';
const TITLE_SCENE_BUILT_IN_MESSAGE =
  'preflight built-in title scene loading is unavailable';
const PREFLIGHT_TITLE_SCENE_SEED = 0.5;

export interface PreflightSavedFile {
  readonly filePath: string;
  readonly lines: readonly string[];
}

export interface PreflightProductionTextCalls {
  readonly open: ProductionTextOpenRequest[];
  readonly insert: ProductionTextInsertRequest[];
  readonly replace: ProductionTextReplaceRequest[];
  readonly delete: ProductionTextDeleteRequest[];
  readonly observe: ProductionTextWindowRequest[];
  readonly export: ProductionTextExportRequest[];
  readonly checkpoint: ProductionTextCheckpointRequest[];
  readonly multiRange: ProductionTextMultiRangeRequest[];
}

export interface PreflightRuntimeHarnessOptions {
  readonly entries?: readonly FileEntry[];
  readonly hostLinesByPath?: ReadonlyMap<string, readonly string[]>;
  readonly readings?: readonly string[];
  readonly exportText?: string;
  readonly bufferIdByKey?: ReadonlyMap<string, string>;
}

export function createPreflightProductionTextCalls(): PreflightProductionTextCalls {
  return {
    open: [],
    insert: [],
    replace: [],
    delete: [],
    observe: [],
    export: [],
    checkpoint: [],
    multiRange: [],
  };
}

export function createPreflightRuntimeDependencies(
  options: PreflightRuntimeHarnessOptions,
  calls: PreflightProductionTextCalls,
  savedFiles: PreflightSavedFile[],
): WorkspaceRuntimeDependencies {
  return {
    initialColumns: PREFLIGHT_COLUMNS,
    initialRows: PREFLIGHT_ROWS,
    initialWorkingDirectory: PREFLIGHT_WORKSPACE_ROOT,
    ...preflightRuntimePorts(options, calls, savedFiles),
    profileOnStartup: false,
    ...preflightRuntimeCommands(),
    initialModel: preflightInitialModel(options),
    nowMs: () => PREFLIGHT_NOW_MS,
  };
}

function preflightRuntimePorts(
  options: PreflightRuntimeHarnessOptions,
  calls: PreflightProductionTextCalls,
  savedFiles: PreflightSavedFile[],
): Pick<
  WorkspaceRuntimeDependencies,
  | 'fileSystem'
  | 'editorFile'
  | 'graftDiagnostics'
  | 'graftSession'
  | 'sourceHighlighter'
  | 'titleSceneLoader'
  | 'productionTextSession'
  | 'textOperationSequencer'
  | 'wscWorkspaceStore'
  | 'profiler'
> {
  return {
    fileSystem: preflightFileSystem(options.entries),
    editorFile: preflightEditorFile(options, savedFiles),
    graftDiagnostics: preflightGraftDiagnostics(),
    graftSession: preflightGraftSession(),
    sourceHighlighter: preflightSourceHighlighter(),
    titleSceneLoader: preflightTitleSceneLoader(),
    productionTextSession: createPreflightProductionTextSession(options, calls),
    textOperationSequencer: createWorkspaceTextOperationSequencer(),
    wscWorkspaceStore: preflightWscWorkspaceStore(),
    profiler: preflightProfiler(),
  };
}

function preflightRuntimeCommands(): Pick<
  WorkspaceRuntimeDependencies,
  | 'createTimeTickCmd'
  | 'createNotificationTickCmd'
  | 'createDrawerAnimationCmd'
  | 'createStartupFileDrawerAnimationCmd'
> {
  return {
    createTimeTickCmd: () => () => ({
      type: WorkspaceMessageTypes.TimeTick,
      time: PREFLIGHT_NOW_MS,
    }),
    createNotificationTickCmd: () => () => ({
      type: WorkspaceMessageTypes.NotificationTick,
      atMs: PREFLIGHT_NOW_MS,
    }),
    createDrawerAnimationCmd: () => [],
    createStartupFileDrawerAnimationCmd: () => [],
  };
}

function preflightInitialModel(
  options: PreflightRuntimeHarnessOptions,
): WorkspaceRuntimeDependencies['initialModel'] {
  return {
    titleSceneSeed: PREFLIGHT_TITLE_SCENE_SEED,
    jeditTheme: resolveInitialJeditTheme(undefined),
    i18n: preflightI18n(),
    entries: options.entries ?? defaultFileEntries(),
    nowMs: PREFLIGHT_NOW_MS,
  };
}

function preflightFileSystem(entries: readonly FileEntry[] | undefined): FileSystemPort {
  return {
    loadEntries: () => entries ?? defaultFileEntries(),
    describeDirectoryIssue: (action: DirectoryAction, cwd: string, cause: Error | string) => ({
      title: DIRECTORY_ISSUE_TITLE,
      message: `${action}:${cwd}:${String(cause)}`,
    }),
    dirname: (cwd: string) => path.dirname(cwd),
    join: (...parts: readonly string[]) => path.join(...parts),
    resolve: (...parts: readonly string[]) => path.resolve(...parts),
  };
}

function defaultFileEntries(): readonly FileEntry[] {
  return [
    {
      kind: FileEntryKinds.File,
      name: PREFLIGHT_DEFAULT_FILE_NAME,
      path: PREFLIGHT_DEFAULT_FILE_PATH,
    },
  ];
}

function preflightEditorFile(
  options: PreflightRuntimeHarnessOptions,
  savedFiles: PreflightSavedFile[],
): EditorFilePort {
  return {
    loadEditorFile: (filePath: string) => ({
      lines: options.hostLinesByPath?.get(filePath) ?? ['host import'],
      readOnly: false,
    }),
    saveEditorFile: (filePath: string, lines: readonly string[]) => {
      savedFiles.push({ filePath, lines });
    },
  };
}

function preflightGraftDiagnostics(): GraftDiagnosticsPort {
  return {
    loadDiagnostics: async () => ({
      title: GRAFT_DIAGNOSTICS_TITLE,
      summary: GRAFT_DIAGNOSTICS_SUMMARY,
      rows: [],
    }),
    failedDiagnostics: ({ message }) => ({
      title: GRAFT_DIAGNOSTICS_TITLE,
      summary: message,
      rows: [],
    }),
  };
}

function preflightGraftSession(): GraftSessionPort {
  return {
    loadGraftInfo: async () => preflightGraftInfo(),
    failedGraftInfo: () => preflightGraftInfo(),
    closeConnection: async () => undefined,
  };
}

function preflightGraftInfo(): GraftInfo {
  return {
    path: PREFLIGHT_DEFAULT_FILE_PATH,
    relativePath: GRAFT_INFO_RELATIVE_PATH,
    dirty: false,
    projectionSource: GraftProjectionSources.SavedFile,
    projectionPosture: GraftProjectionPostures.Current,
    outlineItems: [],
    changeLines: [],
  };
}

function preflightSourceHighlighter(): SourceHighlighter {
  return {
    highlight: async (input) => ({
      path: input.path,
      partial: false,
      spans: [],
    }),
  };
}

function preflightTitleSceneLoader(): TitleSceneLoaderPort {
  return {
    loadTitleSceneFromFile: () => Promise.reject(TITLE_SCENE_FILE_MESSAGE),
    loadBuiltInTitleScene: () => Promise.reject(TITLE_SCENE_BUILT_IN_MESSAGE),
  };
}

function preflightWscWorkspaceStore(): JeditWscWorkspaceStorePort {
  return {
    writeEnvelope: (envelope: JeditWscWorkspaceEnvelope) => ({
      status: JEDIT_WSC_WORKSPACE_STORE_WRITTEN,
      envelopeId: envelope.envelopeId,
      byteLength: envelope.bytes.byteLength,
      workspacePath: DEFAULT_WORKSPACE_STORE_PATH,
    }),
    readEnvelope: () => preflightWscObstruction(),
    listEnvelopes: () => preflightWscObstruction(),
  };
}

function preflightWscObstruction() {
  return {
    status: JEDIT_WSC_WORKSPACE_STORE_OBSTRUCTED,
    obstruction: {
      code: WSC_OBSTRUCTION_CODE,
      message: WSC_OBSTRUCTION_MESSAGE,
    },
  } as const;
}

function preflightProfiler(): ProfilerTracePort {
  return {
    nowMs: () => PREFLIGHT_NOW_MS,
    memoryUsage: () => ({
      heapUsedBytes: DEFAULT_TEXT_START_BYTE,
      heapTotalBytes: DEFAULT_TEXT_START_BYTE,
      rssBytes: DEFAULT_TEXT_START_BYTE,
      externalBytes: DEFAULT_TEXT_START_BYTE,
      arrayBuffersBytes: DEFAULT_TEXT_START_BYTE,
    }),
    beginTrace: async () => ({
      filePath: DEFAULT_PROFILE_PATH,
      append: async () => undefined,
      close: async () => undefined,
    }),
    appendTraceFrame: async () => undefined,
    endTrace: async () => undefined,
  };
}

function preflightI18n(): I18nPort {
  const localeOption: I18nLocaleOption = {
    locale: DEFAULT_LOCALE,
    label: DEFAULT_LOCALE_LABEL,
    direction: 'ltr',
  };
  return {
    locale: DEFAULT_LOCALE,
    localeLabel: DEFAULT_LOCALE_LABEL,
    direction: localeOption.direction,
    locales: [localeOption],
    t: (translationKey: string) => translationKey,
    setLocale: () => undefined,
    withLocale: () => preflightI18n(),
  };
}
