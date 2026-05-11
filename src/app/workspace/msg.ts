import type { RuntimeIssue } from '@flyingrobots/bijou-tui';
import type { GraftInfo } from '../../ports/graft-session.js';
import type { DrawerKind } from '../../ui/drawer-layout.js';
import type { TitleScene } from '../../ui/title-scene.js';
import type { ProfilerMsg } from '../raytracer-profiler.js';
import type { SourceHighlightMsg } from '../source-highlight-session.js';
import type { TitleCameraMotionMsg } from '../title-camera-session.js';

export type WorkspaceMsg =
  | { type: 'drawer-progress'; kind: DrawerKind; value: number }
  | { type: 'graft-info'; requestId: number; info: GraftInfo }
  | { type: 'load-scene-result'; scene: TitleScene | undefined }
  | ProfilerMsg
  | { type: 'toggle-profiler' }
  | SourceHighlightMsg
  | TitleCameraMotionMsg
  | { type: 'time-tick'; time: number }
  | { type: 'toggle-perf' }
  | { type: 'runtime-issue'; issue: RuntimeIssue };
