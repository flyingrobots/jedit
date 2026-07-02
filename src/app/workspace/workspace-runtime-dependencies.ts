import type { Cmd, KeyMsg, MouseMsg, ResizeMsg, RuntimeIssue } from '@flyingrobots/bijou-tui';
import type { DrawerKind } from '../../ui/drawer-layout.js';
import type { EditorFilePort } from '../../ports/editor-file.js';
import type { FileSystemPort } from '../../ports/file-system.js';
import type { GraftDiagnosticsPort } from '../../ports/graft-diagnostics.js';
import type { GraftSessionPort } from '../../ports/graft-session.js';
import type { JeditWscWorkspaceStorePort } from '../../ports/jedit-wsc-workspace-store.js';
import type { SourceHighlighter } from '../../ports/source-highlighter.js';
import type { TitleSceneLoaderPort } from '../../ports/title-scene-loader.js';
import type { WorkspaceInitialModelSnapshot } from './init.js';
import type { CreateStartupFileDrawerAnimationCmd } from './key-binding-context.js';
import type { WorkspaceModel } from './model.js';
import type { WorkspaceMsg } from './msg.js';
import type { ProductionTextSession } from './production-text-session.js';
import type { WorkspaceTextOperationSequencer } from './workspace-text-operation-sequencer.js';
import type { ProfilerTracePort } from '../raytracer-profiler.js';
import type { renderWorkspace } from './viewer.js';

export type WorkspaceRuntimeMsg = WorkspaceMsg | ResizeMsg | KeyMsg | MouseMsg;
export type WorkspaceRuntimeResult = [WorkspaceModel, Cmd<WorkspaceMsg>[]];
export type WorkspaceResizeMsg = ResizeMsg;

export interface WorkspaceRuntimeDependencies {
  readonly initialColumns: number;
  readonly initialRows: number;
  readonly initialWorkingDirectory: string;
  readonly fileSystem: FileSystemPort;
  readonly editorFile: EditorFilePort;
  readonly graftDiagnostics: GraftDiagnosticsPort;
  readonly graftSession: GraftSessionPort;
  readonly sourceHighlighter: SourceHighlighter;
  readonly titleSceneLoader: TitleSceneLoaderPort;
  readonly productionTextSession: ProductionTextSession;
  readonly textOperationSequencer: WorkspaceTextOperationSequencer;
  readonly wscWorkspaceStore: JeditWscWorkspaceStorePort;
  readonly profiler: ProfilerTracePort;
  readonly profileOnStartup: boolean;
  readonly createTimeTickCmd: () => Cmd<WorkspaceMsg>;
  readonly createNotificationTickCmd: () => Cmd<WorkspaceMsg>;
  readonly createDrawerAnimationCmd: (kind: DrawerKind, from: number, to: number) => Cmd<WorkspaceMsg>[];
  readonly createStartupFileDrawerAnimationCmd: CreateStartupFileDrawerAnimationCmd;
  readonly initialModel: WorkspaceInitialModelSnapshot;
  readonly nowMs: () => number;
}

export interface WorkspaceRuntime {
  init: () => WorkspaceRuntimeResult;
  update: (msg: WorkspaceRuntimeMsg, model: WorkspaceModel) => WorkspaceRuntimeResult;
  view: (model: WorkspaceModel) => ReturnType<typeof renderWorkspace>;
  routeRuntimeIssue: (issue: RuntimeIssue) => WorkspaceMsg;
}
