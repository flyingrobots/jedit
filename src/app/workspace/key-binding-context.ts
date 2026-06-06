import type { Cmd } from '@flyingrobots/bijou-tui';
import type { EditorFilePort } from '../../ports/editor-file.js';
import type { FileSystemPort } from '../../ports/file-system.js';
import type { GraftSessionPort } from '../../ports/graft-session.js';
import type { SourceHighlighter } from '../../ports/source-highlighter.js';
import type { TitleSceneLoaderPort } from '../../ports/title-scene-loader.js';
import type { CreateDrawerAnimationCmd } from './drawer.js';
import type { WorkspaceMsg } from './msg.js';
import type { ProductionTextSession } from './production-text-session.js';

export type CreateStartupFileDrawerAnimationCmd = (
  from: number,
  to: number,
) => Cmd<WorkspaceMsg>[];

export interface UpdateFromKeyDeps {
  readonly fileSystem: FileSystemPort;
  readonly editorFile: EditorFilePort;
  readonly sourceHighlighter: SourceHighlighter;
  readonly graftSession: GraftSessionPort;
  readonly titleSceneLoader: TitleSceneLoaderPort;
  readonly productionTextSession: ProductionTextSession;
}

export interface WorkspaceKeyBindingContext {
  readonly nowMs: () => number;
  readonly createDrawerAnimationCmd: CreateDrawerAnimationCmd;
  readonly createStartupFileDrawerAnimationCmd: CreateStartupFileDrawerAnimationCmd;
  readonly createNotificationTickCmd: () => Cmd<WorkspaceMsg>;
  readonly deps: UpdateFromKeyDeps;
}
