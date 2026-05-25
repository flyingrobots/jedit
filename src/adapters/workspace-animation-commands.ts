import {
  animate,
  type Cmd,
} from '@flyingrobots/bijou-tui';
import { createNotificationTickCmd } from '../ui/feedback.js';
import type { DrawerKind } from '../ui/drawer-layout.js';
import { WorkspaceMessageTypes, type WorkspaceMsg } from '../app/workspace/msg.js';

const TIME_TICK_DURATION_MS = Number.MAX_SAFE_INTEGER;
const DRAWER_DURATION_MS = 160;

export function createWorkspaceTimeTickCmd(): Cmd<WorkspaceMsg> {
  return animate<WorkspaceMsg>({
    type: 'tween',
    from: 0,
    to: Number.MAX_SAFE_INTEGER,
    duration: TIME_TICK_DURATION_MS,
    onFrame: (value) => ({ type: WorkspaceMessageTypes.TimeTick, time: value / 1000 }),
  });
}

export function createWorkspaceNotificationTickCmd(): Cmd<WorkspaceMsg> {
  return createNotificationTickCmd((atMs) => ({
    type: WorkspaceMessageTypes.NotificationTick,
    atMs,
  }));
}

export function createWorkspaceDrawerAnimationCmd(
  kind: DrawerKind,
  from: number,
  to: number,
): Cmd<WorkspaceMsg>[] {
  return [
    animate<WorkspaceMsg>({
      type: 'tween',
      from,
      to,
      duration: DRAWER_DURATION_MS,
      onFrame: (value) => ({ type: WorkspaceMessageTypes.DrawerProgress, kind, value }),
    }),
  ];
}
