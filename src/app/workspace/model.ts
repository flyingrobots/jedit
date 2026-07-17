import type { NotificationState } from "@flyingrobots/bijou-tui";
import type { FileEntry } from "../../ports/file-system.js";
import type { GraftDiagnosticsReport } from "../../ports/graft-diagnostics.js";
import type { GraftInfo } from "../../ports/graft-session.js";
import type { I18nPort } from "../../ports/i18n.js";
import type { BuiltInTitleSceneName } from "../../ports/title-scene-loader.js";
import type { SourceHighlightReading } from "../../ports/source-highlighter.js";
import type { JeditTheme } from "../../ui/jedit-theme.js";
import type { SourceLineNumberMode } from "../../ui/source-line-number-mode.js";
import type { FocusPane } from "../../ui/panel-focus.js";
import type { TitleMeshLibrary } from "../../ui/title-mesh-library.js";
import type { TitleScene } from "../../ui/title-scene.js";
import type {
  TitleAsciiPalette,
  TitleRenderMode,
} from "../../ui/title-screen.js";
import type { ProfilerState } from "../raytracer-profiler.js";
import type {
  TitleCameraMouseLookPointer,
  TitleCameraState,
} from "../title-camera-session.js";
import type { TextRuntimeProfile } from "../text-runtime-profile.js";
import type { EditorState } from "./editor/model.js";
import type { WorkspaceMsg } from "./msg.js";
import type { ViewMode } from "./view-mode.js";
import type { WorkspaceTextAuthority } from "./workspace-text-authority.js";
import type { WorkspaceBufferRegistry } from "./workspace-buffer-registry.js";
import type { StartupFileModalState } from "./startup-file-modal.js";
import type { WorkspaceCommandLineState } from "./command-line.js";
import type {
  WorkspaceCommandLineFilePreviewState,
} from "./command-completion-preview.js";
import type { WorkspaceInlinePanel } from "./workspace-inline-panel.js";
import type { WorkspaceCausalGutterBasis } from "./workspace-causal-gutter-basis.js";

export interface WorkspaceModel
  extends StartupFileModalState,
    WorkspaceCommandLineFilePreviewState {
  readonly i18n: I18nPort;
  readonly workspaceRoot: string;
  readonly cwd: string;
  readonly entries: readonly FileEntry[];
  readonly selectedIndex: number;
  readonly editor?: EditorState;
  readonly buffers: WorkspaceBufferRegistry;
  readonly activeBufferId?: string;
  readonly textRuntimeProfile: TextRuntimeProfile;
  readonly textAuthority: WorkspaceTextAuthority;
  readonly textRequestId: number;
  readonly viewMode: ViewMode;
  readonly focusPane: FocusPane;
  readonly fileDrawerOpen: boolean;
  readonly fileDrawerProgress: number;
  readonly graftDrawerOpen: boolean;
  readonly graftDrawerProgress: number;
  readonly notifications: NotificationState<WorkspaceMsg>;
  readonly notificationLoopActive: boolean;
  readonly quitConfirmOpen: boolean;
  readonly quitAfterSaveRequestId?: number;
  readonly footerVisible: boolean;
  readonly lineNumberMode: SourceLineNumberMode;
  readonly gutterDimmed: boolean;
  readonly causalGutterBasis: WorkspaceCausalGutterBasis;
  readonly settingsOpen: boolean;
  readonly settingsFocusIndex: number;
  readonly settingsDiagnosticsOpen: boolean;
  readonly jeditTheme: JeditTheme;
  readonly graftDiagnostics?: GraftDiagnosticsReport;
  readonly graftDiagnosticsLoading: boolean;
  readonly graftDiagnosticsRequestId: number;
  readonly graftInfo?: GraftInfo;
  readonly graftLoading: boolean;
  readonly graftRequestId: number;
  readonly graftSelectedIndex: number;
  readonly expandedProjectionLaneIndex?: number;
  readonly sourceHighlight?: SourceHighlightReading;
  readonly sourceHighlightLoading: boolean;
  readonly sourceHighlightRequestId: number;
  readonly titleSceneSeed: number;
  readonly titleMeshes: TitleMeshLibrary;
  readonly scenePickerOpen: boolean;
  readonly scenePickerFocusIndex: number;
  readonly availableScenes: readonly BuiltInTitleSceneName[];
  readonly titleSceneName?: BuiltInTitleSceneName;
  readonly sceneOverride?: TitleScene;
  readonly columns: number;
  readonly rows: number;
  readonly time: number;
  readonly perfVisible: boolean;
  readonly lastFrameMs: number;
  readonly frameTimeMs: number;
  readonly frameTimeHistory: readonly number[];
  readonly titleCamera: TitleCameraState;
  readonly titleMouseLook?: TitleCameraMouseLookPointer;
  readonly titleRenderMode: TitleRenderMode;
  readonly titleAsciiPalette: TitleAsciiPalette;
  readonly titleMeshMaterialIndex: number;
  readonly profiler: ProfilerState;
  readonly commandLine: WorkspaceCommandLineState;
  readonly inlinePanel?: WorkspaceInlinePanel;
}
